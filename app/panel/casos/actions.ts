"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/account";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function panelResult(message: string, failed = false, anchor = ""): never {
  revalidatePath("/panel");
  redirect(`/panel?${failed ? "error" : "ok"}=${encodeURIComponent(message)}${anchor}`);
}

export async function changePetCaseState(formData: FormData) {
  const postId = field(formData, "pet_post_id");
  const state = field(formData, "state");
  const reason = field(formData, "reason");
  if (!postId || !["reunited", "adopted", "closed", "archived"].includes(state)) {
    panelResult("El cierre solicitado no es válido.", true);
  }

  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("resolve_my_pet_case_v1", {
    p_pet_post_id: postId,
    p_new_state: state,
    p_reason: reason || null,
  });
  if (error) panelResult(error.message || "No se pudo actualizar el estado del caso.", true);

  revalidatePath("/");
  revalidatePath("/casos");
  revalidatePath(`/casos/${postId}`);
  revalidatePath("/mapa");
  revalidatePath("/adopciones");
  revalidatePath("/rescatistas");
  revalidatePath(`/panel/casos/${postId}`);
  const labels: Record<string, string> = {
    reunited: "El caso quedó marcado como reunión concretada.",
    adopted: "La adopción quedó marcada como concretada.",
    closed: "El caso quedó cerrado y ya no aparece en los listados activos.",
    archived: "El caso quedó archivado.",
  };
  panelResult(labels[state] || "Estado actualizado.");
}

export async function updateSightingAlertStatus(formData: FormData) {
  const alertId = field(formData, "alert_id");
  const status = field(formData, "status");
  if (!alertId || !["contacted", "resolved", "dismissed"].includes(status)) {
    panelResult("El estado del aviso no es válido.", true, "#avisos-casos");
  }

  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("set_my_pet_sighting_alert_status_v1", {
    p_alert_id: alertId,
    p_status: status,
  });
  if (error) panelResult(error.message || "No se pudo actualizar el aviso.", true, "#avisos-casos");
  panelResult(status === "contacted" ? "Aviso marcado como contactado." : status === "resolved" ? "Aviso marcado como resuelto." : "Aviso descartado.", false, "#avisos-casos");
}

export async function startSightingConversation(formData: FormData) {
  const petPostId = field(formData, "pet_post_id");
  const reporterUserId = field(formData, "reporter_user_id");

  if (!petPostId || !reporterUserId) {
    panelResult(
      "No se pudo identificar la conversación.",
      true,
      "#avisos-casos"
    );
  }

  const { supabase } = await requireAccount();

  const { data, error } = await supabase.rpc(
    "start_sighting_conversation",
    {
      target_post: petPostId,
      target_user: reporterUserId,
    }
  );

  if (error || !data) {
    panelResult(
      error?.message || "No se pudo iniciar la conversación.",
      true,
      "#avisos-casos"
    );
  }

  redirect(`/conversaciones/${data}`);
}

export async function markNotificationRead(formData: FormData) {
  const notificationId = field(formData, "notification_id");
  if (!notificationId) panelResult("La notificación no es válida.", true, "#notificaciones");
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("set_notification_read", {
    p_notification_id: notificationId,
    p_read: true,
  });
  if (error) panelResult(error.message || "No se pudo marcar la notificación.", true, "#notificaciones");
  panelResult("Notificación marcada como leída.", false, "#notificaciones");
}

export async function markAllNotificationsRead() {
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) panelResult(error.message || "No se pudieron marcar las notificaciones.", true, "#notificaciones");
  panelResult("Todas las notificaciones quedaron marcadas como leídas.", false, "#notificaciones");
}
