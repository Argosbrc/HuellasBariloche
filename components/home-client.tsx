"use client";

import {
  ArrowRight,
  BellRing,
  Cat,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Dog,
  HeartHandshake,
  MapPin,
  MessageCircle,
  PawPrint,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CommunityMapShell } from "@/components/community-map-shell";
import type { HomeSummary, PublicPetCase } from "@/lib/types";

const fallbackCases = [
  {
    id: 1,
    status: "Perdido",
    name: "Milo",
    type: "Perro mestizo",
    area: "Melipal",
    time: "Hace 2 h",
    accent: "coral",
    icon: Dog,
    imageUrl: null,
  },
  {
    id: 2,
    status: "Encontrado",
    name: "Sin nombre",
    type: "Gata adulta",
    area: "Centro",
    time: "Hace 4 h",
    accent: "sky",
    icon: Cat,
    imageUrl: null,
  },
  {
    id: 3,
    status: "Avistamiento",
    name: "Perro negro",
    type: "Tamaño mediano",
    area: "Ñireco",
    time: "Hace 6 h",
    accent: "amber",
    icon: Dog,
    imageUrl: null,
  },
];

const quickActions = [
  {
    title: "Perdí a mi mascota",
    description: "Publicá un caso y activá alertas cercanas.",
    icon: Search,
    className: "action-coral",
  },
  {
    title: "Encontré una mascota",
    description: "Ayudanos a reunirla con su familia.",
    icon: HeartHandshake,
    className: "action-sky",
  },
  {
    title: "Vi una mascota sola",
    description: "Registrá el lugar sin necesidad de retenerla.",
    icon: Crosshair,
    className: "action-amber",
  },
];

