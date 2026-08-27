"use client";

import { BellRing, Crosshair, Eye, Phone, ShieldCheck, Smartphone, X } from "lucide-react";
import { FormEvent, useState } from "react";

type Props = {
  petPostId: string;
  petName: string;
  publisherName: string;
  hasPublicWhatsapp: boolean;
};

type Coordinates = { latitude: number; longitude: number } | null;

export function CaseSightingReport({ petPostId, petName, publisherName, hasPublicWhatsapp }: Props) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"sighting" | "sheltered">("sighting");
  const [coordinates, setCoordinates] = useState<Coordinates>(null);
  const [locationState, setLocationState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationState("error");
      return;
    }
    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationState("ready");
      },
      () => setLocationState("error"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSubmitting(true);
    setFeedback(null);
    const form = new FormData(formElement);
    const payload = {
      pet_post_id: petPostId,
      alert_kind: kind,
      location_text: String(form.get("location_text") ?? "").trim(),
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      message: String(form.get("message") ?? "").trim(),
      contact_phone: String(form.get("contact_phone") ?? "").trim(),
      contact_social: String(form.get("contact_social") ?? "").trim(),
    };

    try {
      const response = await fetch("/api/pet-sighting-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "No se pudo enviar el aviso.");
      setFeedback({ type: "success", message: result.message || `El aviso llegó a ${publisherName}.` });
      formElement.reset();
      setCoordinates(null);
      setLocationState("idle");
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "No se pudo enviar el aviso." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="sighting-report-card">
      <div className="sighting-report-intro">
        <span className="sighting-report-icon"><BellRing /></span>
        <div>
          <strong>¿Lo viste o lo tenés a resguardo?</strong>
          <span>{hasPublicWhatsapp ? "También podés enviar un aviso privado con ubicación y detalles." : "Avisale directamente a quien lo está buscando, aunque no haya publicado su teléfono."}</span>
        </div>
        <button className="button button-primary" type="button" onClick={() => { setOpen(true); setFeedback(null); }}>Informar ahora</button>
      </div>

      {open && <div className="sighting-report-modal" role="dialog" aria-modal="true" aria-labelledby="sighting-report-title">
        <button className="sighting-report-backdrop" type="button" aria-label="Cerrar formulario" onClick={() => setOpen(false)} />
        <div className="sighting-report-dialog">
          <header>
            <div><span>Ayudá a que vuelva a casa</span><h2 id="sighting-report-title">Informar sobre {petName}</h2></div>
            <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)}><X /></button>
          </header>

          {feedback?.type === "success" ? <div className="sighting-report-success"><BellRing /><strong>Aviso enviado</strong><p>{feedback.message}</p><button className="button button-primary" type="button" onClick={() => setOpen(false)}>Cerrar</button></div> : <form onSubmit={submit}>
            <fieldset className="sighting-kind-picker">
              <legend>¿Qué pasó?</legend>
              <label className={kind === "sighting" ? "active" : ""}><input type="radio" name="alert_kind" value="sighting" checked={kind === "sighting"} onChange={() => setKind("sighting")} /><Eye /><span><strong>Lo vi</strong><small>Fue un avistamiento</small></span></label>
              <label className={kind === "sheltered" ? "active" : ""}><input type="radio" name="alert_kind" value="sheltered" checked={kind === "sheltered"} onChange={() => setKind("sheltered")} /><ShieldCheck /><span><strong>Lo tengo a resguardo</strong><small>Está conmigo o en un lugar seguro</small></span></label>
            </fieldset>

            <div className="sighting-form-grid">
              <label className="form-wide"><span>¿Dónde fue?</span><input name="location_text" minLength={3} maxLength={180} required placeholder="Calle, esquina, barrio o referencia" /></label>
              <div className="sighting-location-control form-wide"><button type="button" onClick={requestLocation} disabled={locationState === "loading"}><Crosshair />{locationState === "loading" ? "Buscando ubicación…" : locationState === "ready" ? "Ubicación agregada" : "Agregar mi ubicación actual"}</button><small>{locationState === "ready" ? "Solo la verá la persona que publicó el caso." : locationState === "error" ? "No pudimos obtenerla. Podés describir el lugar arriba." : "Es opcional y ayuda a señalar el punto exacto de forma privada."}</small></div>
              <label className="form-wide"><span>Descripción del avistamiento</span><textarea name="message" minLength={8} maxLength={1200} required rows={4} placeholder="Contá qué viste, dónde estaba y cualquier detalle útil para encontrarlo" /></label>
              <label><span><Phone /> Teléfono o WhatsApp</span><input name="contact_phone" inputMode="tel" maxLength={30} placeholder="Opcional" /></label>
              
            </div>
            <p className="sighting-contact-note">Si lo tenés a resguardo, necesitás dejar teléfono o red social para poder coordinar. En un avistamiento son opcionales.</p>
            {feedback?.type === "error" && <p className="sighting-report-error">{feedback.message}</p>}
            <div className="sighting-report-actions"><button className="button button-light" type="button" onClick={() => setOpen(false)}>Cancelar</button><button className="button button-primary" type="submit" disabled={submitting}>{submitting ? "Enviando…" : "Enviar aviso"}</button></div>
          </form>}
        </div>
      </div>}
    </section>
  );
}
