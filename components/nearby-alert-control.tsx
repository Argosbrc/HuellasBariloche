"use client";

import { BellRing, CheckCircle2, Crosshair, LoaderCircle, MapPin, ShieldCheck, Smartphone, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NearbyAlertPreferences } from "@/lib/types";

type State = "idle" | "locating" | "saving" | "success" | "error";

export function NearbyAlertControl({ initial }: { initial: NearbyAlertPreferences }) {
  const router = useRouter();
  const [radius, setRadius] = useState<3 | 5>(initial.radius_km === 5 ? 5 : 3);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function activate() {
    if (!navigator.geolocation) {
      setState("error");
      setMessage("Este dispositivo no permite obtener la ubicación.");
      return;
    }
    setState("locating");
    setMessage("Buscando tu ubicación actual…");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      setState("saving");
      setMessage("Guardando tu zona de alerta…");
      const { error } = await createClient().rpc("set_my_nearby_alert_preferences_v1", {
        p_enabled: true,
        p_radius_km: radius,
        p_exact_latitude: coords.latitude,
        p_exact_longitude: coords.longitude,
      });
      if (error) {
        setState("error");
        setMessage(error.message || "No pudimos activar las alertas.");
        return;
      }
      setEnabled(true);
      setState("success");
      setMessage(`Alertas activas en un radio de ${radius} km.`);
      router.refresh();
    }, () => {
      setState("error");
      setMessage("No pudimos acceder a tu ubicación. Revisá el permiso del navegador e intentá nuevamente.");
    }, { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 });
  }

  async function deactivate() {
    setState("saving");
    setMessage("Desactivando alertas…");
    const { error } = await createClient().rpc("set_my_nearby_alert_preferences_v1", {
      p_enabled: false,
      p_radius_km: radius,
      p_exact_latitude: null,
      p_exact_longitude: null,
    });
    if (error) {
      setState("error");
      setMessage(error.message || "No pudimos desactivar las alertas.");
      return;
    }
    setEnabled(false);
    setState("success");
    setMessage("Las alertas cercanas quedaron desactivadas y borramos el punto guardado.");
    router.refresh();
  }

  const busy = state === "locating" || state === "saving";

  return <section className={`nearby-alert-card ${enabled ? "enabled" : ""}`} id="alertas-cercanas">
    <div className="nearby-alert-intro">
      <span className="nearby-alert-icon">{busy ? <LoaderCircle className="spin" /> : enabled ? <BellRing /> : <Crosshair />}</span>
      <div>
        <span className="section-kicker">Red de cuidado cercana</span>
        <h2>Enterate si se pierde una mascota cerca tuyo</h2>
        <p>Elegí 3 o 5 km. Guardamos un único punto privado para calcular cercanía; nunca registramos tus movimientos.</p>
      </div>
    </div>

    <div className="nearby-alert-settings">
      <div className="radius-choice" role="radiogroup" aria-label="Radio de alertas">
        {[3, 5].map((value) => <button aria-pressed={radius === value} className={radius === value ? "active" : ""} disabled={busy} key={value} onClick={() => setRadius(value as 3 | 5)} type="button"><strong>{value} km</strong><small>{value === 3 ? "Mi barrio" : "Zona amplia"}</small></button>)}
      </div>
      {enabled
        ? <button className="button button-light" disabled={busy} onClick={deactivate} type="button"><X />Desactivar</button>
        : <button className="button button-primary" disabled={busy} onClick={activate} type="button"><MapPin />Usar mi ubicación y activar</button>}
    </div>

    <div className="nearby-alert-privacy"><ShieldCheck /><span><strong>Ubicación protegida</strong><small>Solo se usa para comparar distancias. Al desactivar, el punto se elimina.</small></span><Smartphone /></div>
    {message && <p className={`nearby-alert-message ${state}`} role="status">{state === "success" && <CheckCircle2 />}{message}</p>}

    {initial.nearby_cases.length > 0 && <div className="nearby-current-cases">
      <strong>{initial.nearby_cases.length === 1 ? "Hay 1 búsqueda activa cerca" : `Hay ${initial.nearby_cases.length} búsquedas activas cerca`}</strong>
      <div>{initial.nearby_cases.slice(0, 4).map((item) => <Link href={`/casos/${item.id}`} key={item.id}>{item.photo_url ? <img src={item.photo_url} alt="" /> : <span><MapPin /></span>}<div><b>{item.name || "Mascota perdida"}</b><small>{item.zone_name || "Zona cercana"} · {item.distance_m < 1000 ? `${item.distance_m} m` : `${(item.distance_m / 1000).toFixed(1)} km`}</small></div></Link>)}</div>
    </div>}
  </section>;
}
