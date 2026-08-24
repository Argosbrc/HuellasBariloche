"use client";

import imageCompression from "browser-image-compression";
import { IMAGE_POLICY } from "./image-policy";

export type PreparedImage = {
  id: string;
  file: File;
  originalName: string;
  originalBytes: number;
  width: number;
  height: number;
  previewUrl: string;
};

async function normalizeHeic(file: File) {
  if (!/image\/(heic|heif)/i.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) return file;
  const { heicTo } = await import("heic-to/csp");
  const converted = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  return new File([converted], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg", lastModified: file.lastModified });
}

async function dimensions(file: File) {
  const bitmap = await createImageBitmap(file);
  const result = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return result;
}

export async function prepareImage(source: File): Promise<PreparedImage> {
  if (source.size > IMAGE_POLICY.maxSourceBytes) throw new Error(`${source.name}: el archivo original supera 20 MB.`);
  const accepted = IMAGE_POLICY.acceptedInputTypes.includes(source.type as (typeof IMAGE_POLICY.acceptedInputTypes)[number]) || /\.(jpe?g|png|webp|heic|heif)$/i.test(source.name);
  if (!accepted) throw new Error(`${source.name}: formato no admitido.`);

  const normalized = await normalizeHeic(source);
  const compressed = await imageCompression(normalized, {
    maxSizeMB: IMAGE_POLICY.targetBytes / 1_048_576,
    maxWidthOrHeight: IMAGE_POLICY.maxDimension,
    useWebWorker: false,
    preserveExif: false,
    fileType: IMAGE_POLICY.outputMimeType,
    initialQuality: 0.84,
    maxIteration: 12,
  });
  const file = new File([compressed], `${source.name.replace(/\.[^.]+$/, "")}-${crypto.randomUUID()}.webp`, { type: IMAGE_POLICY.outputMimeType, lastModified: Date.now() });
  const size = await dimensions(file);
  if (file.size > IMAGE_POLICY.maxBytes || size.width > IMAGE_POLICY.maxDimension || size.height > IMAGE_POLICY.maxDimension) {
    throw new Error(`${source.name}: no pudo reducirse dentro de la política de 1 MB y 1600 px.`);
  }
  return { id: crypto.randomUUID(), file, originalName: source.name, originalBytes: source.size, width: size.width, height: size.height, previewUrl: URL.createObjectURL(file) };
}
