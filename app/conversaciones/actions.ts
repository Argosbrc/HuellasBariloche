"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/account";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function finish(path: string, message: string, failed = false): never {
  revalidatePath("/panel");
  revalidatePath("/conversaciones");
  redirect(`${path}?${failed ? "error" : "ok"}=${encodeURIComponent(message)}`);
}

export async function startConversation(formData: FormData) {
  const postId = field(formData, "pet_post_id");
  if (!postId) finish("/casos", "La publicación no es válida.", true);
  const { supabase } = await requireAccount();
  const { data, error } = await supabase.rpc("start_conversation", { target_post: postId });
  if (error || !data) finish(`/casos/${postId}`, error?.message || "No se pudo iniciar la conversación.", true);
  redirect(`/conversaciones/${data}`);
}

export async function sendConversationMessage(formData: FormData) {
  const conversationId = field(formData, "conversation_id");
  const body = field(formData, "body");
  if (!conversationId || body.length < 1 || body.length > 4000) {
    finish(`/conversaciones/${conversationId}`, "El mensaje debe tener entre 1 y 4000 caracteres.", true);
  }
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("send_conversation_message", {
    p_conversation_id: conversationId,
    p_body: body,
    p_client_nonce: crypto.randomUUID(),
  });
  if (error) finish(`/conversaciones/${conversationId}`, error.message || "No se pudo enviar el mensaje.", true);
  revalidatePath(`/conversaciones/${conversationId}`);
  redirect(`/conversaciones/${conversationId}`);
}

export async function archiveConversation(formData: FormData) {
  const conversationId = field(formData, "conversation_id");
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("set_conversation_archived", {
    p_conversation_id: conversationId,
    p_archived: true,
  });
  if (error) finish(`/conversaciones/${conversationId}`, error.message || "No se pudo archivar la conversación.", true);
  finish("/conversaciones", "Conversación archivada.");
}

export async function setConversationBlock(formData: FormData) {
  const conversationId = field(formData, "conversation_id");
  const targetUser = field(formData, "target_user_id");
  const blocked = field(formData, "blocked") === "true";
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("set_user_block", {
    p_target_user: targetUser,
    p_blocked: blocked,
  });
  if (error) finish(`/conversaciones/${conversationId}`, error.message || "No se pudo cambiar el bloqueo.", true);
  if (!blocked) {
    const { error: unarchiveError } = await supabase.rpc("set_conversation_archived", {
      p_conversation_id: conversationId,
      p_archived: false,
    });
    if (unarchiveError) finish(`/conversaciones/${conversationId}`, unarchiveError.message || "El usuario fue desbloqueado, pero no se pudo reabrir la conversación.", true);
  }
  finish(`/conversaciones/${conversationId}`, blocked ? "Usuario bloqueado. La conversación quedó archivada." : "Usuario desbloqueado.");
}

export async function reportConversationMessage(formData: FormData) {
  const conversationId = field(formData, "conversation_id");
  const messageId = field(formData, "message_id");
  const reason = field(formData, "reason");
  const details = field(formData, "details");
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("submit_content_report_v1", {
    p_target_type: "message",
    p_target_id: messageId,
    p_reason: reason,
    p_details: details || null,
  });
  if (error) finish(`/conversaciones/${conversationId}`, error.message || "No se pudo enviar la denuncia.", true);
  finish(`/conversaciones/${conversationId}`, "La denuncia fue enviada a administración.");
}
