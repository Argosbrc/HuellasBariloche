import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/account";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { CommunityComment, CommunityPost, MyCommunityPost } from "@/lib/types";

export async function loadCommunityPost(postId: string) {
  if (!hasSupabaseEnv()) notFound();
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  const userId = typeof authData?.claims?.sub === "string" ? authData.claims.sub : null;
  const [postResult, commentsResult] = await Promise.all([
    supabase.from("api_community_feed").select("*").eq("id", postId).maybeSingle(),
    supabase.from("api_community_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true }),
  ]);
  if (postResult.error || !postResult.data) notFound();
  return {
    post: postResult.data as CommunityPost,
    comments: (commentsResult.data ?? []) as CommunityComment[],
    userId,
  };
}

export async function loadMyCommunityPost(postId: string) {
  const { supabase, profile } = await requireAccount();
  const { data, error } = await supabase.rpc("get_my_community_posts_v1");
  if (error) notFound();
  const post = ((data ?? []) as MyCommunityPost[]).find((item) => item.id === postId);
  if (!post) notFound();
  return { profile, post };
}
