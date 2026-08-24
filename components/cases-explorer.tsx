"use client";

import { Cat, Dog, HeartHandshake, MapPin, PawPrint, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { PublicPetCase } from "@/lib/types";

type CaseWithImage = PublicPetCase & { imageUrl: string | null };

const filters = [
  ["all", "Todos"],
  ["lost", "Perdidos"],
  ["found", "Encontrados"],
  ["adoption", "Adopción"],
] as const;

function labelFor(type: string) {
  if (type === "lost") return "Perdido";
  if (type === "found") return "Encontrado";
  if (type === "adoption") return "Adopción";
  return type;
}

function accentFor(type: string) {
  if (type === "lost") return "coral";
  if (type === "found") return "sky";
  return "amber";
}

export function CasesExplorer({ cases }: { cases: CaseWithImage[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cases.filter((item) => {
      const matchesType = filter === "all" || item.post_type === filter;
      const haystack = [item.name, item.species, item.breed, item.zone_name, item.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return matchesType && (!needle || haystack.includes(needle));
    });
  }, [cases, filter, query]);

  return (
    <>
      <div className="directory-toolbar">
        <label className="search-field">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, raza o barrio" />
        </label>
        <div className="filter-row inner-filters" role="group" aria-label="Filtrar casos">
          {filters.map(([value, label]) => (
            <button className={filter === value ? "filter active" : "filter"} key={value} onClick={() => setFilter(value)} type="button">
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="inner-content">
        <div className="results-heading">
          <div><strong>{visible.length} casos visibles</strong><span>Ubicaciones públicas aproximadas.</span></div>
          <a href="/mapa"><MapPin size={15} />Ver en el mapa</a>
        </div>

        {visible.length ? (
          <div className="directory-grid">
            {visible.map((item) => {
              const Icon = item.species?.toLowerCase().includes("gat") ? Cat : Dog;
              const accent = accentFor(item.post_type);
              return (
                <article className="directory-card" id={`caso-${item.id}`} key={item.id}>
                  <div className={`directory-image case-${accent}`}>
                    {item.imageUrl ? <img className="card-photo" src={item.imageUrl} alt={item.name || "Mascota publicada"} loading="lazy" decoding="async" /> : <Icon size={86} strokeWidth={1.2} />}
                    <span className={`status status-${accent}`}>{labelFor(item.post_type)}</span>
                    <span className="approx-label"><MapPin size={12} />Ubicación aproximada</span>
                  </div>
                  <div className="directory-body">
                    <div className="directory-title">
                      <div><h2>{item.name || "Sin nombre"}</h2><span>{[item.species, item.breed].filter(Boolean).join(" · ") || "Mascota"}</span></div>
                      <HeartHandshake size={19} />
                    </div>
                    <p>{item.description || item.distinctive_features || "Sin descripción adicional."}</p>
                    <div className="directory-meta"><span><MapPin size={14} />{item.zone_name || item.city_name}</span><span>{item.sighting_count} avistamientos</span></div>
                    <a className="case-detail-link" href={`/casos/${item.id}`}>Ver ficha y contacto</a>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state"><PawPrint size={36} /><strong>No encontramos casos con esos filtros</strong><span>Probá otra búsqueda o volvé a “Todos”.</span></div>
        )}
      </section>
    </>
  );
}
