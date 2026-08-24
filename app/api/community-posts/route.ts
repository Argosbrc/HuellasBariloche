import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const allowedTypes = new Set(["question", "event", "recommendation", "tip"]);

type PhotoPayload = { url?: unknown; width?: unknown; height?: unknown; size?: unknown };
type CommunityPayload = {
  postType?: unknown;
  body?: unknown;
  placeName?: unknown;
  eventAt?: unknown;
  photos?: unknown;
};

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function integer(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : 0;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getClaims();
    const userId = typeof authData?.claims?.sub === "string" ? authData.claims.sub : null;
    if (authError || !userId) return NextResponse.json({ error: "Debés iniciar sesión para publicar." }, { status: 401 });

    const payload = await request.json().catch(() => null) as CommunityPayload | null;
    const postType = text(payload?.postType, 30).toLowerCase();
    const body = text(payload?.body, 3000);
    const placeName = text(payload?.placeName, 160);
    const eventAt = text(payload?.eventAt, 40);
    if (!allowedTypes.has(postType)) return NextResponse.json({ error: "La categoría elegida no es válida." }, { status: 400 });
    if (body.length < 10) return NextResponse.json({ error: "La publicación necesita al menos 10 caracteres." }, { status: 400 });
    if (placeName && placeName.length < 2) return NextResponse.json({ error: "El lugar debe tener al menos 2 caracteres." }, { status: 400 });
    if (postType !== "event" && eventAt) return NextResponse.json({ error: "La fecha solo corresponde a una convocatoria." }, { status: 400 });
    if (eventAt && Number.isNaN(new Date(eventAt).getTime())) return NextResponse.json({ error: "La fecha de la actividad no es válida." }, { status: 400 });

    const photos = Array.isArray(payload?.photos) ? payload.photos.slice(0, 4) as PhotoPayload[] : [];
    const cleanPhotos = photos.map((photo) => ({
      url: text(photo.url, 1000),
      width: integer(photo.width),
      height: integer(photo.height),
      size: integer(photo.size),
    }));
    if (cleanPhotos.some((photo) => !/^https:\/\//i.test(photo.url) || photo.width < 1 || photo.height < 1 || photo.size < 1)) {
      return NextResponse.json({ error: "Una de las imágenes no es válida." }, { status: 400 });
    }

    const { data: postId, error: createError } = await supabase.rpc("create_community_post", {
      p_post_type: postType,
      p_body: body,
      p_place_name: placeName || null,
      p_event_at: eventAt || null,
    });
    if (createError || !postId) return NextResponse.json({ error: createError?.message || "No se pudo crear la publicación." }, { status: 400 });

    for (const [position, photo] of cleanPhotos.entries()) {
      const { error } = await supabase.rpc("attach_community_image", {
        target_post: postId,
        p_storage_path: photo.url,
        p_alt_text: `Imagen comunitaria de ${postType}`,
        p_width: photo.width,
        p_height: photo.height,
        p_byte_size: photo.size,
        p_mime_type: "image/webp",
        p_position: position,
      });
      if (error) {
        await supabase.rpc("remove_community_post", { target_post: postId, p_reason: "Error al adjuntar imágenes" });
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ id: postId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo publicar en Comunidad." }, { status: 400 });
  }
}
