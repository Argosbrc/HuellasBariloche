"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/account";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function finish(path: string, message: string, failed = false): never {
  revalidatePath("/comunidad");
  revalidatePath("/panel");
  redirect(`${path}?${failed ? "error" : "ok"}=${encodeURIComponent(message)}`);
}

export async function setCommunityLike(formData: FormData) {
  const postId = field(formData, "post_id");
  const liked = field(formData, "liked") === "true";
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("set_community_like", {
    target_post: postId,
    liked,
  });
  if (error) finish(`/comunidad/${postId}`, error.message || "No se pudo guardar la reacción.", true);
  revalidatePath(`/comunidad/${postId}`);
  redirect(`/comunidad/${postId}`);
}

export async function recordCommunityShare(postId: string) {
  if (!postId) return { ok: false };
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("record_community_share", {
    target_post: postId,
  });
  if (error) return { ok: false };
  revalidatePath("/comunidad");
  revalidatePath(`/comunidad/${postId}`);
  return { ok: true };
}

export async function addCommunityComment(formData: FormData) {
  const postId = field(formData, "post_id");
  const body = field(formData, "body");
  if (body.length < 1 || body.length > 1500) finish(`/comunidad/${postId}`, "El comentario debe tener entre 1 y 1500 caracteres.", true);
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("add_community_comment", {
    target_post: postId,
    p_body: body,
  });
  if (error) finish(`/comunidad/${postId}`, error.message || "No se pudo publicar el comentario.", true);
  revalidatePath(`/comunidad/${postId}`);
  redirect(`/comunidad/${postId}#comentarios`);
}

export async function removeCommunityComment(formData: FormData) {
  const postId = field(formData, "post_id");
  const commentId = field(formData, "comment_id");
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("remove_community_comment", {
    target_comment: commentId,
    p_reason: "El autor retiró el comentario",
  });
  if (error) finish(`/comunidad/${postId}`, error.message || "No se pudo retirar el comentario.", true);
  finish(`/comunidad/${postId}`, "Comentario retirado.");
}

export async function reportCommunityContent(formData: FormData) {
  const postId = field(formData, "post_id");
  const targetType = field(formData, "target_type");
  const targetId = field(formData, "target_id");
  const reason = field(formData, "reason");
  const details = field(formData, "details");
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("submit_content_report_v1", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_details: details || null,
  });
  if (error) finish(`/comunidad/${postId}`, error.message || "No se pudo enviar la denuncia.", true);
  finish(`/comunidad/${postId}`, "La denuncia fue enviada a administración.");
}

export async function setMyCommunityPostState(formData: FormData) {
  const postId = field(formData, "post_id");
  const action = field(formData, "action");
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("set_my_community_post_state_v1", {
    p_post_id: postId,
    p_action: action,
  });
  if (error) finish(`/panel/comunidad/${postId}`, error.message || "No se pudo actualizar la publicación.", true);
  if (action === "remove") finish("/panel", "Publicación retirada.");
  finish(`/panel/comunidad/${postId}`, action === "resolve" ? "Publicación marcada como resuelta." : "Publicación reabierta.");
}

export async function updateMyCommunityPost(formData: FormData) {
  const postId = field(formData, "post_id");
  const eventValue = field(formData, "event_at");
  const expiryValue = field(formData, "expires_at");
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("update_my_community_post_v1", {
    p_post_id: postId,
    p_body: field(formData, "body"),
    p_place_name: field(formData, "place_name") || null,
    p_event_at: eventValue ? new Date(eventValue).toISOString() : null,
    p_expires_at: expiryValue ? new Date(expiryValue).toISOString() : null,
  });
  if (error) finish(`/panel/comunidad/${postId}`, error.message || "No se pudo guardar la publicación.", true);
  finish(`/panel/comunidad/${postId}`, "Publicación actualizada.");
}
