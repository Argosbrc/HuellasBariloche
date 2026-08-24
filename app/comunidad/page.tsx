import {
  CalendarDays,
  CircleHelp,
  Heart,
  Lightbulb,
  MessageCircle,
  PackageOpen,
  PawPrint,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { CommunityFeed } from "@/components/community-feed";
import { DataNotice } from "@/components/data-notice";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getOptionalAccountProfile } from "@/lib/account";
import { getCommunityData, storagePublicUrl } from "@/lib/public-api";

export const dynamic = "force-dynamic";

const communityPurposes = [
  { title: "Pedir ayuda", text: "Alimento, medicación, traslados o colaboración puntual.", Icon: CircleHelp, className: "help" },
  { title: "Convocar", text: "Búsquedas, colectas, jornadas y actividades solidarias.", Icon: CalendarDays, className: "activity" },
  { title: "Ofrecer", text: "Medicamentos, cuchas, alimento y otros recursos disponibles.", Icon: PackageOpen, className: "offer" },
  { title: "Informar", text: "Datos útiles que puedan resolver una necesidad concreta.", Icon: Lightbulb, className: "info" },
];

export default async function CommunityPage() {
  const [{ posts, campaigns }, account] = await Promise.all([
    getCommunityData(),
    getOptionalAccountProfile(),
  ]);
  const publishHref = account ? "/comunidad/publicar" : "/ingresar?returnTo=/comunidad/publicar";
  const publicPosts = posts.data.map((post) => ({
    ...post,
    imageUrl: storagePublicUrl("community-media", post.cover_image_path),
  }));

  return (
    <main className="inner-shell">
      <SiteHeader inner />
      <section className="inner-hero community-hero">
        <div><span className="section-kicker">Comunidad Huellas</span><h1>Cuando el barrio se organiza,<em>la ayuda llega.</em></h1><p>Un espacio para pedir una mano, convocar personas, ofrecer recursos y compartir información útil para los animales de Bariloche.</p><Link className="button button-white button-large" href={publishHref}><MessageCircle size={18} />Publicar en Comunidad</Link></div>
        <div className="community-stats-panel"><div><PawPrint /><strong>{posts.data.length}</strong><span>publicaciones visibles</span></div><div><ShieldCheck /><strong>{campaigns.data.length}</strong><span>campañas activas</span></div><div><Sparkles /><strong>4</strong><span>formas de ayudar</span></div></div>
      </section>

      <section className="community-purpose-section" aria-labelledby="community-purpose-title">
        <div className="community-purpose-heading"><span className="section-kicker">Un tablón solidario</span><h2 id="community-purpose-title">¿Para qué sirve Comunidad?</h2><p>Publicaciones concretas, fáciles de filtrar y orientadas a resolver necesidades reales.</p></div>
        <div className="community-purpose-grid">{communityPurposes.map(({ title, text, Icon, className }) => <article className={`community-purpose-card community-purpose-${className}`} key={title}><Icon /><strong>{title}</strong><span>{text}</span></article>)}</div>
      </section>

      {account && <div className="community-session-note"><ShieldCheck size={18} /><div><strong>Sesión activa como {account.display_name}</strong><span>Ya podés publicar y participar sin volver a ingresar.</span></div><Link href="/comunidad/publicar">Crear publicación</Link></div>}
      <DataNotice configured={posts.configured && campaigns.configured} empty={posts.data.length + campaigns.data.length === 0} />

      <section className="community-layout">
        <div>
          <CommunityFeed canRecordShares={Boolean(account)} posts={publicPosts} />
          <div className="community-feed-cta"><div><Heart /><span><strong>¿Tenés algo para aportar?</strong><small>Una publicación clara puede conectar una necesidad con la persona indicada.</small></span></div><Link className="button button-primary" href={publishHref}>Crear publicación</Link></div>
        </div>

        <aside className="community-aside" id="campanas">
          {campaigns.data.length ? campaigns.data.map((campaign) => {
            const progress = campaign.item_count ? Math.round((campaign.completed_item_count / campaign.item_count) * 100) : 0;
            return <article className="campaign-card" key={campaign.id}><span className="campaign-icon"><Heart /></span><span className="section-kicker">Campaña solidaria</span><h2>{campaign.title}</h2><p>{campaign.description}</p><div className="campaign-progress"><span><strong>{progress}% completado</strong><small>{campaign.completed_item_count}/{campaign.item_count}</small></span><i><b style={{ width: `${progress}%` }} /></i></div><Link className="button button-primary" href={account ? "/rescatistas" : "/ingresar?returnTo=/comunidad"}>{account ? "Contactar rescatistas" : "Ingresar para ayudar"}</Link></article>;
          }) : <article className="campaign-card community-guide-card"><span className="campaign-icon"><ShieldCheck /></span><span className="section-kicker">Cómo participar</span><h2>Publicá con un objetivo claro</h2><p>Indicá qué necesitás u ofrecés, en qué zona y cómo debería coordinarse. Evitá publicar direcciones exactas o datos sensibles.</p><Link className="button button-primary" href={publishHref}>Publicar ahora</Link></article>}
        </aside>
      </section>
      <SiteFooter inner />
    </main>
  );
}
