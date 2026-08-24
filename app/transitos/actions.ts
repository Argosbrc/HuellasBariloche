"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/account";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalBoolean(formData: FormData, name: string) {
  const value = field(formData, name);
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

function finish(path: string, message: string, failed = false): never {
  revalidatePath("/transitos");
  revalidatePath("/rescatistas");
  revalidatePath("/panel");
  const anchor = path === "/rescatistas" ? "#transitos" : "";
  redirect(`${path}?${failed ? "error" : "ok"}=${encodeURIComponent(message)}${anchor}`);
}

export async function offerTransitHome(formData: FormData) {
  const { supabase } = await requireAccount();
  const campaignId = field(formData, "campaign_id");
  const availability = field(formData, "availability");
  if (!campaignId || availability.length < 3) {
    finish("/rescatistas", "Indicá durante cuánto tiempo podés ofrecer tránsito.", true);
  }

  const { error } = await supabase.rpc("offer_transit_home_v1", {
    target_campaign: campaignId,
    p_home_zone: field(formData, "home_zone") || null,
    p_availability: availability,
    p_has_dogs: optionalBoolean(formData, "has_dogs"),
    p_has_cats: optionalBoolean(formData, "has_cats"),
    p_has_children: optionalBoolean(formData, "has_children"),
    p_message: field(formData, "message") || null,
    p_share_whatsapp: formData.get("share_whatsapp") === "on",
  });

  if (error) finish("/rescatistas", error.message || "No se pudo enviar el ofrecimiento.", true);
  finish("/rescatistas", "Tu ofrecimiento fue enviado al rescatista.");
}

export async function reviewTransitOffer(formData: FormData) {
  const { supabase } = await requireAccount();
  const offerId = field(formData, "offer_id");
  const decision = field(formData, "decision");
  if (!offerId || !["accepted", "rejected"].includes(decision)) {
    finish("/panel", "La decisión no es válida.", true);
  }

  const { error } = await supabase.rpc("review_transit_offer_v1", {
    target_offer: offerId,
    p_decision: decision,
  });
  if (error) finish("/panel", error.message || "No se pudo revisar la oferta.", true);
  finish("/panel", decision === "accepted" ? "Oferta de tránsito aceptada." : "Oferta de tránsito rechazada.");
}

export async function closeTransitRequest(formData: FormData) {
  const { supabase } = await requireAccount();
  const campaignId = field(formData, "campaign_id");
  const status = field(formData, "status");
  if (!campaignId || !["completed", "closed"].includes(status)) {
    finish("/panel", "El estado de la búsqueda no es válido.", true);
  }

  const { error } = await supabase.rpc("set_transit_request_status_v1", {
    target_campaign: campaignId,
    p_status: status,
  });
  if (error) finish("/panel", error.message || "No se pudo cerrar la búsqueda.", true);
  finish("/panel", status === "completed" ? "La búsqueda quedó marcada como resuelta." : "La búsqueda fue cerrada.");
}
