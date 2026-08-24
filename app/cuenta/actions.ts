"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/account";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function listField(formData: FormData, name: string) {
  return Array.from(new Set(
    field(formData, name)
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
  )).slice(0, 20);
}

function finish(path: string, message: string, failed = false): never {
  revalidatePath("/panel");
  revalidatePath("/cuenta/perfil");
  redirect(`${path}?${failed ? "error" : "ok"}=${encodeURIComponent(message)}`);
}

export async function updateProfile(formData: FormData) {
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("update_my_profile", {
    p_display_name: field(formData, "display_name"),
    p_bio: field(formData, "bio") || null,
    p_city_id: field(formData, "city_id"),
    p_whatsapp: field(formData, "whatsapp") || null,
    p_public_email: field(formData, "public_email") || null,
  });
  if (error) finish("/cuenta/perfil", error.message || "No se pudo guardar el perfil.", true);
  finish("/cuenta/perfil", "Perfil actualizado correctamente.");
}

export async function updateRescuerProfile(formData: FormData) {
  const { supabase, profile } = await requireAccount();
  const organizationName = field(formData, "organization_name");
  if (organizationName.length < 2 || organizationName.length > 100) {
    finish("/cuenta/perfil", "El nombre de la organización debe tener entre 2 y 100 caracteres.", true);
  }
  const { error } = await supabase
    .from("rescuer_profiles")
    .update({
      organization_name: organizationName,
      description: field(formData, "description") || null,
      contact_area: field(formData, "contact_area") || null,
      social_url: field(formData, "social_url") || null,
    })
    .eq("user_id", profile.id)
    .eq("verification_status", "verified");
  if (error) finish("/cuenta/perfil", error.message || "No se pudo guardar el perfil de rescatista.", true);

  const { error: directoryError } = await supabase.rpc("update_my_rescuer_directory_profile_v1", {
    p_donation_alias: field(formData, "donation_alias") || null,
    p_donation_note: field(formData, "donation_note") || null,
    p_current_needs: listField(formData, "current_needs"),
    p_public_phone: field(formData, "rescuer_public_phone") || null,
    p_public_email: field(formData, "rescuer_public_email") || null,
    p_instagram: field(formData, "rescuer_instagram") || null,
    p_facebook: field(formData, "rescuer_facebook") || null,
    p_website: field(formData, "rescuer_website") || null,
  });
  if (directoryError) finish("/cuenta/perfil", directoryError.message || "No se pudieron guardar los datos de donaciones.", true);
  finish("/cuenta/perfil", "Perfil de rescatista actualizado.");
}

export async function submitRescuerApplication(formData: FormData) {
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("submit_rescuer_application", {
    p_applicant_name: field(formData, "applicant_name"),
    p_phone: field(formData, "phone"),
    p_organization_name: field(formData, "organization_name") || null,
    p_social_url: field(formData, "social_url") || null,
    p_message: field(formData, "message") || null,
  });
  if (error) finish("/panel", error.message || "No se pudo enviar la solicitud.", true);
  finish("/panel", "Solicitud de rescatista enviada para revisión.");
}

export async function withdrawRescuerApplication() {
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("withdraw_rescuer_application");
  if (error) finish("/panel", error.message || "No se pudo retirar la solicitud.", true);
  finish("/panel", "Solicitud retirada.");
}
