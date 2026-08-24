"use client";

import {
  CalendarClock,
  CheckCircle2,
  Image as ImageIcon,
  LoaderCircle,
  LocateFixed,
  MapPin,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { MediaPicker } from "@/components/media-picker";
import { discardUserImages, uploadUserImages, type UploadedPublicImage } from "@/lib/media/upload";
import type { PreparedImage } from "@/lib/media/prepare-image";
import type { EditablePetPost } from "@/lib/types";

type LocationState = { latitude: number; longitude: number; accuracy?: number } | null;

function formText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function EditPetPostForm({ post, hasWhatsapp }: { post: EditablePetPost; hasWhatsapp: boolean }) {
  const router = useRouter();
  const [existingPhotos, setExistingPhotos] = useState(post.photo_paths);
  const [newImages, setNewImages] = useState<PreparedImage[]>([]);
  const [location, setLocation] = useState<LocationState>(post.exact_latitude !== null && post.exact_longitude !== null
    ? { latitude: post.exact_latitude, longitude: post.exact_longitude }
    : null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const active = ["lost", "sighted", "found", "available"].includes(post.post_state);

  const handleImages = useCallback((images: PreparedImage[]) => setNewImages(images), []);

  function removeExistingPhoto(url: string) {
    setExistingPhotos((current) => current.filter((item) => item !== url));
  }

  function makeCover(url: string) {
    setExistingPhotos((current) => [url, ...current.filter((item) => item !== url)]);
  }

  function updateLocation() {
    if (!navigator.geolocation) {
      setMessage("Este navegador no permite obtener la ubicación. Podés conservar la actual o publicar solamente el barrio.");
      return;
    }
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy });
        setLocating(false);
      },
      () => {
        setMessage("No pudimos obtener la ubicación. Revisá el permiso del navegador e intentá nuevamente.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !active) return;
    if (existingPhotos.length + newImages.length < 1) {
      setMessage("El caso debe conservar al menos una fotografía.");
      return;
    }
    if (existingPhotos.length + newImages.length > 4) {
      setMessage("El caso admite hasta cuatro fotografías.");
      return;
    }

    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setMessage("Guardando los cambios…");
    let uploaded: UploadedPublicImage[] = [];

    try {
      if (newImages.length) uploaded = await uploadUserImages({ purpose: "pet_post", images: newImages });
      const eventValue = formText(form, "event_at");
      const response = await fetch(`/api/pet-posts/${post.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: formText(form, "name"),
          species: formText(form, "species"),
          breed: formText(form, "breed"),
          sex: formText(form, "sex"),
          ageLabel: formText(form, "age_label"),
          sizeLabel: formText(form, "size_label"),
          colors: formText(form, "colors").split(",").map((item) => item.trim()).filter(Boolean),
          distinctiveFeatures: formText(form, "distinctive_features"),
          description: formText(form, "description"),
          healthStatus: formText(form, "health_status"),
          adoptionRequirements: formText(form, "adoption_requirements"),
          photoUrls: [...existingPhotos, ...uploaded.map((item) => item.url)],
          zoneName: formText(form, "zone_name"),
          exactLatitude: location?.latitude ?? null,
          exactLongitude: location?.longitude ?? null,
          addressNotes: location ? formText(form, "address_notes") : "",
          showWhatsapp: hasWhatsapp && form.get("show_whatsapp") === "on",
          eventAt: eventValue ? new Date(eventValue).toISOString() : null,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo actualizar el caso.");
      router.push(`/panel/casos/${post.id}?ok=${encodeURIComponent("Los cambios quedaron guardados.")}`);
      router.refresh();
    } catch (error) {
      if (uploaded.length) {
        try { await discardUserImages(uploaded.map((item) => item.id)); } catch { /* El inventario permite revisar cualquier carga pendiente. */ }
      }
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el caso.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="case-editor-form" onSubmit={submit}>
      <section className="case-editor-section">
        <header><span>1</span><div><h2>Datos públicos</h2><p>Actualizá la información que ayuda a reconocer al animal.</p></div></header>
        <div className="publish-fields">
          <label>Nombre {post.post_type === "found" && <small>opcional</small>}<input defaultValue={post.name || ""} maxLength={80} name="name" required={post.post_type !== "found"} /></label>
          <label>Especie<select defaultValue={post.species} name="species" required><option>Perro</option><option>Gato</option><option>Ave</option><option>Otro</option></select></label>
          <label>Raza <small>opcional</small><input defaultValue={post.breed || ""} maxLength={80} name="breed" /></label>
          <label>Sexo<select defaultValue={post.sex || "unknown"} name="sex"><option value="unknown">No se sabe</option><option value="male">Macho</option><option value="female">Hembra</option></select></label>
          <label>Edad aproximada <small>opcional</small><input defaultValue={post.age_label || ""} maxLength={60} name="age_label" placeholder="Ej.: 3 años" /></label>
          <label>Tamaño<select defaultValue={post.size_label || "Mediano"} name="size_label"><option>Pequeño</option><option>Mediano</option><option>Grande</option><option>No se sabe</option></select></label>
          <label className="form-wide">Colores o marcas <small>separados por coma</small><input defaultValue={post.colors.join(", ")} maxLength={300} name="colors" /></label>
          <label className="form-wide">Señas particulares <small>opcional</small><textarea defaultValue={post.distinctive_features || ""} maxLength={1200} minLength={3} name="distinctive_features" rows={3} /></label>
          <label className="form-wide">Descripción<textarea defaultValue={post.description} maxLength={3000} minLength={10} name="description" required rows={5} /></label>
          <label className="form-wide">Estado de salud <small>opcional</small><textarea defaultValue={post.health_status || ""} maxLength={1000} minLength={2} name="health_status" rows={3} /></label>
          {post.post_type === "adoption" && <label className="form-wide">Condiciones para adoptar<textarea defaultValue={post.adoption_requirements || ""} maxLength={2000} minLength={10} name="adoption_requirements" required rows={4} /></label>}
        </div>
      </section>

      <section className="case-editor-section">
        <header><span>2</span><div><h2>Fotografías</h2><p>Elegí la portada, quitá imágenes antiguas o agregá nuevas.</p></div></header>
        <div className="case-existing-photos">
          {existingPhotos.map((url, index) => <article key={url}><img src={url} alt={`Foto ${index + 1} del caso`} /><span>{index === 0 ? <><Star />Portada</> : <><ImageIcon />Foto {index + 1}</>}</span><div>{index !== 0 && <button onClick={() => makeCover(url)} type="button"><Star />Usar de portada</button>}<button onClick={() => removeExistingPhoto(url)} type="button"><Trash2 />Quitar</button></div></article>)}
        </div>
        <MediaPicker maxImages={Math.max(0, 4 - existingPhotos.length)} onChange={handleImages} />
      </section>

      <section className="case-editor-section">
        <header><span>3</span><div><h2>Lugar y momento</h2><p>La ubicación exacta permanece privada; públicamente se muestra un punto aproximado.</p></div></header>
        <div className="publish-fields">
          <label>Zona o barrio {post.post_type === "adoption" && <small>opcional</small>}<input defaultValue={post.zone_name || ""} maxLength={120} minLength={2} name="zone_name" placeholder="Ej.: Centro, Melipal, Frutillar" required={post.post_type !== "adoption"} /></label>
          <label>Fecha y hora {post.post_type === "adoption" && <small>opcional</small>}<span className="input-icon"><CalendarClock size={16} /><input defaultValue={localDateTime(post.event_at)} name="event_at" required={post.post_type !== "adoption"} type="datetime-local" /></span></label>
          <label className="form-wide">Referencia privada <small>opcional</small><input defaultValue={post.address_notes || ""} maxLength={500} name="address_notes" /></label>
        </div>
        <div className="case-editor-location"><MapPin /><div><strong>{location ? "Ubicación privada guardada" : "Sin ubicación exacta"}</strong><span>{location ? `Latitud y longitud protegidas${location.accuracy ? ` · precisión aproximada ${Math.round(location.accuracy)} m` : ""}.` : "El caso puede continuar mostrando solamente el barrio."}</span></div><button className="button button-light" disabled={locating} onClick={updateLocation} type="button">{locating ? <LoaderCircle className="spin" /> : <LocateFixed />}{location ? "Actualizar GPS" : "Agregar GPS"}</button>{location && <button className="case-location-remove" onClick={() => setLocation(null)} type="button">Quitar</button>}</div>
      </section>

      <section className="case-editor-section case-editor-contact">
        <header><span>4</span><div><h2>Contacto</h2><p>Controlá si querés mostrar el WhatsApp guardado en tu perfil.</p></div></header>
        {hasWhatsapp ? <label className="publish-check"><input defaultChecked={post.show_whatsapp} name="show_whatsapp" type="checkbox" /><span><strong>Mostrar mi WhatsApp en este caso</strong><small>La comunidad podrá contactarte directamente desde la ficha.</small></span></label> : <p className="case-editor-warning">Primero agregá un WhatsApp desde “Mi perfil” para poder mostrarlo.</p>}
      </section>

      {message && <div className={message === "Guardando los cambios…" ? "publish-message" : "publish-message error"} role="status">{message}</div>}
      <div className="case-editor-submit"><span><ShieldCheck /><small>Los permisos, imágenes y datos se validan nuevamente antes de guardar.</small></span><button className="button button-primary button-large" disabled={submitting || !active} type="submit">{submitting ? <><LoaderCircle className="spin" />Guardando…</> : <><CheckCircle2 />Guardar cambios</>}</button></div>
    </form>
  );
}
