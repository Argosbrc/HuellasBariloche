"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/account";
import { deliverAdoptionApplicationPush } from "@/lib/adoption-push";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function fail(petPostId: string, message: string): never {
  redirect(`/adopciones/${petPostId}/solicitar?error=${encodeURIComponent(message)}`);
}

export async function submitAdoptionApplication(formData: FormData) {
  const petPostId = field(formData, "pet_post_id");
  if (!petPostId) redirect("/adopciones");

  const fullName = field(formData, "full_name");
  const homeAddress = field(formData, "home_address");
  const phone = field(formData, "phone");
  const locality = field(formData, "locality");
  const secureHome = field(formData, "secure_home");
  const financialCapacity = field(formData, "financial_capacity");
  const neuterCommitment = field(formData, "neuter_commitment");
  const followUpCommitment = field(formData, "follow_up_commitment");

  if (fullName.length < 2 || homeAddress.length < 5 || phone.length < 7 || locality.length < 2) {
    fail(petPostId, "Completá todos tus datos de contacto.");
  }
  if (!["yes", "no", "apartment_safe_balcony"].includes(secureHome)) {
    fail(petPostId, "Indicá cómo es el lugar donde vivirá el animal.");
  }
  if (!["yes", "no", "with_effort"].includes(financialCapacity)) {
    fail(petPostId, "Respondé la pregunta sobre gastos veterinarios.");
  }
  if (!["agreed", "cannot_guarantee"].includes(neuterCommitment)) {
    fail(petPostId, "Respondé el compromiso de castración.");
  }
  if (!["agreed", "prefer_not"].includes(followUpCommitment)) {
    fail(petPostId, "Respondé la pregunta sobre seguimiento.");
  }

  const { supabase, profile } = await requireAccount();
  const { data: requestId, error } = await supabase.rpc("submit_adoption_application_v1", {
    p_pet_post_id: petPostId,
    p_full_name: fullName,
    p_home_address: homeAddress,
    p_phone: phone,
    p_locality: locality,
    p_secure_home: secureHome,
    p_financial_capacity: financialCapacity,
    p_neuter_commitment: neuterCommitment,
    p_follow_up_commitment: followUpCommitment,
  });

  if (error) fail(petPostId, error.message || "No se pudo enviar la solicitud.");
  if (typeof requestId === "string") {
    await deliverAdoptionApplicationPush(requestId, profile.id).catch(() => 0);
  }
  revalidatePath("/panel");
  redirect(`/panel?ok=${encodeURIComponent("Solicitud de adopción enviada al rescatista.")}#mis-solicitudes-adopcion`);
}

export async function reviewAdoptionApplication(formData: FormData) {
  const requestId = field(formData, "request_id");
  const decision = field(formData, "decision");
  if (!requestId || !["accepted", "rejected"].includes(decision)) {
    redirect(`/panel?error=${encodeURIComponent("La decisión no es válida.")}#solicitudes-adopcion`);
  }

  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("review_adoption_application_v1", {
    p_adoption_request_id: requestId,
    p_decision: decision,
  });
  if (error) {
    redirect(`/panel?error=${encodeURIComponent(error.message || "No se pudo revisar la solicitud.")}#solicitudes-adopcion`);
  }

  revalidatePath("/panel");
  revalidatePath("/adopciones");
  const message = decision === "accepted"
    ? "Postulante seleccionado. La adopción seguirá abierta hasta que confirmes la entrega."
    : "Solicitud de adopción rechazada.";
  redirect(`/panel?ok=${encodeURIComponent(message)}#solicitudes-adopcion`);
}
