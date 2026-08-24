"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getImageKitClient, hasImageKitEnv } from "@/lib/imagekit/server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function validUuid(value: string) {
  if (!uuidPattern.test(value)) throw new Error("Identificador inválido.");
  return value;
}

function finish(section: string, message: string, failed = false): never {
  revalidatePath("/admin");
  const key = failed ? "error" : "ok";
  redirect(`/admin?section=${section}&${key}=${encodeURIComponent(message)}`);
}

export async function setUserStatus(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const targetUser = validUuid(field(formData, "target_user"));
  const status = field(formData, "status");
  const reason = field(formData, "reason");
  const untilValue = field(formData, "until_at");

  if (targetUser === profile.id) {
    finish("usuarios", "Tu propia cuenta no puede moderarse desde el panel.", true);
  }
  if (!["active", "suspended", "banned"].includes(status)) {
    finish("usuarios", "Estado de cuenta inválido.", true);
  }
  if (status !== "active" && (reason.length < 3 || reason.length > 500)) {
    finish("usuarios", "Ingresá un motivo de entre 3 y 500 caracteres.", true);
  }

  let untilAt: string | null = null;
  if (status === "suspended" && untilValue) {
    const parsed = new Date(untilValue);
    if (Number.isNaN(parsed.getTime()) || parsed <= new Date()) {
      finish("usuarios", "La suspensión debe finalizar en una fecha futura.", true);
    }
    untilAt = parsed.toISOString();
  }

  const { error } = await supabase.rpc("admin_set_user_status", {
    target_user: targetUser,
    new_status: status,
    admin_reason: status === "active" ? null : reason,
    until_at: untilAt,
  });

  if (error) finish("usuarios", "Supabase rechazó el cambio de estado.", true);
  finish("usuarios", "Estado de la cuenta actualizado.");
}

export async function moderatePetPost(formData: FormData) {
  const { supabase } = await requireAdmin();
  const targetPost = validUuid(field(formData, "target_post"));
  const status = field(formData, "moderation_status");
  const note = field(formData, "note");

  if (!["visible", "hidden", "removed"].includes(status)) {
    finish("contenido", "Estado de moderación inválido.", true);
  }
  if (note.length < 3 || note.length > 500) {
    finish("contenido", "Ingresá un motivo de entre 3 y 500 caracteres.", true);
  }

  const { error } = await supabase.rpc("admin_moderate_post", {
    target_post: targetPost,
    new_moderation: status,
    admin_note: note,
  });

  if (error) finish("contenido", "No se pudo moderar la publicación.", true);
  finish("contenido", "Moderación de la publicación actualizada.");
}

export async function resolveReport(formData: FormData) {
  const { supabase } = await requireAdmin();
  const targetReport = validUuid(field(formData, "target_report"));
  const status = field(formData, "status");
  const note = field(formData, "note");

  if (!["reviewing", "resolved", "dismissed"].includes(status)) {
    finish("denuncias", "Estado de denuncia inválido.", true);
  }
  if (note.length < 3 || note.length > 1000) {
    finish("denuncias", "Ingresá una resolución de entre 3 y 1000 caracteres.", true);
  }

  const { error } = await supabase.rpc("admin_resolve_report", {
    target_report: targetReport,
    new_status: status,
    admin_note: note,
  });

  if (error) finish("denuncias", "No se pudo actualizar la denuncia.", true);
  finish("denuncias", "Denuncia actualizada.");
}

export async function reviewRescuerApplication(formData: FormData) {
  const { supabase } = await requireAdmin();
  const targetApplication = validUuid(field(formData, "target_application"));
  const decision = field(formData, "decision");
  const note = field(formData, "note");

  if (!["approved", "rejected"].includes(decision)) {
    finish("rescatistas", "Decisión inválida.", true);
  }
  if (note && (note.length < 2 || note.length > 1000)) {
    finish("rescatistas", "La nota debe tener entre 2 y 1000 caracteres.", true);
  }

  const { error } = await supabase.rpc("admin_review_rescuer_application", {
    target_application: targetApplication,
    decision,
    admin_note: note || null,
  });

  if (error) finish("rescatistas", error.message || "No se pudo revisar la solicitud.", true);
  finish("rescatistas", decision === "approved" ? "Rescatista aprobado." : "Solicitud rechazada.");
}

function optionalNumber(value: string) {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) throw new Error("Número inválido.");
  return parsed;
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function listField(formData: FormData, name: string) {
  return Array.from(new Set(
    field(formData, name)
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
  )).slice(0, 20);
}

export async function upsertUsefulCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const name = field(formData, "category_name");
  const slug = slugify(field(formData, "category_slug") || name);
  if (name.length < 2 || name.length > 80 || !slug) {
    finish("guia", "Ingresá un nombre válido para la categoría.", true);
  }
  const { error } = await supabase.rpc("admin_upsert_service_category_v1", {
    p_category_id: null,
    p_slug: slug,
    p_name: name,
    p_description: field(formData, "category_description") || null,
    p_sort_order: Number(field(formData, "category_sort_order") || "100"),
    p_active: true,
  });
  if (error) finish("guia", error.message || "No se pudo guardar la categoría.", true);
  finish("guia", "Categoría agregada a Datos útiles.");
}

