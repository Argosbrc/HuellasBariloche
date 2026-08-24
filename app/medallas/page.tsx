import { ArrowRight, Award, Medal, Sparkles, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import { BadgeIcon } from "@/components/badge-icon";
import { DataNotice } from "@/components/data-notice";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCommunityMedalBoard } from "@/lib/public-api";

export const dynamic = "force-dynamic";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(value));
}

export default async function MedalsPage() {
  const result = await getCommunityMedalBoard();
  const data = result.data ?? { badges: [], ranking: [], recent_awards: [], my_profile_id: null, my_badge_ids: [] };
  return <main className="inner-shell medal-page">
    <SiteHeader inner />
    <section className="medal-hero">
      <div><span className="section-kicker"><Sparkles size={15} /> Comunidad que deja huella</span><h1>Medallas por ayudar, <em>no niveles.</em></h1><p>Cada reconocimiento corresponde a una colaboración concreta. Los avistamientos solo cuentan cuando la familia los confirma.</p><div><Link className="button button-primary" href="/panel#mis-medallas">Ver mis medallas</Link><Link className="button button-light" href="/encuentros">Conocer reencuentros</Link></div></div>
      <aside><Medal /><strong>{data.badges.length}</strong><span>medallas disponibles</span><small>Reconocimiento transparente y verificable</small></aside>
    </section>
    <DataNotice configured={result.configured} empty={false} />

    <section className="medal-catalog">
      <header><div><span className="section-kicker"><Award size={15} /> Medallero</span><h2>Formas de dejar huella</h2></div><p>Las medallas obtenidas se muestran en el perfil público.</p></header>
      {data.badges.length ? <div className="medal-grid">{data.badges.map((badge) => {
        const earned = data.my_badge_ids.includes(badge.id);
        return <article className={earned ? "earned" : ""} key={badge.id}><span className="medal-emblem"><BadgeIcon name={badge.icon} size={29} /></span><div><small>{earned ? "Obtenida" : "Medalla comunitaria"}</small><h3>{badge.name}</h3><p>{badge.description}</p></div>{earned && <em>Tuya</em>}</article>;
      })}</div> : <div className="empty-state"><Medal /><strong>El medallero se habilitará al aplicar la migración 023</strong></div>}
    </section>

    <section className="medal-community-grid">
      <article className="ranking-card"><header><div><Trophy /><span><small>Ranking solidario</small><h2>Personas que suman</h2></span></div><p>Los puntos de avistamiento se acreditan únicamente después de la confirmación del dueño.</p></header>{data.ranking.length ? <ol>{data.ranking.map((person, index) => <li key={person.profile_id}><b>{index + 1}</b>{person.avatar_url ? <img src={person.avatar_url} alt="" /> : <span className="ranking-avatar">{person.display_name.slice(0, 1).toUpperCase()}</span>}<Link href={`/perfiles/${person.profile_id}`}><strong>{person.display_name}</strong><small>{person.badge_count} {person.badge_count === 1 ? "medalla" : "medallas"}</small></Link><em>{person.points} pts.</em></li>)}</ol> : <div className="dashboard-empty compact"><UsersRound /><span>El ranking crecerá con las primeras acciones confirmadas.</span></div>}</article>
      <article className="recent-medals-card"><header><Sparkles /><span><small>Actividad reciente</small><h2>Nuevas medallas</h2></span></header>{data.recent_awards.length ? <div>{data.recent_awards.map((award) => <Link href={`/perfiles/${award.profile_id}`} key={`${award.profile_id}-${award.badge_id}-${award.awarded_at}`}><span><BadgeIcon name={award.badge_icon} /></span><div><strong>{award.display_name}</strong><small>Ganó “{award.badge_name}” · {dateLabel(award.awarded_at)}</small></div><ArrowRight /></Link>)}</div> : <div className="dashboard-empty compact"><Award /><span>Las nuevas medallas aparecerán acá.</span></div>}</article>
    </section>
    <SiteFooter inner />
  </main>;
}
