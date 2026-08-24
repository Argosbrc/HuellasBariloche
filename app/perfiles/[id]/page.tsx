import { Award, Binoculars, CalendarDays, HeartHandshake, Medal, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { BadgeIcon } from "@/components/badge-icon";
import { DataNotice } from "@/components/data-notice";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublicCommunityProfile } from "@/lib/public-api";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const result = await getPublicCommunityProfile(id);
  if (result.configured && !result.data) notFound();
  const profile = result.data;
  return <main className="inner-shell public-profile-page">
    <SiteHeader inner />
    <DataNotice configured={result.configured} empty={!profile} />
    {profile && <>
      <section className="public-profile-hero">
        {profile.avatar_url ? <img src={profile.avatar_url} alt={`Foto de ${profile.display_name}`} /> : <span className="public-profile-avatar">{profile.display_name.slice(0, 1).toUpperCase()}</span>}
        <div><span className="section-kicker"><ShieldCheck size={15} /> Perfil comunitario</span><h1>{profile.display_name}</h1><p>{profile.bio || "Participa en la red solidaria de Huellas Bariloche."}</p><small><CalendarDays />Se sumó en {new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(profile.created_at))}</small></div>
        <aside><strong>{profile.points}</strong><span>puntos solidarios</span><small>{profile.role === "rescuer" ? "Rescatista verificado" : profile.role === "admin" ? "Administración" : "Miembro de la comunidad"}</small></aside>
      </section>
      <section className="public-profile-stats"><article><Medal /><strong>{profile.badge_count}</strong><span>medallas</span></article><article><Binoculars /><strong>{profile.confirmed_sightings}</strong><span>avistamientos confirmados</span></article><article><HeartHandshake /><strong>{profile.reunions_helped}</strong><span>reencuentros acompañados</span></article></section>
      <section className="public-profile-medals"><header><div><span className="section-kicker"><Award size={15} /> Reconocimientos</span><h2>Medallas obtenidas</h2></div><p>No hay niveles: cada una reconoce una acción real.</p></header>{profile.badges.length ? <div>{profile.badges.map((badge) => <article key={badge.id}><span><BadgeIcon name={badge.icon} size={28} /></span><div><h3>{badge.name}</h3><p>{badge.description}</p><small>Obtenida el {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(badge.awarded_at))}</small></div></article>)}</div> : <div className="empty-state"><Medal /><strong>Todavía no obtuvo medallas</strong><span>Las acciones confirmadas se reconocerán automáticamente.</span></div>}</section>
    </>}
    <SiteFooter inner />
  </main>;
}
