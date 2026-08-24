"use client";

import type { PreparedImage } from "./prepare-image";
import { IMAGE_POLICY } from "./image-policy";

export type UploadedPublicImage = {
  id: string;
  url: string;
  filePath: string;
  width: number;
  height: number;
  size: number;
};

export async function discardUserImages(mediaIds: string[]) {
  if (!mediaIds.length) return;
  const response = await fetch("/api/imagekit/discard", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mediaIds }),
  });
  if (!response.ok) throw new Error("No se pudieron limpiar las imágenes pendientes.");
}

export async function uploadUserImages({ purpose, images }: { purpose: "pet_post" | "sighting" | "community" | "campaign"; images: PreparedImage[] }) {
  if (images.length > IMAGE_POLICY.maxImages) throw new Error("Solo se permiten cuatro imágenes por publicación.");
  if (images.some((item) => item.file.size > IMAGE_POLICY.maxBytes || item.file.type !== IMAGE_POLICY.outputMimeType)) throw new Error("Una imagen no cumple la política multimedia.");
  const uploaded: UploadedPublicImage[] = [];
  try {
    for (const image of images) {
      const body = new FormData();
      body.set("file", image.file);
      body.set("purpose", purpose);
      body.set("width", String(image.width));
      body.set("height", String(image.height));
      const response = await fetch("/api/imagekit/upload", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo subir una imagen a ImageKit.");
      uploaded.push(result as UploadedPublicImage);
    }
    return uploaded;
  } catch (error) {
    try { await discardUserImages(uploaded.map((item) => item.id)); } catch { /* Se puede revisar desde external_media. */ }
    throw error;
  }
}