export async function configureImageKit(formData: FormData) {
  const { supabase } = await requireAdmin();
  const endpoint = field(formData, "url_endpoint").replace(/\/+$/, "");
  const { error } = await supabase.rpc("admin_configure_imagekit", { p_url_endpoint: endpoint });
  if (error) finish("guia", error.message || "No se pudo configurar ImageKit.", true);
  finish("guia", "ImageKit quedó configurado en Supabase.");
}

export async function upsertGuideService(formData: FormData) {
  const { supabase } = await requireAdmin();
  const serviceId = field(formData, "service_id");
  const name = field(formData, "name");
  const categoryId = validUuid(field(formData, "category_id"));
  const cityId = validUuid(field(formData, "city_id"));
  const slug = slugify(field(formData, "slug") || name);
  if (name.length < 2 || !slug) finish("guia", "Ingresá un nombre válido para el lugar.", true);

  const { data: savedService, error } = await supabase.rpc("admin_upsert_service", {
    p_service_id: serviceId ? validUuid(serviceId) : null,
    p_city_id: cityId,
    p_category_id: categoryId,
    p_slug: slug,
    p_name: name,
    p_summary: field(formData, "summary") || null,
    p_description: field(formData, "description") || null,
    p_address: field(formData, "address"),
    p_neighborhood: field(formData, "neighborhood") || null,
    p_phone: field(formData, "phone") || null,
    p_whatsapp: field(formData, "whatsapp") || null,
    p_emergency_phone: field(formData, "emergency_phone") || null,
    p_website: field(formData, "website") || null,
    p_instagram: field(formData, "instagram") || null,
    p_opening_hours: field(formData, "opening_hours") ? { display: field(formData, "opening_hours") } : {},
    p_is_emergency: formData.get("is_emergency") === "on",
    p_is_24_hours: formData.get("is_24_hours") === "on",
    p_public_latitude: optionalNumber(field(formData, "public_latitude")),
    p_public_longitude: optionalNumber(field(formData, "public_longitude")),
  });
  if (error) finish("guia", error.message || "No se pudo guardar el lugar.", true);

  let targetServiceId = serviceId;
  if (!targetServiceId && typeof savedService === "string" && uuidPattern.test(savedService)) {
    targetServiceId = savedService;
  }
  if (!targetServiceId) {
    const { data: serviceRecord, error: lookupError } = await supabase
      .from("services")
      .select("id")
      .eq("city_id", cityId)
      .eq("slug", slug)
      .single();
    if (lookupError || !serviceRecord?.id) {
      finish("guia", "El lugar se guardó, pero no se pudieron asociar sus datos adicionales.", true);
    }
    targetServiceId = serviceRecord.id;
  }

  const { error: detailsError } = await supabase.rpc("admin_upsert_service_details_v1", {
    p_service_id: validUuid(targetServiceId),
    p_home_visit: formData.get("home_visit") === "on",
    p_has_on_call: formData.get("has_on_call") === "on",
    p_specializations: listField(formData, "specializations"),
    p_product_types: listField(formData, "product_types"),
    p_delivery_available: formData.get("delivery_available") === "on",
    p_payment_methods: listField(formData, "payment_methods"),
    p_facebook: field(formData, "facebook") || null,
    p_tiktok: field(formData, "tiktok") || null,
    p_notes: field(formData, "useful_notes") || null,
  });
  if (detailsError) finish("guia", detailsError.message || "No se pudieron guardar los datos adicionales.", true);
  finish("guia", serviceId ? "Dato útil actualizado." : "Dato útil creado como borrador.");
}

export async function setGuideServiceStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const status = field(formData, "status");
  if (!["draft", "published", "archived"].includes(status)) finish("guia", "Estado inválido.", true);
  const { error } = await supabase.rpc("admin_set_service_status", {
    p_service_id: validUuid(field(formData, "service_id")),
    p_status: status,
  });
  if (error) finish("guia", error.message || "No se pudo cambiar el estado.", true);
  finish("guia", status === "published" ? "Lugar publicado en Datos útiles." : "Estado del lugar actualizado.");
}

export async function removeGuideServiceImage(formData: FormData) {
  const { supabase } = await requireAdmin();
  const mediaId = validUuid(field(formData, "media_id"));
  const { data: media } = await supabase.from("service_media").select("object_path").eq("id", mediaId).single();
  const { data: external } = media?.object_path
    ? await supabase.from("external_media").select("id, provider_file_id").eq("public_url", media.object_path).maybeSingle()
    : { data: null };
  const { error } = await supabase.rpc("admin_remove_service_image", { p_media_id: mediaId });
  if (error) finish("guia", error.message || "No se pudo retirar la imagen.", true);
  if (external?.provider_file_id && hasImageKitEnv()) {
    try {
      await getImageKitClient().files.delete(external.provider_file_id);
      await supabase.rpc("discard_imagekit_upload", { p_media_id: external.id });
    } catch {
      finish("guia", "La imagen se retiró de Datos útiles y quedó pendiente de limpieza en ImageKit.");
    }
  }
  finish("guia", "Imagen retirada de Datos útiles.");
}
