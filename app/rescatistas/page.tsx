import {
  BadgeCheck,
  CheckCircle2,
  Dog,
  HeartHandshake,
  Home,
  MapPin,
  MessageCircle,
  PawPrint,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { offerTransitHome } from "@/app/transitos/actions";
import { DataNotice } from "@/components/data-notice";
import { RescuerDirectory } from "@/components/rescuer-directory";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getOptionalAccountProfile } from "@/lib/account";
import { getRescuers, getTransitRequests, storagePublicUrl } from "@/lib/public-api";
import { createClient } from "@/lib/supabase/server";
import type { TransitDashboard } from "@/lib/types";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  pending: "Pendiente de revisión",
  accepted: "Oferta aceptada",
  rejected: "Oferta revisada",
};

export default async function RescuersPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const [rescuerResult, transitResult, account] = await Promise.all([
    getRescuers(),
    getTransitRequests(),
    getOptionalAccountProfile(),
  ]);

  let dashboard: TransitDashboard = { requests: [], offers_made: [] };
  if (account) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_my_transit_dashboard_v1");
    if (data && typeof data === "object") dashboard = data as TransitDashboard;
  }

  const ownCampaigns = new Set(dashboard.requests.map((item) => item.campaign_id));
  const offersByCampaign = new Map(dashboard.offers_made.map((item) => [item.campaign_id, item]));

  return (
    <main className="inner-shell rescuers-shell">
      <SiteHeader inner />
      <section className="inner-hero rescuers-hero">
        <div><span className="section-kicker">Red verificada</span><h1>Ayudar también es<em>abrir las puertas.</em></h1><p>Encontrá búsquedas de hogares de tránsito y conocé a los rescatistas y organizaciones aprobadas que sostienen cada rescate.</p></div>
        <div className="rescuer-trust-panel"><BadgeCheck /><div><strong>Una sola red solidaria</strong><span>Los perfiles son revisados y los datos de cada ofrecimiento de tránsito permanecen privados.</span></div><ShieldCheck /></div>
      </section>

      <nav className="solidarity-jump-nav" aria-label="Secciones de Red solidaria">
        <a href="#transitos"><Home size={17} /><span><strong>Hogares de tránsito</strong><small>Ver búsquedas y ofrecer ayuda</small></span></a>
        <a href="#directorio"><HeartHandshake size={17} /><span><strong>Rescatistas y organizaciones</strong><small>Perfiles, necesidades y donaciones</small></span></a>
      </nav>

      {(params.ok || params.error) && <div className={params.error ? "admin-feedback admin-feedback-error transit-feedback" : "admin-feedback transit-feedback"}>{params.error ?? params.ok}</div>}
      <DataNotice configured={rescuerResult.configured && transitResult.configured} empty={rescuerResult.data.length === 0 && transitResult.data.length === 0} />

      <section className="inner-content transit-content solidarity-transit-content" id="transitos">
        <div className="transit-heading"><div><span className="section-kicker">Ayuda urgente</span><h2>Hogares de tránsito</h2><p>Leé cada necesidad antes de ofrecerte. El rescatista revisará tu propuesta y podrá contactarte si es compatible.</p></div><span><HeartHandshake />{transitResult.data.length} búsquedas</span></div>

        {transitResult.data.length ? <div className="transit-grid">{transitResult.data.map((item) => {
          const imageUrl = storagePublicUrl("pet-photos", item.cover_image_url || item.photo_paths?.[0] || null);
          const own = ownCampaigns.has(item.id);
          const existingOffer = offersByCampaign.get(item.id);
          return <article className="transit-card" key={item.id}>
            <div className="transit-image">
              {imageUrl ? <img src={imageUrl} alt={item.pet_name || "Animal que necesita tránsito"} /> : <Dog />}
              <span><Home size={13} />Busca hogar temporal</span>
            </div>
            <div className="transit-card-body">
              <header><div><small>{item.organization_name}</small><h2>{item.pet_name || item.title}</h2></div><BadgeCheck /></header>
              <p>{item.requirements}</p>
              <div className="transit-facts">
                <span><PawPrint />{[item.species, item.breed, item.size_label].filter(Boolean).join(" · ")}</span>
                <span><MapPin />{item.zone_name || "Zona a coordinar"}</span>
                <span><ShieldCheck />Publicado por un rescatista verificado</span>
              </div>

              {own ? <div className="transit-own-note"><ShieldCheck /><span><strong>Esta búsqueda es tuya</strong><small>Las ofertas recibidas se administran desde tu panel.</small></span><Link href="/panel#transitos">Ver ofertas</Link></div>
              : existingOffer ? <div className={`transit-offer-status ${existingOffer.status}`}><CheckCircle2 /><span><strong>{statusLabel[existingOffer.status] || existingOffer.status}</strong><small>Podés seguir el estado desde tu panel.</small></span></div>
              : account ? <details className="transit-offer-form">
                <summary><Home />Ofrecer mi hogar como tránsito</summary>
                <form action={offerTransitHome}>
                  <input name="campaign_id" type="hidden" value={item.id} />
                  <label>Zona o barrio <small>opcional</small><input name="home_zone" maxLength={120} placeholder="Ej.: Centro, Melipal, Frutillar" /></label>
                  <label>Disponibilidad<input name="availability" required minLength={3} maxLength={200} placeholder="Ej.: hasta 30 días, desde hoy" /></label>
                  <label>¿Tenés perros?<select name="has_dogs" defaultValue="unknown"><option value="unknown">Prefiero conversar</option><option value="yes">Sí</option><option value="no">No</option></select></label>
                  <label>¿Tenés gatos?<select name="has_cats" defaultValue="unknown"><option value="unknown">Prefiero conversar</option><option value="yes">Sí</option><option value="no">No</option></select></label>
                  <label>¿Hay niños en el hogar?<select name="has_children" defaultValue="unknown"><option value="unknown">Prefiero conversar</option><option value="yes">Sí</option><option value="no">No</option></select></label>
                  <label className="form-wide">Mensaje para el rescatista <small>opcional</small><textarea name="message" minLength={3} maxLength={1000} rows={4} placeholder="Contale sobre tu casa, experiencia y cualquier dato importante." /></label>
                  <label className="transit-share form-wide"><input name="share_whatsapp" type="checkbox" /><span><strong>Compartir mi WhatsApp guardado</strong><small>Solo lo verá el rescatista responsable, nunca será público.</small></span></label>
                  <button className="button button-primary form-wide" type="submit"><MessageCircle />Enviar ofrecimiento</button>
                </form>
              </details>
              : <div className="transit-login-note"><Home /><span><strong>¿Podés ofrecer tránsito?</strong><small>Ingresá con tu cuenta para enviar una propuesta privada al rescatista.</small></span><Link className="button button-primary" href="/ingresar?returnTo=/rescatistas%23transitos">Ingresar</Link></div>}
            </div>
          </article>;
        })}</div> : <div className="empty-state"><Home size={38} /><strong>No hay búsquedas de tránsito activas</strong><span>Cuando un rescatista marque esta necesidad al publicar una adopción, aparecerá acá.</span></div>}
      </section>

      <section className="inner-content rescuers-content solidarity-directory-content" id="directorio">
        <div className="rescuer-directory-heading"><span className="section-kicker">Red de rescate</span><h2>Rescatistas y organizaciones</h2><p>Buscá por nombre, zona o necesidad y elegí cómo colaborar.</p></div>
        {rescuerResult.data.length ? <RescuerDirectory rescuers={rescuerResult.data} /> : <div className="empty-state"><HeartHandshake size={36} /><strong>Todavía no hay rescatistas publicados</strong><span>Las personas aprobadas por administración aparecerán automáticamente con sus datos y necesidades.</span></div>}
      </section>
      <SiteFooter inner />
    </main>
  );
}
