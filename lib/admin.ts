import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type AdminProfile = {
  id: string;
  display_name: string;
  role: "admin";
};

export type AdminUser = {
  id: string;
  display_name: string;
  role: string;
  points: number;
  created_at: string;
  status: string;
  reason: string | null;
  suspended_until: string | null;
};

export type AdminPetPost = {
  id: string;
  owner_id: string;
  post_type: string;
  post_state: string;
  moderation_status: string;
  name: string | null;
  species: string;
  zone_name: string;
  created_at: string;
};

export type AdminReport = {
  id: string;
  reporter_id: string | null;
  pet_post_id: string | null;
  sighting_id: string | null;
  message_id: string | null;
  community_post_id: string | null;
  community_comment_id: string | null;
  reported_profile_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type AdminRescuerApplication = {
  id: string;
  user_id: string;
  applicant_name: string;
  organization_name: string | null;
  social_url: string | null;
  message: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type AdminAuditEntry = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  outcome: string;
  created_at: string;
};

export type AdminActionEntry = {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  created_at: string;
};

export type AdminServiceCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
};

export type AdminService = {
  id: string;
  city_id: string;
  category_id: string;
  slug: string;
  name: string;
  summary: string | null;
  description: string | null;
  address: string;
  neighborhood: string | null;
  phone: string | null;
  whatsapp: string | null;
  emergency_phone: string | null;
  website: string | null;
  instagram: string | null;
  opening_hours: unknown;
  is_emergency: boolean;
  is_24_hours: boolean;
  status: string;
  created_at: string;
};

export type AdminServiceMedia = {
  id: string;
  service_id: string;
  object_path: string;
  alt_text: string;
  sort_order: number;
};

export type AdminUsefulDetails = {
  service_id: string;
  home_visit: boolean;
  has_on_call: boolean;
  specializations: string[];
  product_types: string[];
  delivery_available: boolean;
  payment_methods: string[];
  facebook: string | null;
  tiktok: string | null;
  notes: string | null;
};

export async function requireAdmin() {
  if (!hasSupabaseEnv()) redirect("/ingresar");

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getClaims();
  const userId = typeof authData?.claims?.sub === "string" ? authData.claims.sub : null;

  if (authError || !userId) redirect("/ingresar");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", userId)
    .single();

  if (profileError || profile?.role !== "admin") {
    redirect("/cuenta?admin=denied");
  }

  return {
    supabase,
    profile: profile as AdminProfile,
  };
}

export async function loadAdminDashboard() {
  const { supabase, profile } = await requireAdmin();

  const [
    usersResult,
    moderationResult,
    postsResult,
    reportsResult,
    applicationsResult,
    auditResult,
    actionsResult,
    usersCountResult,
    postsCountResult,
    reportsCountResult,
    applicationsCountResult,
    categoriesResult,
    servicesResult,
    serviceMediaResult,
    serviceDetailsResult,
    citiesResult,
    providerResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, role, points, created_at")
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("account_moderation")
      .select("user_id, status, reason, suspended_until, updated_at")
      .limit(200),
    supabase
      .from("pet_posts")
      .select("id, owner_id, post_type, post_state, moderation_status, name, species, zone_name, created_at")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("content_reports")
      .select("id, reporter_id, pet_post_id, sighting_id, message_id, community_post_id, community_comment_id, reported_profile_id, reason, details, status, resolution_note, created_at, resolved_at")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("rescuer_applications")
      .select("id, user_id, applicant_name, organization_name, social_url, message, status, review_note, created_at, reviewed_at")
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("audit_log")
      .select("id, actor_id, action, entity_type, entity_id, outcome, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("admin_actions")
      .select("id, admin_id, action, target_type, target_id, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("pet_posts").select("id", { count: "exact", head: true }),
    supabase
      .from("content_reports")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "reviewing"]),
    supabase
      .from("rescuer_applications")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("service_categories").select("id, slug, name, description, sort_order, active").order("sort_order"),
    supabase.from("services").select("id, city_id, category_id, slug, name, summary, description, address, neighborhood, phone, whatsapp, emergency_phone, website, instagram, opening_hours, is_emergency, is_24_hours, status, created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("service_media").select("id, service_id, object_path, alt_text, sort_order").order("sort_order").limit(400),
    supabase.from("service_details_016").select("service_id, home_visit, has_on_call, specializations, product_types, delivery_available, payment_methods, facebook, tiktok, notes").limit(200),
    supabase.from("cities").select("id, name, province").eq("is_active", true).order("name"),
    supabase.rpc("get_media_provider_configuration"),
  ]);

  const errors = [
    usersResult.error,
    moderationResult.error,
    postsResult.error,
    reportsResult.error,
    applicationsResult.error,
    auditResult.error,
    actionsResult.error,
    usersCountResult.error,
    postsCountResult.error,
    reportsCountResult.error,
    applicationsCountResult.error,
    categoriesResult.error,
    servicesResult.error,
    serviceMediaResult.error,
    serviceDetailsResult.error,
    citiesResult.error,
  ].filter(Boolean);

  const moderationByUser = new Map(
    (moderationResult.data ?? []).map((row) => [row.user_id, row]),
  );

  const users: AdminUser[] = (usersResult.data ?? []).map((row) => {
    const moderation = moderationByUser.get(row.id);
    return {
      ...row,
      status: moderation?.status ?? "active",
      reason: moderation?.reason ?? null,
      suspended_until: moderation?.suspended_until ?? null,
    } as AdminUser;
  });

  return {
    profile,
    users,
    posts: (postsResult.data ?? []) as AdminPetPost[],
    reports: (reportsResult.data ?? []) as AdminReport[],
    applications: (applicationsResult.data ?? []) as AdminRescuerApplication[],
    audit: (auditResult.data ?? []) as AdminAuditEntry[],
    actions: (actionsResult.data ?? []) as AdminActionEntry[],
    categories: (categoriesResult.data ?? []) as AdminServiceCategory[],
    services: (servicesResult.data ?? []) as AdminService[],
    serviceMedia: (serviceMediaResult.data ?? []) as AdminServiceMedia[],
    serviceDetails: (serviceDetailsResult.data ?? []) as AdminUsefulDetails[],
    cities: citiesResult.data ?? [],
    mediaProvider: providerResult.error
      ? { provider: "imagekit", configured: false, url_endpoint: null }
      : providerResult.data ?? { provider: "imagekit", configured: false, url_endpoint: null },
    counts: {
      users: usersCountResult.count ?? users.length,
      posts: postsCountResult.count ?? postsResult.data?.length ?? 0,
      pendingReports: reportsCountResult.count ?? 0,
      pendingApplications: applicationsCountResult.count ?? 0,
    },
    error: errors.length > 0
      ? "Una parte de la información administrativa no pudo cargarse. Revisá que la sesión siga activa."
      : null,
  };
}