function relativeTime(value: string | null) {
  if (!value) return "Fecha no informada";
  const elapsed = Date.now() - new Date(value).getTime();
  const hours = Math.max(1, Math.floor(elapsed / 3_600_000));
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.floor(hours / 24)} d`;
}

type HomePetCase = PublicPetCase & { imageUrl: string | null };

function mapCase(item: HomePetCase) {
  const isCat = item.species?.toLowerCase().includes("gat");
  const status = item.post_type === "lost"
    ? "Perdido"
    : item.post_type === "found"
      ? "Encontrado"
      : item.post_type === "adoption"
        ? "Adopción"
        : "Avistamiento";
  const accent = item.post_type === "lost" ? "coral" : item.post_type === "found" ? "sky" : "amber";
  return {
    id: item.id,
    status,
    name: item.name || "Sin nombre",
    type: [item.species, item.breed].filter(Boolean).join(" · ") || "Mascota",
    area: item.zone_name || item.city_name,
    time: relativeTime(item.event_at || item.created_at),
    accent,
    icon: isCat ? Cat : Dog,
    imageUrl: item.imageUrl,
  };
}

export function HomeClient({
  publicCases,
  heroCases,
  mapCases,
  summary,
  configured,
}: {
  publicCases: HomePetCase[];
  heroCases: HomePetCase[];
  mapCases: HomePetCase[];
  summary: HomeSummary | null;
  configured: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const cases = configured ? publicCases.map(mapCase) : fallbackCases;
  const searchedPets = configured
    ? heroCases.map(mapCase)
    : fallbackCases.filter((item) => item.status === "Perdido");
  const safeHeroIndex = searchedPets.length ? activeHeroIndex % searchedPets.length : 0;
  const activeHero = searchedPets[safeHeroIndex] ?? null;

  useEffect(() => {
    if (searchedPets.length < 2) return;
    const timer = window.setInterval(
      () => setActiveHeroIndex((current) => (current + 1) % searchedPets.length),
      5_500,
    );
    return () => window.clearInterval(timer);
  }, [searchedPets.length]);

  function moveHero(direction: -1 | 1) {
    setActiveHeroIndex((current) =>
      (current + direction + searchedPets.length) % searchedPets.length,
    );
  }

  const visibleCases = cases.filter(
    (item) => activeFilter === "Todos" || item.status === activeFilter,
  );

  return (
    <main className="site-shell">
      <SiteHeader />

      <section className="hero home-discovery-hero" id="inicio">
        <div className="hero-copy">
          <div className="eyebrow">
            <span><Sparkles size={14} /></span>
            Red solidaria de Bariloche
          </div>
          <h1>
            Cada huella merece
            <em> volver a casa.</em>
          </h1>
          <p>
            Conectamos a vecinos, rescatistas y familias para encontrar mascotas,
            acompañar adopciones y actuar rápido cuando más importa.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary button-large" href="/casos">
              <Search size={19} />
              Perdí a mi mascota
            </Link>
            <Link className="button button-light button-large" href="/casos">
              Encontré una
              <ArrowRight size={19} />
            </Link>
          </div>
          <div className="trust-row" aria-label="Beneficios de la plataforma">
            <span><ShieldCheck size={17} /> Ubicación protegida</span>
            <span><BellRing size={17} /> Alertas cercanas</span>
            <span><HeartHandshake size={17} /> Comunidad verificada</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Mascotas perdidas que están siendo buscadas" aria-live="polite">
          {activeHero?.imageUrl ? (
            <img
              key={activeHero.id}
              className="hero-slide-photo"
              src={activeHero.imageUrl}
              alt={`${activeHero.name}, mascota perdida en ${activeHero.area}`}
            />
          ) : searchedPets.length ? (
            <div className="hero-photo-fallback"><Dog size={104} strokeWidth={1.1} /><span>Foto no disponible</span></div>
          ) : (
            <img
              className="hero-slide-photo"
              src="/hero-huellas-bariloche.png"
              alt="Mascotas en un paisaje de Bariloche"
            />
          )}
          <div className="hero-shade" />
          {activeHero ? <Link className="success-card hero-search-card" href={`/casos/${activeHero.id}`}>
            <span className="success-icon"><Search size={20} /></span>
            <span><small>Se busca · {activeHero.time}</small><strong>{activeHero.name}</strong></span>
            <ArrowRight size={17} />
          </Link> : <div className="success-card hero-search-card hero-search-empty">
            <span className="success-icon"><PawPrint size={20} /></span>
            <span><small>Red al día</small><strong>No hay búsquedas activas</strong></span>
          </div>}
          <div className="alert-card">
            <BellRing size={18} />
            {activeHero ? "Ayudanos a encontrarlo" : "Alertas en un radio de 3–5 km"}
          </div>
          <div className="location-pill"><MapPin size={15} /> {activeHero?.area || "San Carlos de Bariloche"}</div>
          {searchedPets.length > 1 && <div className="hero-carousel-controls" aria-label="Controles del carrusel">
            <button aria-label="Mascota anterior" onClick={() => moveHero(-1)} type="button"><ChevronLeft /></button>
            <span>{safeHeroIndex + 1} / {searchedPets.length}</span>
            <button aria-label="Mascota siguiente" onClick={() => moveHero(1)} type="button"><ChevronRight /></button>
          </div>}
        </div>

        <div className="hero-live-map" id="mapa-comunitario">
          <div className="hero-live-map-copy">
            <span><MapPin size={17} /></span>
            <div><strong>¿Viste un animalito?</strong><small>Ubicá los casos cercanos y conectá con su familia.</small></div>
          </div>
          <CommunityMapShell cases={mapCases} embedded />
        </div>
      </section>

      <section className="impact-strip" aria-label="Impacto de Huellas Bariloche">
        <div><strong>{configured ? summary?.lost_cases ?? 0 : 7}</strong><span>casos perdidos activos</span></div>
        <div><strong>{configured ? summary?.found_cases ?? 0 : 24}</strong><span>mascotas encontradas</span></div>
        <div><strong>{configured ? summary?.verified_rescuers ?? 0 : 18}</strong><span>rescatistas verificados</span></div>
        <div><strong>{configured ? summary?.available_adoptions ?? 0 : 12}</strong><span>adopciones disponibles</span></div>
      </section>

      <section className="section quick-section" id="acciones">
        <div className="section-heading centered">
          <span className="section-kicker">Empezá por acá</span>
          <h2>¿Cómo podemos ayudarte hoy?</h2>
          <p>Elegí la situación y te guiamos paso a paso.</p>
        </div>
        <div className="action-grid">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link className={`action-card ${action.className}`} href="/casos" key={action.title}>
                <span className="action-icon"><Icon size={26} /></span>
                <span className="action-content">
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>
                <span className="action-arrow"><ChevronRight size={21} /></span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section cases-section" id="casos">
        <div className="section-heading heading-row">
          <div>
            <span className="section-kicker">La red está activa</span>
            <h2>Casos recientes</h2>
            <p>Información pública y ubicación aproximada para proteger a todos.</p>
          </div>
          <Link className="text-link" href="/casos">Ver todos los casos <ArrowRight size={17} /></Link>
        </div>

        <div className="filter-row" role="group" aria-label="Filtrar casos">
          {["Todos", "Perdido", "Encontrado", "Adopción", "Avistamiento"].map((filter) => (
            <button
              className={activeFilter === filter ? "filter active" : "filter"}
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>

        {visibleCases.length > 0 ? <div className="case-grid">
          {visibleCases.map((petCase) => {
            const Icon = petCase.icon;
            return (
              <article className="case-card" id={`caso-${petCase.id}`} key={petCase.id}>
                <div className={`case-image case-${petCase.accent}`}>
                  {petCase.imageUrl ? (
                    <img
                      className="card-photo"
                      src={petCase.imageUrl}
                      alt={petCase.name || "Mascota publicada"}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <>
                      <div className="mountain-shape" />
                      <Icon className="pet-silhouette" size={88} strokeWidth={1.15} />
                    </>
                  )}
                  <span className={`status status-${petCase.accent}`}>{petCase.status}</span>
                  <button aria-label={`Guardar caso de ${petCase.name}`} className="save-button" type="button">
                    <HeartHandshake size={18} />
                  </button>
                </div>
                <div className="case-body">
                  <div>
                    <h3>{petCase.name}</h3>
                    <span>{petCase.type}</span>
                  </div>
                  <div className="case-meta">
                    <span><MapPin size={15} /> {petCase.area}</span>
                    <span>{petCase.time}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div> : (
          <div className="empty-state"><PawPrint size={34} /><strong>Todavía no hay casos publicados</strong><span>Cuando aparezca el primero, se mostrará acá.</span></div>
        )}
      </section>

      <section className="section community-section" id="comunidad">
        <div className="community-card">
          <div className="community-copy">
            <span className="section-kicker light">Una red que deja huella</span>
            <h2>Ayudar también suma.</h2>
            <p>
              Confirmá avistamientos, difundí casos y colaborá con información útil.
              Cada acción fortalece a la comunidad.
            </p>
            <div className="community-actions">
              <a className="button button-white button-large" href="/medallas">Ver medallero <ArrowRight size={18} /></a>
              <a className="button button-community-ghost button-large" href="/encuentros">Ver encuentros</a>
            </div>
          </div>
          <div className="badge-cluster" aria-label="Medallas de la comunidad">
            <span className="badge badge-one"><PawPrint /><small>Primera<br />huella</small></span>
            <span className="badge badge-two"><Sparkles /><small>Ojos<br />del barrio</small></span>
            <span className="badge badge-three"><HeartHandshake /><small>Puente<br />a casa</small></span>
          </div>
        </div>
      </section>

      <section className="section service-strip" id="servicios">
        <div className="service-intro">
          <span className="section-kicker">Directorio local</span>
          <h2>Servicios que cuidan.</h2>
        </div>
        <div className="service-list">
          <Link href="/datos-utiles"><Stethoscope size={22} /><span><strong>Datos útiles</strong><small>Veterinarias, alimento y comercios</small></span><ChevronRight /></Link>
          <Link href="/rescatistas"><HeartHandshake size={22} /><span><strong>Red solidaria</strong><small>Tránsitos, perfiles y donaciones</small></span><ChevronRight /></Link>
          <Link href="/comunidad"><MessageCircle size={22} /><span><strong>Comunidad</strong><small>Consejos y ayuda</small></span><ChevronRight /></Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
