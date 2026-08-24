import { NextResponse } from "next/server";
import { getImageKitClient, hasImageKitEnv } from "@/lib/imagekit/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingFile(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: number; statusCode?: number; response?: { status?: number }; message?: string };
  return value.status === 404
    || value.statusCode === 404
    || value.response?.status === 404
    || /not found|does not exist/i.test(value.message || "");
}

export async function POST(request: Request) {
  try {
    if (!hasImageKitEnv()) return NextResponse.json({ error: "ImageKit no está configurado." }, { status: 503 });
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getClaims();
    const userId = typeof authData?.claims?.sub === "string" ? authData.claims.sub : null;
    if (authError || !userId) return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });

    const body = await request.json().catch(() => null) as { mediaIds?: unknown } | null;
    const mediaIds = Array.isArray(body?.mediaIds)
      ? [...new Set(body.mediaIds.filter((item): item is string => typeof item === "string" && uuidPattern.test(item)))].slice(0, 4)
      : [];
    if (!mediaIds.length) return NextResponse.json({ discarded: 0 });

    const { data: rows, error } = await supabase
      .from("external_media")
      .select("id, provider_file_id, purpose, status")
      .in("id", mediaIds)
      .eq("owner_id", userId)
      .in("purpose", ["pet_post", "community", "sighting", "campaign"])
      .in("status", ["uploaded", "orphaned"]);
    if (error) throw new Error(error.message);

    const client = getImageKitClient();
    let discarded = 0;
    for (const row of rows ?? []) {
      let deleted = false;
      try {
        await client.files.delete(row.provider_file_id);
        deleted = true;
      } catch (deleteError) {
        deleted = isMissingFile(deleteError);
      }
      if (!deleted) continue;
      const { error: discardError } = await supabase.rpc("discard_imagekit_upload", { p_media_id: row.id });
      if (!discardError) discarded += 1;
    }

    return NextResponse.json({ discarded });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron limpiar las imágenes." }, { status: 400 });
  }
}
