import {
  Archive,
  Award,
  BadgeCheck,
  BellRing,
  CircleUserRound,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock3,
  HeartHandshake,
  Home,
  MapPin,
  Medal,
  MessageCircle,
  PawPrint,
  PencilLine,
  Phone,
  Settings2,
  ShieldCheck,
  Smartphone,
  Download,
  X,
} from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SignOutButton } from "@/components/sign-out-button";
import { loadAccountDashboard } from "@/lib/account";
import { submitRescuerApplication, withdrawRescuerApplication } from "@/app/cuenta/actions";
import { closeTransitRequest, reviewTransitOffer } from "@/app/transitos/actions";
import { reviewAdoptionApplication } from "@/app/adopciones/actions";
import { PushNotificationControl } from "@/components/push-notification-control";
import { PwaInstallCard } from "@/components/pwa-install";
import { markAllNotificationsRead,
  markNotificationRead,
  updateSightingAlertStatus,
  startSightingConversation } from "@/app/panel/casos/actions";
import { NearbyAlertControl } from "@/components/nearby-alert-control";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(value));
}

function answerLabel(field: string, value: string) {
  const labels: Record<string, Record<string, string>> = {
    secure_home: { yes: "Sí", no: "No", apartment_safe_balcony: "Departamento con balcón seguro" },
    financial_capacity: { yes: "Sí", no: "No", with_effort: "Con esfuerzo" },
    neuter_commitment: { agreed: "Sí, de acuerdo", cannot_guarantee: "No puede garantizarlo" },
    follow_up_commitment: { agreed: "Sí, totalmente", prefer_not: "Prefiere que no" },
  };
  return labels[field]?.[value] ?? value;
}

function requestStatus(value: string) {
  if (value === "pending") return "Pendiente";
  if (value === "accepted") return "Postulante seleccionado";
  if (value === "rejected") return "No seleccionada";
  return value;
}

function postStateLabel(value: string) {
  const labels: Record<string, string> = {
    lost: "Perdido",
    sighted: "Con avistamientos",
    found: "Encontrado",
    available: "En adopción",
    reunited: "Reunido",
    adopted: "Adoptado",
    closed: "Cerrado",
    archived: "Archivado",
  };
  return labels[value] || value;
}

