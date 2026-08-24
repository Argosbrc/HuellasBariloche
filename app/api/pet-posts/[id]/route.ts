import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type UpdatePayload = {
  name?: unknown;
  species?: unknown;
  breed?: unknown;
  sex?: unknown;
  ageLabel?: unknown;
  sizeLabel?: unknown;
  colors?: unknown;
  distinctiveFeatures?: unknown;
  description?: unknown;
  healthStatus?: unknown;
  adoptionRequirements?: unknown;
  photoUrls?: unknown;
  zoneName?: unknown;
  exactLatitude?: unknown;
  exactLongitude?: unknown;
  addressNotes?: unknown;
  showWhatsapp?: unknown;
  eventAt?: unknown;
};

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!uuidPattern.test(id)) return NextResponse.json({ error: "El caso indicado no es válido." }, { status: 400 });

    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getClaims();
    const userId = typeof authData?.claims?.sub === "string" ? authData.claims.sub : null;
    if (authError || !userId) return NextResponse.json({ error: "Debés iniciar sesión para editar el caso." }, { status: 401 });

    const body = await request.json().catch(() => null) as UpdatePayload | null;
    if (!body) return NextResponse.json({ error: "No recibimos los datos del caso." }, { status: 400 });
    const photoUrls = Array.isArray(body.photoUrls)
      ? body.photoUrls.filter((item): item is string => typeof item === "string" && /^https:\/\//i.test(item)).slice(0, 4)
      : [];
    const colors = Array.isArray(body.colors)
      ? body.colors.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, 40)).filter(Boolean).slice(0, 12)
      : [];
    const exactLatitude = nullableNumber(body.exactLatitude);
    const exactLongitude = nullableNumber(body.exactLongitude);
    if (Number.isNaN(exactLatitude) || Number.isNaN(exactLongitude)) {
      return NextResponse.json({ error: "La ubicación seleccionada no es válida." }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("update_my_pet_post_v1", {
      p_pet_post_id: id,
      p_name: text(body.name, 80) || null,
      p_species: text(body.species, 40),
      p_breed: text(body.breed, 80) || null,
      p_sex: text(body.sex, 20) || null,
      p_age_label: text(body.ageLabel, 60) || null,
      p_size_label: text(body.sizeLabel, 40) || null,
      p_colors: colors,
      p_distinctive_features: text(body.distinctiveFeatures, 1200) || null,
      p_description: text(body.description, 3000),
      p_health_status: text(body.healthStatus, 1000) || null,
      p_adoption_requirements: text(body.adoptionRequirements, 2000) || null,
      p_photo_urls: photoUrls,
      p_zone_name: text(body.zoneName, 120) || null,
      p_exact_latitude: exactLatitude,
      p_exact_longitude: exactLongitude,
      p_address_notes: text(body.addressNotes, 500) || null,
      p_show_whatsapp: body.showWhatsapp === true,
      p_event_at: text(body.eventAt, 40) || null,
    });

    if (error || !data) {
      const status = error?.code === "42501" ? 403 : 400;
      return NextResponse.json({ error: error?.message || "No se pudo actualizar el caso." }, { status });
    }

    revalidatePath("/");
    revalidatePath("/casos");
    revalidatePath(`/casos/${id}`);
    revalidatePath("/mapa");
    revalidatePath("/adopciones");
    revalidatePath("/panel");
    revalidatePath(`/panel/casos/${id}`);
    return NextResponse.json({ id: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el caso." }, { status: 400 });
  }
}
