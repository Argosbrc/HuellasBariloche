"use client";

import { ImagePlus, LoaderCircle, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatBytes, IMAGE_POLICY } from "@/lib/media/image-policy";
import { prepareImage, type PreparedImage } from "@/lib/media/prepare-image";

export function MediaPicker({
  onChange,
  required = false,
  maxImages = IMAGE_POLICY.maxImages,
}: {
  onChange?: (images: PreparedImage[]) => void;
  required?: boolean;
  maxImages?: number;
}) {
  const [images, setImages] = useState<PreparedImage[]>([]);
  const imagesRef = useRef(images);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => { onChange?.(images); }, [images, onChange]);
  useEffect(() => () => imagesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl)), []);

  async function selectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (images.length + selected.length > maxImages) { setMessage(`Podés agregar hasta ${maxImages} ${maxImages === 1 ? "imagen" : "imágenes"} nuevas.`); return; }
    setBusy(true); setMessage(null);
    try {
      const prepared: PreparedImage[] = [];
      for (const file of selected) prepared.push(await prepareImage(file));
      setImages((current) => [...current, ...prepared]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos procesar una imagen."); }
    finally { setBusy(false); }
  }

  function remove(id: string) {
    setImages((current) => { const target = current.find((item) => item.id === id); if (target) URL.revokeObjectURL(target.previewUrl); return current.filter((item) => item.id !== id); });
  }

  const disabled = busy || maxImages <= 0 || images.length >= maxImages;
  return <div className="media-picker"><div className="media-policy"><ShieldCheck size={21} /><div><strong>Protección multimedia activa</strong><span>WebP · máximo 1 MB · 1600 px · hasta {maxImages} {maxImages === 1 ? "imagen nueva" : "imágenes nuevas"}</span></div></div><label className={disabled ? "dropzone disabled" : "dropzone"}><input accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" disabled={disabled} multiple onChange={selectFiles} type="file" />{busy ? <LoaderCircle className="spin" size={30} /> : <ImagePlus size={30} />}<strong>{busy ? "Optimizando imágenes…" : maxImages <= 0 ? "Ya alcanzaste el máximo de fotos" : "Elegí fotos desde tu equipo"}</strong><span>La reducción ocurre antes de transmitirlas.</span></label>{message && <div className="form-message" role="status">{message}</div>}<div className="media-grid">{images.map((item) => <article key={item.id}><img src={item.previewUrl} alt={`Vista previa de ${item.originalName}`} /><div><strong>{item.originalName}</strong><span>{formatBytes(item.originalBytes)} → {formatBytes(item.file.size)}</span><small>{item.width} × {item.height} px · WebP</small></div><button aria-label={`Quitar ${item.originalName}`} onClick={() => remove(item.id)} type="button"><Trash2 size={16} /></button></article>)}</div>{images.length > 0 && <p className="media-ready">{images.length} de {maxImages} {maxImages === 1 ? "imagen nueva lista" : "imágenes nuevas listas"}.</p>}{required && images.length === 0 && <p className="media-required">Agregá al menos una foto clara del animal.</p>}</div>;
}