function sightingStatusLabel(value: string) {
  if (value === "new") return "Nuevo";
  if (value === "contacted") return "Contactado";
  if (value === "resolved") return "Resuelto";
  if (value === "dismissed") return "Descartado";
  return value;
}

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const data = await loadAccountDashboard();

  const groupedSightingAlerts = Object.values(
    data.sightingAlerts.reduce((groups, alert) => {
      const key = alert.pet_post_id;

      if (!groups[key]) {
        groups[key] = {
          pet_post_id: alert.pet_post_id,
          pet_name: alert.pet_name,
          cover_image_url: alert.cover_image_url,
          alerts: [],
        };
      }

      groups[key].alerts.push(alert);

      return groups;
    }, {} as Record<string, any>)
  );

  const isRescuer = data.profile.role === "rescuer" || Boolean(data.rescuer);
  const isAdmin = data.profile.role === "admin";

  return (
    <main className="inner-shell dashboard-shell">
      <SiteHeader inner />
      <section className="dashboard-hero">
        <div className="dashboard-person">
          {data.profile.avatar_url ? <img src={data.profile.avatar_url} alt="Foto de perfil" /> : <span><CircleUserRound /></span>}
          <div><small>{isAdmin ? "Administración" : isRescuer ? "Panel de rescatista" : "Panel de usuario"}</small><h1>{data.profile.display_name}</h1><p>{data.email}</p></div>
        </div>
        <div className="dashboard-actions"><Link className="button button-light" href="/cuenta/perfil"><Settings2 size={17} />Editar perfil</Link>{isAdmin && <Link className="button button-admin" href="/admin"><ShieldCheck size={17} />Administración</Link>}<SignOutButton /></div>
      </section>

      {(params.ok || params.error) && <div className={params.error ? "admin-feedback admin-feedback-error dashboard-feedback" : "admin-feedback dashboard-feedback"}>{params.error ?? params.ok}</div>}

      <section className="dashboard-stats">
        <article><PawPrint /><span>Mis publicaciones</span><strong>{data.counts.posts}</strong><small>{data.counts.activePosts} activas</small></article>
        <article><BellRing /><span>Notificaciones</span><strong>{data.unreadNotifications}</strong><small>sin leer</small></article>
        <article><MessageCircle /><span>Conversaciones</span><strong>{data.conversationCount}</strong><small><Link href="/conversaciones">Abrir bandeja</Link></small></article>
        <article><HeartHandshake /><span>Puntos solidarios</span><strong>{data.profile.points}</strong><small>reputación</small></article>
      </section>

      <NearbyAlertControl initial={data.nearbyAlerts} />

      <section className="dashboard-medals" id="mis-medallas">
        <header><div><span className="section-kicker"><Medal size={15} /> Reconocimientos</span><h2>Mis medallas</h2><p>No hay niveles: cada medalla reconoce una ayuda concreta.</p></div><Link href="/medallas">Ver medallero y ranking</Link></header>
        {data.badges.length ? <div className="dashboard-medal-list">{data.badges.slice(0, 9).map((item) => <article key={item.badge_id}><span><Award /></span><div><strong>{item.badge?.name || "Medalla comunitaria"}</strong><small>{item.badge?.description || "Reconocimiento por colaborar"}</small></div></article>)}</div> : <div className="dashboard-empty compact"><Medal /><span>Tus medallas aparecerán cuando completes acciones solidarias verificadas.</span></div>}
      </section>

      <section className="dashboard-community-posts" id="mis-publicaciones-comunidad">
        <header><div><span className="section-kicker"><MessageCircle size={15} /> Mi actividad</span><h2>Mis publicaciones de Comunidad</h2><p>Editá, resolvé o retiralas cuando la información deje de estar vigente.</p></div><Link href="/comunidad/publicar">Nueva publicación</Link></header>
        {data.communityPosts.length ? <div className="dashboard-community-list">{data.communityPosts.slice(0, 12).map((post) => <article key={post.id}>{post.cover_image_path ? <img src={post.cover_image_path} alt="Publicación comunitaria" /> : <span><MessageCircle /></span>}<div><strong>{post.body}</strong><small>{post.place_name || "Bariloche"} · {formatDate(post.created_at)}</small></div><em className={post.moderation_status === "removed" ? "removed" : post.resolved_at ? "resolved" : post.is_expired ? "expired" : "active"}>{post.moderation_status === "removed" ? "Retirada" : post.resolved_at ? "Resuelta" : post.is_expired ? "Vencida" : "Activa"}</em><Link href={`/panel/comunidad/${post.id}`}><PencilLine />Gestionar</Link></article>)}</div> : <div className="dashboard-empty compact"><MessageCircle /><span>Tus publicaciones comunitarias aparecerán acá.</span><Link href="/comunidad/publicar">Publicar en Comunidad</Link></div>}
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-panel dashboard-main-panel">
          <header><div><span>Actividad propia</span><h2>Mis casos</h2></div><Link href="/publicar">Publicar caso</Link></header>
          {data.posts.length ? <div className="dashboard-list case-dashboard-list">{data.posts.map((post) => <article key={post.id}>{post.photo_paths?.[0] ? <img src={post.photo_paths[0]} alt={post.name || "Mascota publicada"} /> : <span className="dashboard-list-icon"><PawPrint size={17} /></span>}<div><strong>{post.name || `${post.species} sin nombre`}</strong><small>{post.post_type} · {post.zone_name || "sin zona publicada"} · {formatDate(post.created_at)}</small></div><em className={`state-${post.post_state}`}>{postStateLabel(post.post_state)}</em><Link aria-label={`Gestionar ${post.name || "caso"}`} href={`/panel/casos/${post.id}`}><PencilLine />Gestionar</Link></article>)}</div> : <div className="dashboard-empty"><PawPrint /><strong>Todavía no publicaste casos</strong><span>Cuando publiques un animal perdido, encontrado o en adopción aparecerá acá.</span><Link className="button button-primary" href="/publicar">Crear primera publicación</Link></div>}
        </article>

        <article className="dashboard-panel" id="notificaciones">
          <header><div><span>Centro de avisos</span><h2>Notificaciones</h2></div>{data.unreadNotifications > 0 ? <form action={markAllNotificationsRead}><button className="notification-read-all" type="submit"><CheckCheck />Marcar todas</button></form> : <BellRing />}</header>
          {data.notifications.length ? <div className="notification-list">{data.notifications.slice(0, 8).map((item) => <article className={!item.read_at ? "unread" : ""} key={item.id}><Link href={item.link || "/panel"}><strong>{item.title}</strong><span>{item.body}</span></Link>{!item.read_at && <form action={markNotificationRead}><input name="notification_id" type="hidden" value={item.id} /><button aria-label="Marcar notificación como leída" type="submit"><Check /></button></form>}</article>)}</div> : <div className="dashboard-empty compact"><BellRing /><span>No hay notificaciones todavía.</span></div>}
          <PushNotificationControl />
        </article>
      </section>

      {/* AQUÍ ESTABA EL ERROR: Se eliminó el bloque duplicado y roto */}
      {groupedSightingAlerts.length > 0 && (
        <section className="sighting-alerts-dashboard" id="avisos-casos">
          <header>
            <div>
              <span className="section-kicker">
                <BellRing size={15} /> Avisos de la comunidad
              </span>
              <h2>Vieron una mascota que buscás</h2>
              <p>
                Estos datos son privados: solo vos y la administración pueden verlos.
              </p>
            </div>
            <span className="sighting-alert-count">
              {groupedSightingAlerts.length} mascotas con avisos
            </span>
          </header>

          <div className="sighting-alert-list">
            {groupedSightingAlerts.map((pet) => (
              <article className="sighting-alert-card" key={pet.pet_post_id}>
                <div className="sighting-alert-pet">
                  {pet.cover_image_url ? (
                    <img
                      src={pet.cover_image_url}
                      alt={pet.pet_name || "Mascota buscada"}
                    />
                  ) : (
                    <span>
                      <PawPrint />
                    </span>
                  )}
                  <div>
                    <small>
                      {pet.alerts.length} avisos recibidos
                    </small>
                    <h3>
                      {pet.pet_name || "Mascota buscada"}
                    </h3>
                  </div>
                </div>

                <div className="sighting-alert-history">
                  {pet.alerts.map((alert: any) => (
                    <article
                      className={`sighting-alert-item ${alert.alert_kind}`}
                      key={alert.id}
                    >
                      <div className="sighting-alert-message">
                        <MessageCircle />
                        <p>{alert.message}</p>
                      </div>

                      <div className="sighting-alert-details">
                        {alert.location_text && (
                          <span>
                            <MapPin />
                            {alert.location_text}
                          </span>
                        )}

                        {alert.latitude !== null && alert.longitude !== null && (
                          <a
                            href={`https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MapPin />
                            Abrir ubicación informada
                          </a>
                        )}

                        {alert.contact_phone && (
                          <a
                            href={`https://wa.me/${alert.contact_phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Phone />
                            {alert.contact_phone}
                          </a>
                        )}

                        {alert.contact_social && (
                          <span>
                            <Smartphone />
                            {alert.contact_social}
                          </span>
                        )}
                      </div>

                      <div className="sighting-alert-date">
                        {formatDate(alert.created_at)}
                        {" · "}
                        {sightingStatusLabel(alert.status)}
                      </div>

                      {!["resolved", "dismissed"].includes(alert.status) && (
                        <div className="sighting-alert-actions">
                          {alert.status === "new" && (
                            <form action={updateSightingAlertStatus}>
                              <input name="alert_id" type="hidden" value={alert.id} />
                              <input name="status" type="hidden" value="contacted" />
                              <button type="submit">
                                <Phone /> Marcar contactado
                              </button>
                            </form>
                          )}

                          <form action={updateSightingAlertStatus}>
                            <input name="alert_id" type="hidden" value={alert.id} />
                            <input name="status" type="hidden" value="resolved" />
                            <button type="submit">
                              <CheckCircle2 /> Resolver
                            </button>
                          </form>

                          <form action={updateSightingAlertStatus}>
                            <input name="alert_id" type="hidden" value={alert.id} />
                            <input name="status" type="hidden" value="dismissed" />
                            <button type="submit">
                              <Archive /> Descartar
                            </button>
                          </form>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {isRescuer && <section className="rescuer-dashboard-card"><div><span className="section-kicker"><BadgeCheck size={15} /> Perfil verificado</span><h2>{data.rescuer?.organization_name || data.profile.display_name}</h2><p>{data.rescuer?.description || "Completá la presentación de tu organización para que la comunidad conozca tu trabajo."}</p><small>{data.rescuer?.contact_area || "San Carlos de Bariloche"}</small></div><div className="rescuer-metrics"><span><strong>{data.counts.adoptions}</strong> adopciones</span><span><strong>{data.counts.campaigns}</strong> campañas</span><Link className="button button-light" href="/cuenta/perfil">Editar ficha</Link><Link className="button button-light" href="/rescatistas">Ver portal</Link></div></section>}

      {(isRescuer || isAdmin) && <section className="adoption-requests-dashboard" id="solicitudes-adopcion">
        <header><div><span className="section-kicker"><HeartHandshake size={15} /> Adopciones responsables</span><h2>Solicitudes recibidas</h2><p>Cada ficha incluye el filtro esencial y los datos privados compartidos por la persona.</p></div><span className="adoption-request-count">{data.adoptions.received.length} solicitudes</span></header>
        {data.adoptions.received.length ? <div className="adoption-request-list">{data.adoptions.received.map((request) => <article className="adoption-request-card" key={request.id}>
          <div className="adoption-request-alert"><span>🚨</span><div><small>Nueva solicitud de adopción</small><h3>{request.full_name} quiere conocer a {request.pet_name || "este animal"}</h3><p>Recibida el {formatDate(request.created_at)}</p></div><em className={request.status}>{requestStatus(request.status)}</em></div>
          <div className="adoption-request-body">
            <div className="adoption-request-pet">{request.cover_image_url ? <img src={request.cover_image_url} alt={request.pet_name || "Mascota en adopción"} /> : <span><PawPrint /></span>}<strong>{request.pet_name || "Mascota en adopción"}</strong></div>
            <dl className="adoption-filter-results">
              <div><dt>Patio / portón seguro</dt><dd>{answerLabel("secure_home", request.secure_home)}</dd></div>
              <div><dt>Solvencia económica</dt><dd>{answerLabel("financial_capacity", request.financial_capacity)}</dd></div>
              <div><dt>Compromiso de castración</dt><dd>{answerLabel("neuter_commitment", request.neuter_commitment)}</dd></div>
              <div><dt>Seguimiento</dt><dd>{answerLabel("follow_up_commitment", request.follow_up_commitment)}</dd></div>
            </dl>
            <div className="adoption-request-contact"><span><Phone />{request.phone}</span><span><MapPin />{request.locality}</span><span><Home />{request.home_address}</span><a href={`https://wa.me/${request.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle />Contactar por WhatsApp</a></div>
          </div>
          {request.status === "pending" && <div className="adoption-request-actions"><form action={reviewAdoptionApplication}><input name="request_id" type="hidden" value={request.id} /><input name="decision" type="hidden" value="accepted" /><button className="button button-primary" type="submit"><Check />Seleccionar postulante</button></form><form action={reviewAdoptionApplication}><input name="request_id" type="hidden" value={request.id} /><input name="decision" type="hidden" value="rejected" /><button className="button button-light" type="submit"><X />No seleccionar</button></form></div>}
          {request.status === "accepted" && <div className="adoption-selected-note"><CheckCircle2 /><span><strong>La persona quedó seleccionada.</strong><small>La adopción sigue abierta hasta que confirmes la entrega desde la gestión del caso.</small></span><div><Link className="button button-primary" href={`/panel/casos/${request.pet_post_id}`}>Gestionar adopción</Link><form action={reviewAdoptionApplication}><input name="request_id" type="hidden" value={request.id} /><input name="decision" type="hidden" value="rejected" /><button className="button button-light" type="submit">Cancelar selección</button></form></div></div>}
        </article>)}</div> : <div className="dashboard-empty"><HeartHandshake /><strong>Todavía no recibiste solicitudes</strong><span>Cuando alguien complete el formulario de una adopción aparecerá acá.</span></div>}
      </section>}

      {data.adoptions.sent.length > 0 && <section className="my-adoption-requests" id="mis-solicitudes-adopcion"><header><div><span className="section-kicker"><HeartHandshake size={15} /> Mis postulaciones</span><h2>Solicitudes de adopción enviadas</h2></div><Link href="/adopciones">Ver adopciones</Link></header><div>{data.adoptions.sent.map((request) => <article key={request.id}>{request.cover_image_url ? <img src={request.cover_image_url} alt={request.pet_name || "Mascota en adopción"} /> : <span><PawPrint /></span>}<div><strong>{request.pet_name || "Mascota en adopción"}</strong><small>{request.rescuer_name} · {formatDate(request.created_at)}</small></div><em className={request.status}>{requestStatus(request.status)}</em></article>)}</div></section>}

      {isRescuer && <section className="transit-dashboard" id="transitos">
        <header><div><span className="section-kicker"><Home size={15} /> Hogares temporales</span><h2>Mis búsquedas de tránsito</h2><p>Se crean al marcar “Necesita hogar de tránsito” en una publicación de adopción.</p></div><Link className="button button-primary" href="/publicar">Publicar y buscar tránsito</Link></header>
        {data.transit.requests.length ? <div className="transit-dashboard-list">{data.transit.requests.map((request) => <article key={request.campaign_id}>
          <div className="transit-dashboard-request">
            {request.cover_image_url ? <img src={request.cover_image_url} alt={request.pet_name || "Animal en tránsito"} /> : <span><Home /></span>}
            <div><small>{request.status === "active" ? "Búsqueda activa" : "Búsqueda cerrada"}</small><h3>{request.pet_name || request.title}</h3><p><MapPin />{request.zone_name || "Zona a coordinar"}</p></div>
            {request.status === "active" && <form action={closeTransitRequest}><input name="campaign_id" type="hidden" value={request.campaign_id} /><input name="status" type="hidden" value="completed" /><button className="button button-light" type="submit"><Check />Marcar resuelta</button></form>}
          </div>
          <div className="transit-dashboard-offers">
            <strong>{request.offers.length} ofrecimientos</strong>
            {request.offers.length ? request.offers.map((offer) => <div className={`transit-dashboard-offer ${offer.status}`} key={offer.id}>
              <div className="transit-offer-person"><span><Home /></span><div><strong>{offer.offerer_name}</strong><small><Clock3 />{offer.availability}</small></div><em>{offer.status === "pending" ? "Pendiente" : offer.status === "accepted" ? "Aceptada" : "Revisada"}</em></div>
              <div className="transit-offer-details">
                {offer.home_zone && <span><MapPin />{offer.home_zone}</span>}
                <span>Perros: {offer.has_dogs === null ? "a conversar" : offer.has_dogs ? "sí" : "no"}</span>
                <span>Gatos: {offer.has_cats === null ? "a conversar" : offer.has_cats ? "sí" : "no"}</span>
                <span>Niños: {offer.has_children === null ? "a conversar" : offer.has_children ? "sí" : "no"}</span>
              </div>
              {offer.message && <p>{offer.message}</p>}
              {offer.contact_whatsapp && <a className="transit-private-contact" href={`https://wa.me/${offer.contact_whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><Phone />Contactar por WhatsApp</a>}
              {offer.status === "pending" && <div className="transit-review-actions"><form action={reviewTransitOffer}><input name="offer_id" type="hidden" value={offer.id} /><input name="decision" type="hidden" value="accepted" /><button className="button button-primary" type="submit"><Check />Aceptar</button></form><form action={reviewTransitOffer}><input name="offer_id" type="hidden" value={offer.id} /><input name="decision" type="hidden" value="rejected" /><button className="button button-light" type="submit"><X />No aceptar</button></form></div>}
            </div>) : <div className="dashboard-empty compact"><Home /><span>Todavía no recibiste ofrecimientos para esta búsqueda.</span></div>}
          </div>
        </article>)}</div> : <div className="dashboard-empty"><Home /><strong>No tenés búsquedas de tránsito</strong><span>Al publicar una adopción, activá la opción de hogar temporal y la comunidad podrá ofrecer ayuda.</span><Link className="button button-primary" href="/publicar">Crear publicación</Link></div>}
      </section>}

      {data.transit.offers_made.length > 0 && <section className="my-transit-offers" id="mis-transitos"><header><div><span className="section-kicker"><HeartHandshake size={15} /> Mi colaboración</span><h2>Mis ofrecimientos de tránsito</h2></div><Link href="/rescatistas#transitos">Ver búsquedas activas</Link></header><div>{data.transit.offers_made.map((offer) => <article key={offer.id}><Home /><div><strong>{offer.pet_name || offer.title}</strong><span>{offer.organization_name}</span></div><em className={offer.status}>{offer.status === "pending" ? "En revisión" : offer.status === "accepted" ? "Aceptado" : "Revisado"}</em></article>)}</div></section>}

      {!isRescuer && !isAdmin && <section className="rescuer-application-card"><div><span className="section-kicker"><BadgeCheck size={15} /> Rol comunitario</span><h2>¿Sos rescatista?</h2><p>Solicitá la verificación para publicar adopciones y administrar campañas solidarias.</p></div>{data.application?.status === "pending" ? <div className="application-status"><BadgeCheck /><strong>Solicitud en revisión</strong><span>Enviada el {formatDate(data.application.created_at)}</span><form action={withdrawRescuerApplication}><button className="button button-light" type="submit">Retirar solicitud</button></form></div> : <details className="application-form"><summary>Solicitar verificación</summary><form action={submitRescuerApplication}><label>Nombre y apellido<input name="applicant_name" required minLength={2} maxLength={80} defaultValue={data.profile.display_name} /></label><label>WhatsApp<input name="phone" required minLength={7} maxLength={30} defaultValue={data.contacts.whatsapp || ""} /></label><label>Organización<input name="organization_name" maxLength={120} /></label><label>Red social<input name="social_url" maxLength={300} /></label><label className="form-wide">Contanos brevemente tu trabajo<textarea name="message" minLength={3} maxLength={1500} rows={4} /></label><button className="button button-primary" type="submit">Enviar solicitud</button></form></details>}</section>}

      <section className="dashboard-shortcuts"><Link href="/cuenta/perfil"><CircleUserRound /><strong>Mi perfil</strong><span>Datos públicos y contacto</span></Link><Link href="/conversaciones"><MessageCircle /><strong>Conversaciones</strong><span>Mensajes privados dentro de Huellas</span></Link><Link href="/rescatistas#transitos"><Home /><strong>Hogares de tránsito</strong><span>Dentro de Red solidaria</span></Link><Link href="/datos-utiles"><HeartHandshake /><strong>Datos útiles</strong><span>Comercios y profesionales</span></Link></section>
      <PwaInstallCard icon={<Download />} />
      <SiteFooter inner />
    </main>
  );
}