"use client";

import {
  CalendarDays,
  CircleHelp,
  Lightbulb,
  LoaderCircle,
  PackageOpen,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { MediaPicker } from "@/components/media-picker";
import { discardUserImages, uploadUserImages, type UploadedPublicImage } from "@/lib/media/upload";
import type { PreparedImage } from "@/lib/media/prepare-image";

const publicationTypes = [
  { value: "question", label: "Pedir ayuda", description: "Alimento, traslado, medicación o una mano puntual.", Icon: CircleHelp },
  { value: "event", label: "Convocar", description: "Jornada, colecta, búsqueda o actividad comunitaria.", Icon: CalendarDays },
  { value: "recommendation", label: "Ofrecer algo", description: "Medicamentos, cuchas, alimento u otros recursos.", Icon: PackageOpen },
  { value: "tip", label: "Dato útil", description: "Información que pueda ayudar a otros vecinos.", Icon: Lightbulb },
] as const;

function formText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function CommunityPostForm({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [postType, setPostType] = useState("question");
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [uploaded, setUploaded] = useState<UploadedPublicImage[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleImages = useCallback((next: PreparedImage[]) => {
    setImages(next);
    setUploaded(null);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setMessage("Preparando tu publicación…");
    let uploadedNow = uploaded;

    try {
      if (images.length && !uploadedNow) {
        uploadedNow = await uploadUserImages({ purpose: "community", images });
        setUploaded(uploadedNow);
      }
      const eventValue = formText(form, "event_at");
      const response = await fetch("/api/community-posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          postType,
          body: formText(form, "body"),
          placeName: formText(form, "place_name"),
          eventAt: postType === "event" && eventValue ? new Date(eventValue).toISOString() : null,
          photos: (uploadedNow ?? []).map((item) => ({
            url: item.url,
            width: item.width,
            height: item.height,
            size: item.size,
          })),
        }),
      });
      const result = await response.json().catch(() => ({})) as { id?: string; error?: string };
      if (!response.ok || !result.id) {
        if (uploadedNow?.length) {
          try { await discardUserImages(uploadedNow.map((item) => item.id)); } catch { /* La limpieza queda inventariada. */ }
        }
        setUploaded(null);
        throw new Error(result.error || "No se pudo publicar en Comunidad.");
      }
      router.push(`/comunidad#publicacion-${result.id}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo publicar en Comunidad.");
      setSubmitting(false);
    }
  }

  return <form className="community-publish-form" onSubmit={submit}>
    <section className="publish-section">
      <header><span>1</span><div><h2>¿Qué querés compartir?</h2><p>Elegí una categoría para que otros encuentren rápido cómo ayudar.</p></div></header>
      <div className="community-type-grid">
        {publicationTypes.map(({ value, label, description, Icon }) => <label className={postType === value ? "selected" : ""} key={value}><input checked={postType === value} name="post_type" onChange={() => setPostType(value)} type="radio" value={value} /><Icon /><strong>{label}</strong><small>{description}</small></label>)}
      </div>
    </section>

    <section className="publish-section">
      <header><span>2</span><div><h2>Información clara y concreta</h2><p>Contá qué necesitás, qué ofrecés o cómo puede sumarse la gente.</p></div></header>
      <div className="publish-fields">
        <label className="form-wide">Publicación<textarea maxLength={3000} minLength={10} name="body" placeholder={postType === "question" ? "Ej.: Necesitamos alimento renal para un perro rescatado…" : postType === "recommendation" ? "Ej.: Ofrezco una cucha grande en buen estado…" : "Escribí todos los datos necesarios…"} required rows={7} /></label>
        <label>Lugar o barrio <small>opcional</small><input maxLength={160} minLength={2} name="place_name" placeholder="Ej.: Melipal" /></label>
        {postType === "event" ? <label>Fecha y hora <small>opcional</small><input name="event_at" type="datetime-local" /></label> : <div className="community-form-note"><ShieldCheck size={17} /><span><strong>Contacto protegido</strong><small>Coordiná por la comunidad sin publicar datos sensibles dentro del texto.</small></span></div>}
      </div>
    </section>

    <section className="publish-section">
      <header><span>3</span><div><h2>Foto <small>opcional</small></h2><p>Podés mostrar el medicamento, la cucha, el alimento o una imagen de la actividad.</p></div></header>
      <MediaPicker onChange={handleImages} />
    </section>

    <section className="publish-section community-confirm-section">
      <label className="publish-check"><input name="confirm_truth" required type="checkbox" /><span><strong>Confirmo que la información es verdadera y está vigente</strong><small>Si deja de estar disponible, podré retirar la publicación desde mi cuenta.</small></span></label>
      <div className="community-author-note"><ShieldCheck /><span><strong>Publicás como {displayName}</strong><small>La publicación queda vinculada a tu cuenta y puede ser moderada.</small></span></div>
    </section>

    {message && <div className={submitting ? "publish-message" : "publish-message error"} role="status">{message}</div>}
    <div className="publish-submit"><div><ShieldCheck /><span><strong>Comunidad cuidada</strong><small>Las imágenes y el contenido se validan antes de quedar visibles.</small></span></div><button className="button button-primary button-large" disabled={submitting} type="submit">{submitting ? <><LoaderCircle className="spin" />Publicando…</> : "Publicar en Comunidad"}</button></div>
  </form>;
}
