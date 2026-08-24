"use client";

import { CheckCircle2, ImagePlus, LoaderCircle, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { prepareImage } from "@/lib/media/prepare-image";

type Props = {
  purpose: "avatar" | "service";
  label?: string;
  entityId?: string;
  altText?: string;
  icon?: React.ReactNode;
};

export function ImageKitUploader({ purpose, label = "Subir imagen", entityId, altText, icon }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const source = event.target.files?.[0];
    event.target.value = "";
    if (!source) return;
    setBusy(true); setMessage(null); setSuccess(false);
    let previewUrl: string | null = null;
    try {
      const prepared = await prepareImage(source);
      previewUrl = prepared.previewUrl;
      const body = new FormData();
      body.set("file", prepared.file);
      body.set("purpose", purpose);
      body.set("width", String(prepared.width));
      body.set("height", String(prepared.height));
      if (entityId) body.set("entity_id", entityId);
      if (altText) body.set("alt_text", altText);
      const response = await fetch("/api/imagekit/upload", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo cargar la imagen.");
      setSuccess(true);
      setMessage(purpose === "avatar" ? "Foto de perfil actualizada." : "Imagen agregada a Datos útiles.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la imagen.");
    } finally {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setBusy(false);
    }
  }

  return <div className="imagekit-uploader"><input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={choose} hidden /><button className="button button-light" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? <LoaderCircle className="spin" size={17} /> : success ? <CheckCircle2 size={17} /> : icon || <UploadCloud size={17} />}{busy ? "Optimizando y subiendo…" : label}</button>{message && <small className={success ? "upload-success" : "upload-error"}>{message}</small>}<span className="upload-policy"><ImagePlus size={13} />WebP · 1 MB · 1600 px</span></div>;
}
