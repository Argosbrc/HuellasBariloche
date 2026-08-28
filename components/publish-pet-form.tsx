"use client";

import {
  CalendarClock,
  CheckCircle2,
  HeartHandshake,
  Home,
  LoaderCircle,
  LocateFixed,
  MapPin,
  PawPrint,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { MediaPicker } from "@/components/media-picker";
import { discardUserImages, uploadUserImages, type UploadedPublicImage } from "@/lib/media/upload";
import type { PreparedImage } from "@/lib/media/prepare-image";

type LocationState = { latitude: number; longitude: number; accuracy: number } | null;

function localDateTime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function PublishPetForm({
  canPublishAdoption,
  hasWhatsapp,
}: {
  canPublishAdoption: boolean;
  hasWhatsapp: boolean;
}) {
  const router = useRouter();
  const requestId = useRef(crypto.randomUUID());
  const [postType, setPostType] = useState("lost");
  const [needsTransit, setNeedsTransit] = useState(false);
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [location, setLocation] = useState<LocationState>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"error" | "info">("info");
  const [uploaded, setUploaded] = useState<UploadedPublicImage[] | null>(null);

  const handleImages = useCallback((next: PreparedImage[]) => {
    setImages(next);
    setUploaded(null);
  }, []);

  function findLocation() {
    if (!navigator.geolocation) {
      setMessageKind("error");
      setMessage("Este navegador no permite obtener la ubicación. Necesitás habilitar la ubicación para publicar un caso perdido o encontrado.");
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
        setMessageKind("error");
        setMessage("No pudimos obtener la ubicación. Podés continuar indicando el barrio o habilitar el permiso del navegador.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  async function sendPublication(payload: Record<string, unknown>) {
    const response = await fetch("/api/pet-posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({})) as { id?: string; error?: string };
    return { response, result };
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!images.length) {
      setMessageKind("error");
      setMessage("Agregá al menos una foto antes de publicar.");
      return;
    }

    const form = new FormData(event.currentTarget);

    const name = formText(form, "name");
    const species = formText(form, "species");
    const sex = formText(form, "sex");
    const description = formText(form, "description");
    const zoneName = formText(form, "zone_name");
    const eventAt = formText(form, "event_at");

    if (postType === "lost") {
      if (!name || !species || !sex || !description) {
        setMessageKind("error");
        setMessage("Para una mascota perdida completá nombre, especie, sexo y descripción.");
        return;
      }
    }

    if (postType === "found") {
      if (!species || !description) {
        setMessageKind("error");
        setMessage("Para una mascota encontrada completá especie y descripción.");
        return;
      }
    }

    if (postType !== "adoption" && (!zoneName || !eventAt)) {
      setMessageKind("error");
      setMessage("Completá la zona y la fecha/hora del lugar donde ocurrió.");
      return;
    }

    if (postType === "adoption" && !canPublishAdoption) {
      setMessageKind("error");
      setMessage("Tu cuenta todavía no está verificada como rescatista.");
      return;
    }
    // La ubicación ya no bloquea la publicación.
    // Si el usuario agrega ubicación del dispositivo se guardan coordenadas
    // para proximidad; si no, la publicación continúa con la zona/barrio.

    // React only guarantees currentTarget while the submit handler is running
    // synchronously. Capture the form before uploading images, since the first
    // await can leave event.currentTarget as null in the browser.
    setSubmitting(true);
    setMessageKind("info");
    setMessage("Preparando la publicación y sus imágenes…");
    let uploadedNow = uploaded;

    try {
      if (!uploadedNow) {
        uploadedNow = await uploadUserImages({ purpose: "pet_post", images });
        setUploaded(uploadedNow);
      }

      const payload = {
        requestId: requestId.current,
        postType,
        name: formText(form, "name"),
        species: formText(form, "species"),
        breed: formText(form, "breed"),
        sex: formText(form, "sex"),
        ageLabel: formText(form, "age_label"),
        sizeLabel: formText(form, "size_label"),
        description: formText(form, "description"),
        adoptionRequirements: formText(form, "adoption_requirements"),
        photoUrls: uploadedNow.map((item) => item.url),
        zoneName: formText(form, "zone_name"),
        exactLatitude: location?.latitude ?? null,
        exactLongitude: location?.longitude ?? null,
        addressNotes: formText(form, "address_notes"),
        showWhatsapp: form.get("show_whatsapp") === "on",
        eventAt: formText(form, "event_at") ? new Date(formText(form, "event_at")).toISOString() : null,
        needsTransit: postType === "adoption" && needsTransit,
        transitRequirements: postType === "adoption" && needsTransit ? formText(form, "transit_requirements") : "",
      };

      let outcome;
      try {
        outcome = await sendPublication(payload);
      } catch {
        // El mismo requestId hace seguro un segundo intento si la primera
        // respuesta se perdio despues de confirmar la transaccion.
        outcome = await sendPublication(payload);
      }

      if (!outcome.response.ok || !outcome.result.id) {
        try { await discardUserImages(uploadedNow.map((item) => item.id)); } catch { /* La base conserva el inventario para revision. */ }
        setUploaded(null);
        requestId.current = crypto.randomUUID();
        throw new Error(outcome.result.error || "No se pudo crear la publicación.");
      }

      setMessage("Publicación creada. Te llevamos a tu panel…");
      router.push(`/panel?ok=${encodeURIComponent("La publicación quedó activa y visible.")}`);
      router.refresh();
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "No se pudo crear la publicación.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="publish-form" onSubmit={submit}>
      <section className="publish-section">
        <header><span>1</span><div><h2>¿Qué pasó?</h2><p>Elegí el tipo correcto para activar el estado y los permisos correspondientes.</p></div></header>
        <div className="publish-type-grid" role="radiogroup" aria-label="Tipo de publicación">
          <label className={postType === "lost" ? "selected" : ""}><input checked={postType === "lost"} name="post_type" onChange={() => { setPostType("lost"); setNeedsTransit(false); }} type="radio" value="lost" /><PawPrint /><strong>Está perdido</strong><span>Busco a mi mascota.</span></label>
          <label className={postType === "found" ? "selected" : ""}><input checked={postType === "found"} name="post_type" onChange={() => { setPostType("found"); setNeedsTransit(false); }} type="radio" value="found" /><MapPin /><strong>Lo encontré</strong><span>Está visto o a resguardo.</span></label>
          <label className={`${postType === "adoption" ? "selected" : ""} ${!canPublishAdoption ? "locked" : ""}`}><input checked={postType === "adoption"} disabled={!canPublishAdoption} name="post_type" onChange={() => setPostType("adoption")} type="radio" value="adoption" /><HeartHandshake /><strong>Busca adopción</strong><span>{canPublishAdoption ? "Perfil rescatista verificado." : "Solo rescatistas verificados."}</span></label>
        </div>
      </section>

      <section className="publish-section">
        <header><span>2</span><div><h2>Datos del animal</h2><p>La información concreta ayuda a reconocerlo y evita confusiones.</p></div></header>
        <div className="publish-fields">
          <label>Nombre {postType === "found" && <small>opcional</small>}<input maxLength={80} name="name" required={postType !== "found"} /></label>
          <label>Especie<select name="species" required defaultValue="Perro"><option>Perro</option><option>Gato</option><option>Ave</option><option>Otro</option></select></label>
          <label>Raza <small>opcional</small><input maxLength={80} name="breed" /></label>
          <label>Sexo {postType === "lost" && <small>obligatorio</small>}<select name="sex" defaultValue="unknown" required={postType === "lost"}><option value="unknown">No se sabe</option><option value="male">Macho</option><option value="female">Hembra</option></select></label>
          <label>Edad aproximada <small>opcional</small><input maxLength={60} name="age_label" placeholder="Ej.: 3 años" /></label>
          <label>Tamaño<select name="size_label" defaultValue="Mediano"><option>Pequeño</option><option>Mediano</option><option>Grande</option><option>No se sabe</option></select></label>
          <label className="form-wide">Colores o marcas <small>separados por coma</small><input maxLength={300} name="colors" placeholder="Ej.: negro, pecho blanco, patas marrones" /></label>
          <label className="form-wide">Señas particulares <small>opcional</small><textarea maxLength={1200} minLength={3} name="distinctive_features" rows={3} placeholder="Collar, cicatriz, mancha, forma de las orejas…" /></label>
          <label className="form-wide">Descripción<textarea maxLength={3000} minLength={10} name="description" required rows={5} placeholder={postType === "lost" ? "Contá cómo ocurrió la pérdida y datos que ayuden a reconocerlo." : "Contá dónde apareció, su estado y cualquier dato útil."} /></label>
          <label className="form-wide">Estado de salud <small>opcional</small><textarea maxLength={1000} minLength={2} name="health_status" rows={3} /></label>
          {postType === "adoption" && <>
            <label className="form-wide">Condiciones para adoptar<textarea maxLength={2000} minLength={10} name="adoption_requirements" required rows={4} placeholder="Tipo de hogar, seguimiento, convivencia y requisitos." /></label>
            <div className={`transit-publish-box form-wide ${needsTransit ? "selected" : ""}`}>
              <label className="publish-check">
                <input checked={needsTransit} onChange={(event) => setNeedsTransit(event.target.checked)} type="checkbox" />
                <span><strong><Home size={17} />Necesita hogar de tránsito</strong><small>La búsqueda aparecerá en el portal de tránsitos para que colaboradores puedan ofrecer un espacio temporal.</small></span>
              </label>
              {needsTransit && <label>¿Qué hogar temporal necesita?<textarea maxLength={1200} minLength={10} name="transit_requirements" required rows={4} placeholder="Por cuánto tiempo, convivencia con otros animales, medicación, patio o cuidados especiales." /></label>}
            </div>
          </>}
        </div>
      </section>

      <section className="publish-section">
        <header><span>3</span><div><h2>Fotos</h2><p>Se optimizan antes de salir de tu dispositivo y se almacenan en ImageKit.</p></div></header>
        <MediaPicker onChange={handleImages} required />
      </section>

      <section className="publish-section" key={postType === "adoption" ? "adoption-location" : "case-location"}>
        <header><span>4</span><div><h2>Lugar y momento {postType === "adoption" && <small>opcional</small>}</h2><p>{postType === "adoption" ? "Si el animal está a resguardo, podés omitir dónde y cuándo fue encontrado." : "La ubicación ayuda a encontrar coincidencias. La comunidad verá solo una aproximación protegida."}</p></div></header>
        <div className="publish-fields">
          <label>Zona o barrio {postType === "adoption" && <small>opcional</small>}<input maxLength={120} minLength={2} name="zone_name" placeholder="Ej.: Melipal" required={postType !== "adoption"} /></label>
          <label>Fecha y hora {postType === "adoption" && <small>opcional</small>}<span className="input-icon"><CalendarClock size={16} /><input defaultValue={postType === "adoption" ? undefined : localDateTime()} max={localDateTime()} name="event_at" required={postType !== "adoption"} type="datetime-local" /></span></label>
          <label className="form-wide">Referencia privada <small>opcional, no se muestra públicamente</small><input maxLength={500} name="address_notes" placeholder="Calle, altura o referencia para coordinar." /></label>
        </div>
        <div className="location-control">
          <div><ShieldCheck /><span><strong>Privacidad geográfica</strong><small>La coordenada exacta queda protegida en Supabase. El sitio publica una aproximación redondeada.</small></span></div>
          {location ? <button className="button button-light location-ready" onClick={() => setLocation(null)} type="button"><CheckCircle2 />Ubicación agregada · quitar</button> : <button className="button button-light" disabled={locating} onClick={findLocation} type="button">{locating ? <LoaderCircle className="spin" /> : <LocateFixed />}Agregar mi ubicación actual</button>}
          {location && <small className="location-accuracy">Precisión informada por el dispositivo: aproximadamente {Math.round(location.accuracy)} m.</small>}
        </div>
      </section>

      <section className="publish-section publish-contact-section">
        <header><span>5</span><div><h2>Contacto y confirmación</h2><p>Podés mostrar el WhatsApp guardado en tu perfil; nunca se escribe desde este formulario.</p></div></header>
        {hasWhatsapp ? <label className="publish-check"><input name="show_whatsapp" type="checkbox" /><span><strong>Mostrar mi WhatsApp en este caso</strong><small>La comunidad podrá contactarte por el número de tu perfil.</small></span></label> : <div className="publish-profile-warning"><span>No tenés un WhatsApp configurado.</span><Link href="/cuenta/perfil">Agregarlo en mi perfil</Link></div>}
        <label className="publish-check"><input name="confirm_truth" required type="checkbox" /><span><strong>Confirmo que la información es verdadera</strong><small>La publicación será visible de inmediato y podrá moderarse posteriormente.</small></span></label>
      </section>

      {message && <div className={messageKind === "error" ? "publish-message error" : "publish-message"} role="status">{message}</div>}
      <div className="publish-submit"><div><ShieldCheck /><span><strong>Publicación protegida</strong><small>Sesión, rol, imágenes, límites y ubicación se validan nuevamente en el servidor.</small></span></div><button className="button button-primary button-large" disabled={submitting} type="submit">{submitting ? <><LoaderCircle className="spin" />Publicando…</> : <>Publicar ahora<PawPrint /></>}</button></div>
    </form>
  );
}
