import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv, hasSupabaseEnv } from "@/lib/supabase/env";
import type {
  CommunityMedalBoard,
  CommunityComment,
  CommunityPost,
  HomeSummary,
  PublicAdoption,
  PublicCampaign,
  PublicCommunityProfile,
  PublicDataResult,
  PublicPetCase,
  PublicPetCaseContact,
  PublicRescuer,
  PublicReunion,
  PublicService,
  PublicTransitRequest,
} from "@/lib/types";

function publicClient() {
  const { url, key } = getSupabaseEnv();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function unavailable<T>(fallback: T): PublicDataResult<T> {
  return { data: fallback, configured: false };
}

function failure<T>(fallback: T, message: string): PublicDataResult<T> {
  return { data: fallback, configured: true, error: message };
}

export async function getHomeData() {
  if (!hasSupabaseEnv()) {
    return {
      summary: unavailable<HomeSummary | null>(null),
      cases: unavailable<PublicPetCase[]>([]),
      heroCases: unavailable<PublicPetCase[]>([]),
      mapCases: unavailable<PublicPetCase[]>([]),
    };
  }

  const supabase = publicClient();
  const [summaryResult, casesResult, heroCasesResult, mapCasesResult] = await Promise.all([
    supabase.rpc("get_public_home_summary", { p_city_slug: "bariloche" }),
    supabase
      .from("api_pet_cases")
      .select("*")
      .in("post_state", ["lost", "sighted", "found", "available"])
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("api_pet_cases")
      .select("*")
      .eq("post_type", "lost")
      .in("post_state", ["lost", "sighted"])
      .ilike("species", "%perr%")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("api_pet_cases")
      .select("*")
      .in("post_state", ["lost", "sighted", "found", "available"])
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  return {
    summary: summaryResult.error
      ? failure<HomeSummary | null>(null, summaryResult.error.message)
      : { data: summaryResult.data as HomeSummary | null, configured: true },
    cases: casesResult.error
      ? failure<PublicPetCase[]>([], casesResult.error.message)
      : { data: (casesResult.data ?? []) as PublicPetCase[], configured: true },
    heroCases: heroCasesResult.error
      ? failure<PublicPetCase[]>([], heroCasesResult.error.message)
      : { data: (heroCasesResult.data ?? []) as PublicPetCase[], configured: true },
    mapCases: mapCasesResult.error
      ? failure<PublicPetCase[]>([], mapCasesResult.error.message)
      : { data: (mapCasesResult.data ?? []) as PublicPetCase[], configured: true },
  };
}

export async function getPetCases(): Promise<PublicDataResult<PublicPetCase[]>> {
  if (!hasSupabaseEnv()) return unavailable([]);
  const { data, error } = await publicClient()
    .from("api_pet_cases")
    .select("*")
    .in("post_state", ["lost", "sighted", "found", "available"])
    .order("created_at", { ascending: false });
  return error ? failure([], error.message) : { data: data ?? [], configured: true };
}

export async function getPetCase(petPostId: string): Promise<PublicDataResult<PublicPetCase | null>> {
  if (!hasSupabaseEnv()) return unavailable(null);
  const { data, error } = await publicClient()
    .from("api_pet_cases")
    .select("*")
    .eq("id", petPostId)
    .maybeSingle();
  return error ? failure(null, error.message) : { data: data ?? null, configured: true };
}

export async function getPetCaseContact(
  petPostId: string,
): Promise<PublicDataResult<PublicPetCaseContact | null>> {
  if (!hasSupabaseEnv()) return unavailable(null);
  const { data, error } = await publicClient().rpc("get_public_pet_case_contact_v1", {
    p_pet_post_id: petPostId,
  });
  const contact = Array.isArray(data) ? data[0] ?? null : data ?? null;
  return error
    ? failure(null, error.message)
    : { data: contact as PublicPetCaseContact | null, configured: true };
}

export async function getAdoptions(): Promise<PublicDataResult<PublicAdoption[]>> {
  if (!hasSupabaseEnv()) return unavailable([]);
  const { data, error } = await publicClient()
    .from("api_adoptions")
    .select("*")
    .eq("post_state", "available")
    .order("created_at", { ascending: false });
  return error ? failure([], error.message) : { data: data ?? [], configured: true };
}

export async function getCommunityData() {
  if (!hasSupabaseEnv()) {
    return {
      posts: unavailable<CommunityPost[]>([]),
      campaigns: unavailable<PublicCampaign[]>([]),
    };
  }
  const supabase = publicClient();
  const [posts, campaigns] = await Promise.all([
    supabase.from("api_community_feed").select("*").order("created_at", { ascending: false }),
    supabase.from("api_campaigns").select("*").order("created_at", { ascending: false }),
  ]);
  return {
    posts: posts.error ? failure<CommunityPost[]>([], posts.error.message) : { data: posts.data ?? [], configured: true },
    campaigns: campaigns.error ? failure<PublicCampaign[]>([], campaigns.error.message) : { data: campaigns.data ?? [], configured: true },
  };
}

export async function getCommunityPost(postId: string): Promise<{
  post: PublicDataResult<CommunityPost | null>;
  comments: PublicDataResult<CommunityComment[]>;
}> {
  if (!hasSupabaseEnv()) {
    return { post: unavailable(null), comments: unavailable([]) };
  }
  const supabase = publicClient();
  const [postResult, commentsResult] = await Promise.all([
    supabase.from("api_community_feed").select("*").eq("id", postId).maybeSingle(),
    supabase.from("api_community_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true }),
  ]);
  return {
    post: postResult.error
      ? failure<CommunityPost | null>(null, postResult.error.message)
      : { data: postResult.data as CommunityPost | null, configured: true },
    comments: commentsResult.error
      ? failure<CommunityComment[]>([], commentsResult.error.message)
      : { data: (commentsResult.data ?? []) as CommunityComment[], configured: true },
  };
}

export async function getServices(): Promise<PublicDataResult<PublicService[]>> {
  if (!hasSupabaseEnv()) return unavailable([]);
  const { data, error } = await publicClient()
    .from("api_useful_data_directory_v1")
    .select("*")
    .order("name", { ascending: true });
  return error ? failure([], error.message) : { data: data ?? [], configured: true };
}

export async function getRescuers(): Promise<PublicDataResult<PublicRescuer[]>> {
  if (!hasSupabaseEnv()) return unavailable([]);
  const { data, error } = await publicClient()
    .from("api_rescuer_directory_v1")
    .select("*")
    .order("organization_name", { ascending: true });
  return error ? failure([], error.message) : { data: data ?? [], configured: true };
}

export async function getTransitRequests(): Promise<PublicDataResult<PublicTransitRequest[]>> {
  if (!hasSupabaseEnv()) return unavailable([]);
  const { data, error } = await publicClient()
    .from("api_transit_requests_v1")
    .select("*")
    .order("created_at", { ascending: false });
  return error ? failure([], error.message) : { data: data ?? [], configured: true };
}

export async function getCommunityMedalBoard(): Promise<PublicDataResult<CommunityMedalBoard | null>> {
  if (!hasSupabaseEnv()) return unavailable(null);
  const { data, error } = await publicClient().rpc("get_community_medal_board_v1");
  return error
    ? failure(null, error.message)
    : { data: data as CommunityMedalBoard | null, configured: true };
}

export async function getPublicCommunityProfile(
  profileId: string,
): Promise<PublicDataResult<PublicCommunityProfile | null>> {
  if (!hasSupabaseEnv()) return unavailable(null);
  const { data, error } = await publicClient().rpc("get_public_community_profile_v1", {
    p_profile_id: profileId,
  });
  return error
    ? failure(null, error.message)
    : { data: data as PublicCommunityProfile | null, configured: true };
}

export async function getPublicReunions(): Promise<PublicDataResult<PublicReunion[]>> {
  if (!hasSupabaseEnv()) return unavailable([]);
  const { data, error } = await publicClient().rpc("get_public_reunions_v1", {
    p_limit: 36,
  });
  return error
    ? failure([], error.message)
    : { data: (data ?? []) as PublicReunion[], configured: true };
}

export function storagePublicUrl(bucket: string, path: string | null) {
  if (!path) return null;
  if (/^https:\/\//i.test(path)) return path;
  if (!hasSupabaseEnv()) return null;
  const { url } = getSupabaseEnv();
  const safePath = path.split("/").map(encodeURIComponent).join("/");
  return `${url}/storage/v1/object/public/${bucket}/${safePath}`;
}
