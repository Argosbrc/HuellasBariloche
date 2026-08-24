import { toFile } from "@imagekit/nodejs";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { getImageKitClient, hasImageKitEnv, imageKitEndpoint } from "@/lib/imagekit/server";
import { IMAGE_POLICY } from "@/lib/media/image-policy";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const purposes = new Set(["avatar", "pet_post", "sighting", "community", "service", "campaign"]);

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function isMissingImageKitFile(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as {
    status?: number;
    statusCode?: number;
    response?: { status?: number };
    message?: string;
  };
  return value.status === 404
    || value.statusCode === 404
    || value.response?.status === 404
    || /not found|does not exist/i.test(value.message || "");
}

export async function POST(request: Request) {
  let uploadedFileId: string | null = null;
  let registeredMediaId: string | null = null;
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;

  try {
    if (!hasImageKitEnv()) {
      return NextResponse.json({ error: "ImageKit todavía no está configurado en las variables del proyecto." }, { status: 503 });
    }

    supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getClaims();
    const userId = typeof authData?.claims?.sub === "string" ? authData.claims.sub : null;
    if (authError || !userId) return NextResponse.json({ error: "Debés iniciar sesión." }, { status: 401 });

    const formData = await request.formData();
    const purpose = text(formData.get("purpose")).toLowerCase();
    const entityId = text(formData.get("entity_id"));
    const altText = text(formData.get("alt_text")) || "Imagen de Huellas Bariloche";
    const incoming = formData.get("file");
    if (!purposes.has(purpose)) return NextResponse.json({ error: "Destino multimedia inválido." }, { status: 400 });
    if (!(incoming instanceof File)) return NextResponse.json({ error: "No se recibió una imagen." }, { status: 400 });
    if (incoming.type !== IMAGE_POLICY.outputMimeType || incoming.size < 1 || incoming.size > IMAGE_POLICY.maxBytes) {
      return NextResponse.json({ error: "La imagen debe ser WebP y pesar hasta 1 MB." }, { status: 400 });
    }

    const { data: authorization, error: authorizationError } = await supabase.rpc("authorize_imagekit_upload", { p_purpose: purpose });
    if (authorizationError) return NextResponse.json({ error: "Primero ejecutá y verificá la migración 014." }, { status: 409 });
    if (!authorization?.allowed) return NextResponse.json({ error: authorization?.reason || "Carga no autorizada." }, { status: 403 });

    const configuredEndpoint = String(authorization.url_endpoint || "").replace(/\/+$/, "");
    if (configuredEndpoint !== imageKitEndpoint()) {
      return NextResponse.json({ error: "El URL endpoint de ImageKit no coincide entre Supabase y .env.local." }, { status: 409 });
    }

    const bytes = Buffer.from(await incoming.arrayBuffer());
    const metadata = await sharp(bytes, { failOn: "error" }).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (metadata.format !== "webp" || width < 1 || height < 1 || width > IMAGE_POLICY.maxDimension || height > IMAGE_POLICY.maxDimension) {
      return NextResponse.json({ error: "La imagen debe medir como máximo 1600 px por lado." }, { status: 400 });
    }

    const fileName = `${crypto.randomUUID()}.webp`;
    const folder = `/huellas/${userId}/${purpose}`;
    const client = getImageKitClient();
    const uploadResult = await client.files.upload({
      file: await toFile(new Uint8Array(bytes), fileName, { type: "image/webp" }),
      fileName,
      folder,
      isPrivateFile: false,
      overwriteFile: false,
      useUniqueFileName: false,
      tags: ["huellas-bariloche", purpose],
    });

    const fileId = uploadResult.fileId;
    const filePath = uploadResult.filePath;
    const publicUrl = uploadResult.url;
    uploadedFileId = fileId ?? null;
    if (!fileId || !filePath || !publicUrl || uploadResult.fileType !== "image") {
      throw new Error("ImageKit no devolvió los datos completos de la imagen.");
    }
    if ((uploadResult.size ?? incoming.size) > IMAGE_POLICY.maxBytes || (uploadResult.width ?? width) > IMAGE_POLICY.maxDimension || (uploadResult.height ?? height) > IMAGE_POLICY.maxDimension) {
      throw new Error("ImageKit devolvió una imagen fuera de la política multimedia.");
    }

    const { data: mediaId, error: registerError } = await supabase.rpc("register_imagekit_upload", {
      p_provider_file_id: fileId,
      p_file_path: filePath,
      p_public_url: publicUrl,
      p_purpose: purpose,
      p_byte_size: uploadResult.size ?? incoming.size,
      p_width: uploadResult.width ?? width,
      p_height: uploadResult.height ?? height,
      p_mime_type: "image/webp",
    });
    if (registerError || !mediaId) throw new Error(registerError?.message || "No se pudo registrar la imagen.");
    registeredMediaId = mediaId;

    if (purpose === "avatar") {
      const { error } = await supabase.rpc("set_my_avatar", { p_media_id: mediaId });
      if (error) throw new Error(error.message);

      // set_my_avatar conserva el historial de forma transaccional marcando los
      // avatares anteriores como orphaned. Recién después de confirmar el nuevo
      // avatar se eliminan esos archivos de ImageKit y se cierra su registro.
      const { data: orphanedAvatars } = await supabase
        .from("external_media")
        .select("id, provider_file_id")
        .eq("owner_id", userId)
        .eq("purpose", "avatar")
        .eq("status", "orphaned");

      for (const orphan of orphanedAvatars ?? []) {
        let remoteFileDeleted = false;
        try {
          await client.files.delete(orphan.provider_file_id);
          remoteFileDeleted = true;
        } catch (deleteError) {
          // Si una limpieza anterior quitó el archivo pero no alcanzó a cerrar
          // el registro, un 404 también permite completar el descarte.
          remoteFileDeleted = isMissingImageKitFile(deleteError);
        }

        if (remoteFileDeleted) {
          await supabase.rpc("discard_imagekit_upload", { p_media_id: orphan.id });
        }
      }
    }

    if (purpose === "service") {
      if (!entityId) throw new Error("Falta el servicio de destino.");
      const { error } = await supabase.rpc("admin_attach_service_image", {
        p_service_id: entityId,
        p_object_path: publicUrl,
        p_mime_type: "image/webp",
        p_byte_size: uploadResult.size ?? incoming.size,
        p_width: uploadResult.width ?? width,
        p_height: uploadResult.height ?? height,
        p_alt_text: altText.slice(0, 300),
        p_sort_order: Number(text(formData.get("sort_order")) || 0),
      });
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({
      id: mediaId,
      url: publicUrl,
      filePath,
      width: uploadResult.width ?? width,
      height: uploadResult.height ?? height,
      size: uploadResult.size ?? incoming.size,
      attached: purpose === "avatar" || purpose === "service",
    });
  } catch (error) {
    if (uploadedFileId) {
      try { await getImageKitClient().files.delete(uploadedFileId); } catch { /* La limpieza se revisa desde el panel. */ }
    }
    if (registeredMediaId && supabase) {
      try { await supabase.rpc("discard_imagekit_upload", { p_media_id: registeredMediaId }); } catch { /* La limpieza se revisa desde el panel. */ }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cargar la imagen." }, { status: 400 });
  }
}
