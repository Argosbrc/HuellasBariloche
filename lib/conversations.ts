import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/account";
import type { ConversationDetail, ConversationInboxItem } from "@/lib/types";

export async function loadConversationInbox() {
  const { supabase, profile } = await requireAccount();
  const { data, error } = await supabase.rpc("get_my_conversation_inbox_v1");
  return {
    profile,
    conversations: error ? [] : (data ?? []) as ConversationInboxItem[],
    error: error?.message ?? null,
  };
}

export async function loadConversation(conversationId: string) {
  const { supabase, profile } = await requireAccount();
  await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
  const { data, error } = await supabase.rpc("get_my_conversation_v1", {
    p_conversation_id: conversationId,
  });
  if (error || !data) notFound();
  return { profile, conversation: data as ConversationDetail };
}
