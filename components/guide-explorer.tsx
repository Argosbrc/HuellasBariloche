"use client";

import {
  Clock3,
  ExternalLink,
  Home,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  Stethoscope,
  Store,
  Truck,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { PublicService } from "@/lib/types";

function hoursLabel(hours: unknown) {
  if (hours && typeof hours === "object" && "display" in hours) {
    const display = String((hours as { display?: unknown }).display ?? "").trim();
    if (display) return display;
  }
  return "Consultar horarios";
}

function externalHref(value: string | null) {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : null;
}

export function GuideExplorer({ services }: { services: PublicService[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const categories = useMemo(() => Array.from(new Map(services.map((service) => [service.category_slug, service.category_name])).entries()), [services]);
  const filtered = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return services.filter((service) => {
      const matchesQuery = !clean || [
        service.name,
        service.summary,
        service.address,
        service.neighborhood,
        service.category_name,
        ...(service.specializations || []),
        ...(service.product_types || []),
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(clean));
      const matchesCategory = category === "all" || service.category_slug === category;
      const matchesEmergency = !emergencyOnly || service.is_emergency || service.is_24_hours || service.has_on_call;
      return matchesQuery && matchesCategory && matchesEmergency;
    });
  }, [services, query, category, emergencyOnly]);

  return (
    <>
      <div className="guide-toolbar">
        <label className="guide-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar veterinaria, alimento, guardia…" /></label>
        <select aria-label="Filtrar por categoría" value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Todas las categorías</option>{categories.map(([slug, name]) => <option key={slug} value={slug}>{name}</option>)}</select>
        <label className="guide-emergency"><input type="checkbox" checked={emergencyOnly} onChange={(event) => setEmergencyOnly(event.target.checked)} /><span>Guardias y 24 h</span></label>
      </div>

      <div className="results-heading guide-results-heading"><div><strong>{filtered.length} lugares encontrados</strong><span className="verified-copy"><ShieldCheck size={14} />Información cargada por administración.</span></div></div>

      {filtered.length ? <div className="guide-grid">{filtered.map((service) => {
        const cover = service.cover_image_path?.startsWith("https://") ? service.cover_image_path : null;
        const tags = [
          service.home_visit ? "A domicilio" : null,
          service.delivery_available ? "Envíos" : null,
          ...(service.specializations || []).slice(0, 2),
          ...(service.product_types || []).slice(0, 2),
        ].filter(Boolean) as string[];
        const website = externalHref(service.website);
        const instagram = externalHref(service.instagram);
        return <article className="guide-card" key={service.id}>
          {cover ? <img src={cover} alt={service.name} /> : <div className="guide-card-placeholder"><Store /></div>}
          <div className="guide-card-copy">
            <div className="service-name-row"><span className="service-category">{service.category_name}</span>{(service.is_emergency || service.is_24_hours || service.has_on_call) && <span className="emergency-chip">{service.is_24_hours ? "24 horas" : "Guardia"}</span>}</div>
            <h2>{service.name}</h2>
            <p>{service.summary || service.description || "Información de contacto y atención disponible."}</p>
            {tags.length > 0 && <div className="useful-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
            <div className="service-info">
              <span><MapPin size={13} />{[service.address, service.neighborhood].filter(Boolean).join(" · ") || service.city_name}</span>
              <span><Clock3 size={13} />{service.is_24_hours ? "Abierto 24 horas" : hoursLabel(service.opening_hours)}</span>
              {service.home_visit && <span><Home size={13} />Atención a domicilio</span>}
              {service.delivery_available && <span><Truck size={13} />Realiza envíos</span>}
            </div>
            <details className="useful-details">
              <summary>Ver toda la información</summary>
              <div>
                {service.specializations?.length > 0 && <p><strong>Especializaciones:</strong> {service.specializations.join(", ")}</p>}
                {service.product_types?.length > 0 && <p><strong>Productos:</strong> {service.product_types.join(", ")}</p>}
                {service.payment_methods?.length > 0 && <p><strong>Medios de pago:</strong> {service.payment_methods.join(", ")}</p>}
                {service.useful_notes && <p>{service.useful_notes}</p>}
                {service.emergency_phone && <a href={`tel:${service.emergency_phone}`}><Phone size={13} />Guardia: {service.emergency_phone}</a>}
                {website && <a href={website} target="_blank" rel="noreferrer"><ExternalLink size={13} />Sitio web</a>}
                {instagram && <a href={instagram} target="_blank" rel="noreferrer"><ExternalLink size={13} />Instagram</a>}
                {!instagram && service.instagram && <span>Instagram: {service.instagram}</span>}
                {service.facebook && <span>Facebook: {service.facebook}</span>}
                {service.tiktok && <span>TikTok: {service.tiktok}</span>}
              </div>
            </details>
            <div className="service-card-actions">{service.phone && <a className="button button-light" href={`tel:${service.phone}`}><Phone size={14} />Llamar</a>}{service.whatsapp && <a className="button button-primary" href={`https://wa.me/${service.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"><MessageCircle size={14} />WhatsApp</a>}</div>
          </div>
        </article>;
      })}</div> : <div className="empty-state"><Stethoscope size={36} /><strong>No encontramos lugares con esos filtros</strong><span>Probá otra búsqueda o categoría.</span></div>}
    </>
  );
}
