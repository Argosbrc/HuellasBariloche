import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { AdoptionDashboard, MyCommunityPost, NearbyAlertPreferences, PetSightingAlert, TransitDashboard } from "@/lib/types";

export type AccountProfile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: "member" | "rescuer" | "admin";
  points: number;
  city_id: string;
  created_at: string;
};

export type AccountPost = {
  id: string;
  post_type: string;
  post_state: string;
  status: string;
  moderation_status: string;
  name: string | null;
  species: string;
  zone_name: string | null;
  photo_paths: string[];
  created_at: string;
  updated_at: string;
};

export type AccountNotification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export type AccountRescuerDirectory = {
  rescuer_profile_id: string;
  donation_alias: string | null;
  donation_note: string | null;
  current_needs: string[];
  public_phone: string | null;
  public_email: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
};

export type AccountBadge = {
  badge_id: string;
  awarded_at: string;
  badge: {
    name: string;
    description: string;
    icon: string;
  } | null;
};

export async function requireAccount() {
  if (!hasSupabaseEnv()) redirect("/ingresar");
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = typeof authData?.claims?.sub === "string" ? authData.claims.sub : null;
  const email = typeof authData?.claims?.email === "string" ? authData.claims.email : "";
  if (authError || !userId) redirect("/ingresar");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, bio, role, points, city_id, created_at")
    .eq("id", userId)
    .single();

  if (profileError || !profile) redirect("/ingresar");
  return { supabase, profile: profile as AccountProfile, email };
}

export async function getOptionalAccountProfile() {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = typeof authData?.claims?.sub === "string" ? authData.claims.sub : null;
  if (authError || !userId) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", userId)
    .maybeSingle();
  return profile ?? null;
}

export async function loadAccountDashboard() {
  const { supabase, profile, email } = await requireAccount();
  console.log("PANEL USER", profile.id, profile.display_name, email);

  const [
    contactsResult,
    moderationResult,
    citiesResult,
    postsResult,
    notificationsResult,
    conversationsResult,
    applicationResult,
    rescuerResult,
    transitResult,
    adoptionResult,
    sightingAlertsResult,
    badgesResult,
    nearbyAlertsResult,
    communityPostsResult,
  ] = await Promise.all([
    supabase.from("profile_contacts").select("whatsapp, public_email").eq("user_id", profile.id).maybeSingle(),
    supabase.from("account_moderation").select("status, reason, suspended_until").eq("user_id", profile.id).maybeSingle(),
    supabase.from("cities").select("id, name, province").eq("is_active", true).order("name"),
    supabase.from("pet_posts").select("id, post_type, post_state, status, moderation_status, name, species, zone_name, photo_paths, created_at, updated_at").eq("owner_id", profile.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("notifications").select("id, title, body, link, read_at, created_at").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("conversation_members").select("conversation_id, last_read_at, archived_at").eq("user_id", profile.id).is("archived_at", null),
    supabase.from("rescuer_applications").select("id, applicant_name, phone, organization_name, social_url, message, status, review_note, created_at, reviewed_at").eq("user_id", profile.id).maybeSingle(),
    supabase.from("rescuer_profiles").select("id, organization_name, description, contact_area, social_url, verification_status, city_id, created_at").eq("user_id", profile.id).maybeSingle(),
    supabase.rpc("get_my_transit_dashboard_v1"),
    supabase.rpc("get_my_adoption_dashboard_v1"),
    supabase.rpc("get_my_pet_sighting_alerts_v1"),
    supabase
      .from("user_badges")
      .select("badge_id, awarded_at, badge:badges(name, description, icon)")
      .eq("profile_id", profile.id)
      .order("awarded_at", { ascending: false }),
    supabase.rpc("get_my_nearby_alert_preferences_v1"),
    supabase.rpc("get_my_community_posts_v1"),
  ]);

  let rescuerDirectory: AccountRescuerDirectory | null = null;
  if (rescuerResult.data?.id) {
    const { data: directoryData } = await supabase
      .from("rescuer_directory_profiles_016")
      .select("rescuer_profile_id, donation_alias, donation_note, current_needs, public_phone, public_email, instagram, facebook, website")
      .eq("rescuer_profile_id", rescuerResult.data.id)
      .maybeSingle();
    rescuerDirectory = directoryData as AccountRescuerDirectory | null;
  }

  let campaigns: Array<{ id: string; title: string; status: string; campaign_type: string; created_at: string }> = [];
  if (rescuerResult.data?.id) {
    const campaignsResult = await supabase
      .from("rescuer_campaigns")
      .select("id, title, status, campaign_type, created_at")
      .eq("rescuer_profile_id", rescuerResult.data.id)
      .order("created_at", { ascending: false })
      .limit(10);
    campaigns = campaignsResult.data ?? [];
  }

  const posts = (postsResult.data ?? []) as AccountPost[];
  console.log("NOTIFICATIONS RESULT", {
  data: notificationsResult.data,
  error: notificationsResult.error,
});
  const notifications = (notificationsResult.data ?? []) as AccountNotification[];
  console.log("NOTIFICATIONS DATA", notifications);
  const transit = transitResult.error || !transitResult.data
    ? { requests: [], offers_made: [] }
    : transitResult.data as TransitDashboard;
  const adoptions = adoptionResult.error || !adoptionResult.data
    ? { received: [], sent: [] }
    : adoptionResult.data as AdoptionDashboard;
  const sightingAlerts = sightingAlertsResult.error || !sightingAlertsResult.data
    ? []
    : sightingAlertsResult.data as PetSightingAlert[];
  const badges = badgesResult.error
    ? []
    : ((badgesResult.data ?? []) as unknown as AccountBadge[]).filter((item) => item.badge_id.startsWith("hb-"));
  const nearbyAlerts: NearbyAlertPreferences = nearbyAlertsResult.error || !nearbyAlertsResult.data
    ? { enabled: false, radius_km: 3, has_location: false, nearby_cases: [] }
    : nearbyAlertsResult.data as NearbyAlertPreferences;
  const communityPosts: MyCommunityPost[] = communityPostsResult.error || !communityPostsResult.data
    ? []
    : communityPostsResult.data as MyCommunityPost[];
  return {
    profile,
    email,
    contacts: contactsResult.data ?? { whatsapp: null, public_email: null },
    moderation: moderationResult.data ?? { status: "active", reason: null, suspended_until: null },
    cities: citiesResult.data ?? [],
    posts,
    notifications,
    unreadNotifications: notifications.filter((item) => !item.read_at).length,
    conversationCount: conversationsResult.data?.length ?? 0,
    application: applicationResult.data,
    rescuer: rescuerResult.data,
    rescuerDirectory,
    campaigns,
    transit,
    adoptions,
    sightingAlerts,
    badges,
    nearbyAlerts,
    communityPosts,
    counts: {
      posts: posts.length,
      activePosts: posts.filter((item) => ["lost", "sighted", "found", "available"].includes(item.post_state)).length,
      adoptions: posts.filter((item) => item.post_type === "adoption").length,
      campaigns: campaigns.length,
    },
  };
}
