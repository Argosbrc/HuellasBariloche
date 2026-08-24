"use client";

import {
  BadgeCheck,
  Copy,
  ExternalLink,
  Gift,
  HeartHandshake,
  Mail,
  MapPin,
  MessageCircle,
  PawPrint,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { PublicRescuer } from "@/lib/types";

function href(value: string | null) {
  return value && /^https?:\/\//i.test(value) ? value : null;
}

export function RescuerDirectory({ rescuers }: { rescuers: PublicRescuer[] }) {
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return rescuers;
    return rescuers.filter((rescuer) => [
      rescuer.organization_name,
      rescuer.display_name,
      rescuer.description,
      rescuer.contact_area,
      rescuer.city_name,
      ...(rescuer.current_needs || []),
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(clean)));
  }, [query, rescuers]);

  async function copyAlias(id: string, alias: string) {
    await navigator.clipboard.writeText(alias);
    setCopied(id);
    window.setTimeout(() => setCopied((current) => current === id ? null : current), 1800);
  }

  return (
    <>
      <div className="rescuer-toolbar">
        <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, zona o necesidad" /></label>
        <span><BadgeCheck size={16} />Solo perfiles aprobados</span>
      </div>

      <div className="results-heading rescuer-results"><div><strong>{filtered.length} rescatistas y organizaciones</strong><span>Contactá y colaborá de forma directa.</span></div></div>

      {filtered.length ? <div className="rescuer-directory-list">{filtered.map((rescuer) => {
        const social = href(rescuer.social_url);
        const website = href(rescuer.website);
        return <article className="rescuer-public-card" key={rescuer.id}>
          <div className="rescuer-public-visual">
            {rescuer.avatar_url ? <img src={rescuer.avatar_url} alt={`Imagen de ${rescuer.organization_name}`} /> : <span><HeartHandshake /></span>}
            <i><BadgeCheck size={16} />Verificado</i>
          </div>

          <div className="rescuer-public-main">
            <header><div><span>Rescatista u organización</span><h2>{rescuer.organization_name}</h2></div><HeartHandshake /></header>
            <p>{rescuer.description || "Perfil verificado por Huellas Bariloche."}</p>
            <div className="rescuer-public-facts">
              <span><MapPin size={15} /><strong>Zona</strong>{rescuer.contact_area || rescuer.city_name}</span>
              <span><PawPrint size={15} /><strong>Adopciones activas</strong>{rescuer.adoption_count}</span>
            </div>
            <details className="rescuer-more"><summary>Más información</summary><div><p><strong>Responsable:</strong> {rescuer.display_name}</p>{social && <a href={social} target="_blank" rel="noreferrer"><ExternalLink size={14} />Red social principal</a>}{website && <a href={website} target="_blank" rel="noreferrer"><ExternalLink size={14} />Sitio web</a>}{rescuer.instagram && <span>Instagram: {rescuer.instagram}</span>}{rescuer.facebook && <span>Facebook: {rescuer.facebook}</span>}</div></details>
          </div>

          <aside className="rescuer-donation-panel">
            <span className="donation-kicker"><Gift size={15} />Donaciones</span>
            {rescuer.current_needs?.length > 0 ? <div className="need-chips">{rescuer.current_needs.map((need) => <span key={need}>{need}</span>)}</div> : <p>Consultá directamente qué necesitan en este momento.</p>}
            {rescuer.donation_note && <p>{rescuer.donation_note}</p>}
            {rescuer.donation_alias && <div className="alias-box"><small>Alias</small><strong>{rescuer.donation_alias}</strong><button type="button" onClick={() => copyAlias(rescuer.id, rescuer.donation_alias!)}><Copy size={14} />{copied === rescuer.id ? "Copiado" : "Copiar"}</button></div>}
            <div className="rescuer-contact-actions">
              {rescuer.public_phone && <a className="button button-primary" href={`https://wa.me/${rescuer.public_phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle size={15} />Contactar</a>}
              {rescuer.public_email && <a className="button button-light" href={`mailto:${rescuer.public_email}`}><Mail size={15} />Correo</a>}
            </div>
          </aside>
        </article>;
      })}</div> : <div className="empty-state"><HeartHandshake size={36} /><strong>No encontramos perfiles con esa búsqueda</strong><span>Probá con otra zona, nombre o necesidad.</span></div>}
    </>
  );
}
