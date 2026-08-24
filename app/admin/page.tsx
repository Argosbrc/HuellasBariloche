import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  FileWarning,
  Gauge,
  PawPrint,
  ShieldCheck,
  UserRoundCog,
  UsersRound,
  Store,
} from "lucide-react";
import Link from "next/link";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  type AdminReport,
  loadAdminDashboard,
} from "@/lib/admin";
import {
  moderatePetPost,
  resolveReport,
  reviewRescuerApplication,
  setUserStatus,
} from "./actions";
import { AdminGuide } from "@/components/admin-guide";

export const dynamic = "force-dynamic";

const sections = [
  ["resumen", "Resumen", Gauge],
  ["usuarios", "Usuarios", UsersRound],
  ["contenido", "Contenido", PawPrint],
  ["rescatistas", "Rescatistas", BadgeCheck],
  ["guia", "Datos útiles", Store],
  ["denuncias", "Denuncias", FileWarning],
  ["auditoria", "Auditoría", Activity],
] as const;

type Section = (typeof sections)[number][0];

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function targetForReport(report: AdminReport) {
  if (report.pet_post_id) return ["Caso", report.pet_post_id];
  if (report.sighting_id) return ["Avistamiento", report.sighting_id];
  if (report.message_id) return ["Mensaje", report.message_id];
  if (report.community_comment_id) return ["Comentario de Comunidad", report.community_comment_id];
  if (report.community_post_id) return ["Publicación de Comunidad", report.community_post_id];
  if (report.reported_profile_id) return ["Perfil", report.reported_profile_id];
  return ["Sin referencia", "—"];
}

function EmptyAdmin({ children }: { children: React.ReactNode }) {
  return <div className="admin-empty"><ShieldCheck size={25} /><p>{children}</p></div>;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const requestedSection = params.section as Section | undefined;
  const section: Section = sections.some(([value]) => value === requestedSection)
    ? requestedSection!
    : "resumen";
  const data = await loadAdminDashboard();

  return (
    <main className="inner-shell admin-page-shell">
      <SiteHeader inner />
      <section className="admin-hero">
        <div>
          <span className="section-kicker"><ShieldCheck size={15} /> Acceso administrativo</span>
          <h1>Panel de control</h1>
          <p>Moderación, usuarios y trazabilidad de Huellas Bariloche, usando tu sesión protegida de Supabase.</p>
        </div>
        <div className="admin-identity">
          <span><UserRoundCog size={22} /></span>
          <div><small>Sesión verificada</small><strong>{data.profile.display_name}</strong></div>
          <Link href="/cuenta">Mi cuenta</Link>
        </div>
      </section>

      <section className="admin-layout">
        <aside className="admin-sidebar" aria-label="Secciones administrativas">
          {sections.map(([value, label, Icon]) => (
            <Link className={section === value ? "active" : ""} href={`/admin?section=${value}`} key={value}>
              <Icon size={17} />{label}
              {value === "denuncias" && data.counts.pendingReports > 0 && <b>{data.counts.pendingReports}</b>}
              {value === "rescatistas" && data.counts.pendingApplications > 0 && <b>{data.counts.pendingApplications}</b>}
            </Link>
          ))}
        </aside>

        <div className="admin-content">
          {(params.ok || params.error) && (
            <div className={params.error ? "admin-feedback admin-feedback-error" : "admin-feedback"} role="status">
              {params.error ? <AlertTriangle size={17} /> : <ShieldCheck size={17} />}
              {params.error ?? params.ok}
            </div>
          )}
          {data.error && <div className="admin-feedback admin-feedback-error"><AlertTriangle size={17} />{data.error}</div>}

          {section === "resumen" && (
            <>
              <div className="admin-section-heading"><div><span>Estado general</span><h2>Resumen de la plataforma</h2></div><small>Datos en tiempo real</small></div>
              <div className="admin-stats">
                <article><UsersRound /><span>Usuarios</span><strong>{data.counts.users}</strong><small>perfiles registrados</small></article>
                <article><PawPrint /><span>Publicaciones</span><strong>{data.counts.posts}</strong><small>casos en la base</small></article>
                <article className={data.counts.pendingReports ? "attention" : ""}><FileWarning /><span>Denuncias</span><strong>{data.counts.pendingReports}</strong><small>requieren revisión</small></article>
                <article className={data.counts.pendingApplications ? "attention" : ""}><BadgeCheck /><span>Rescatistas</span><strong>{data.counts.pendingApplications}</strong><small>solicitudes pendientes</small></article>
              </div>
              <div className="admin-overview-grid">
                <article className="admin-panel">
                  <header><div><span>Actividad reciente</span><h3>Acciones administrativas</h3></div><Activity size={20} /></header>
                  {data.actions.length === 0 ? <EmptyAdmin>Todavía no hay acciones administrativas registradas.</EmptyAdmin> : (
                    <div className="admin-activity-list">{data.actions.slice(0, 8).map((entry) => <div key={entry.id}><span className="admin-activity-dot" /><div><strong>{entry.action.replaceAll("_", " ")}</strong><small>{entry.target_type} · {formatDate(entry.created_at)}</small></div></div>)}</div>
                  )}
                </article>
                <article className="admin-panel admin-priority">
                  <header><div><span>Prioridades</span><h3>Cola de trabajo</h3></div><AlertTriangle size={20} /></header>
                  <Link href="/admin?section=denuncias"><span>Denuncias abiertas</span><strong>{data.counts.pendingReports}</strong></Link>
                  <Link href="/admin?section=rescatistas"><span>Rescatistas por revisar</span><strong>{data.counts.pendingApplications}</strong></Link>
                  <Link href="/admin?section=contenido"><span>Contenido cargado</span><strong>{data.counts.posts}</strong></Link>
                </article>
              </div>
            </>
          )}

          {section === "usuarios" && (
            <>
              <div className="admin-section-heading"><div><span>Control de acceso</span><h2>Usuarios</h2></div><small>{data.users.length} visibles</small></div>
              {data.users.length === 0 ? <EmptyAdmin>No hay perfiles para mostrar.</EmptyAdmin> : <div className="admin-card-list">
                {data.users.map((user) => <article className="admin-record" key={user.id}>
                  <div className="admin-record-main"><span className="admin-avatar">{user.display_name.slice(0, 1).toUpperCase()}</span><div><strong>{user.display_name}{user.id === data.profile.id && <em>Vos</em>}</strong><small>{user.role} · {user.points} puntos · alta {formatDate(user.created_at)}</small></div></div>
                  <span className={`admin-status status-${user.status}`}>{user.status}</span>
                  {user.reason && <p className="admin-record-note">Motivo actual: {user.reason}</p>}
                  {user.id !== data.profile.id && <details className="admin-details"><summary>Administrar cuenta</summary><form action={setUserStatus} className="admin-inline-form"><input name="target_user" type="hidden" value={user.id} /><label>Estado<select name="status" defaultValue={user.status}><option value="active">Activa</option><option value="suspended">Suspendida</option><option value="banned">Bloqueada</option></select></label><label>Motivo<input name="reason" maxLength={500} placeholder="Obligatorio para suspender o bloquear" /></label><label>Fin de suspensión<input name="until_at" type="datetime-local" /></label><AdminSubmitButton>Guardar estado</AdminSubmitButton></form></details>}
                </article>)}
              </div>}
            </>
          )}

          {section === "contenido" && (
            <>
              <div className="admin-section-heading"><div><span>Moderación</span><h2>Casos publicados</h2></div><small>{data.posts.length} recientes</small></div>
              {data.posts.length === 0 ? <EmptyAdmin>Todavía no hay casos publicados.</EmptyAdmin> : <div className="admin-card-list">
                {data.posts.map((post) => <article className="admin-record" key={post.id}>
                  <div className="admin-record-main"><span className="admin-avatar admin-avatar-paw"><PawPrint size={18} /></span><div><strong>{post.name || `${post.species} sin nombre`}</strong><small>{post.post_type} · {post.post_state} · {post.zone_name} · {formatDate(post.created_at)}</small></div></div>
                  <span className={`admin-status status-${post.moderation_status}`}>{post.moderation_status}</span>
                  <details className="admin-details"><summary>Cambiar visibilidad</summary><form action={moderatePetPost} className="admin-inline-form"><input name="target_post" type="hidden" value={post.id} /><label>Moderación<select name="moderation_status" defaultValue={post.moderation_status}><option value="visible">Visible</option><option value="hidden">Oculta</option><option value="removed">Eliminada</option></select></label><label className="admin-form-wide">Motivo<input name="note" minLength={3} maxLength={500} required placeholder="Motivo administrativo" /></label><AdminSubmitButton>Aplicar moderación</AdminSubmitButton></form></details>
                </article>)}
              </div>}
            </>
          )}

          {section === "rescatistas" && (
            <>
              <div className="admin-section-heading"><div><span>Verificación</span><h2>Solicitudes de rescatistas</h2></div><Link className="admin-public-link" href="/rescatistas">Ver portal público</Link></div>
              {data.applications.length === 0 ? <EmptyAdmin>No hay solicitudes de rescatistas.</EmptyAdmin> : <div className="admin-card-list">
                {data.applications.map((application) => <article className="admin-record" key={application.id}>
                  <div className="admin-record-main"><span className="admin-avatar admin-avatar-badge"><BadgeCheck size={18} /></span><div><strong>{application.organization_name || application.applicant_name}</strong><small>{application.applicant_name} · {formatDate(application.created_at)}</small></div></div>
                  <span className={`admin-status status-${application.status}`}>{application.status}</span>
                  {application.social_url && <a className="admin-external" href={application.social_url} rel="noreferrer" target="_blank">Ver red social</a>}
                  {application.message && <p className="admin-record-note">{application.message}</p>}
                  {application.status === "pending" && <details className="admin-details"><summary>Revisar solicitud</summary><form action={reviewRescuerApplication} className="admin-inline-form"><input name="target_application" type="hidden" value={application.id} /><label>Decisión<select name="decision" defaultValue="approved"><option value="approved">Aprobar</option><option value="rejected">Rechazar</option></select></label><label className="admin-form-wide">Nota<input name="note" maxLength={1000} placeholder="Observación para la persona solicitante" /></label><AdminSubmitButton>Confirmar revisión</AdminSubmitButton></form></details>}
                </article>)}
              </div>}
            </>
          )}

          {section === "denuncias" && (
            <>
              <div className="admin-section-heading"><div><span>Seguridad comunitaria</span><h2>Denuncias</h2></div><small>{data.counts.pendingReports} activas</small></div>
              {data.reports.length === 0 ? <EmptyAdmin>No hay denuncias registradas.</EmptyAdmin> : <div className="admin-card-list">
                {data.reports.map((report) => { const [targetLabel, targetId] = targetForReport(report); return <article className="admin-record" key={report.id}>
                  <div className="admin-record-main"><span className="admin-avatar admin-avatar-warning"><FileWarning size={18} /></span><div><strong>{report.reason}</strong><small>{targetLabel} · {String(targetId).slice(0, 12)} · {formatDate(report.created_at)}</small></div></div>
                  <span className={`admin-status status-${report.status}`}>{report.status}</span>
                  {report.details && <p className="admin-record-note">{report.details}</p>}
                  {!(["resolved", "dismissed"].includes(report.status)) && <details className="admin-details"><summary>Resolver denuncia</summary><form action={resolveReport} className="admin-inline-form"><input name="target_report" type="hidden" value={report.id} /><label>Resultado<select name="status" defaultValue="reviewing"><option value="reviewing">En revisión</option><option value="resolved">Resuelta</option><option value="dismissed">Desestimada</option></select></label><label className="admin-form-wide">Resolución<input name="note" minLength={3} maxLength={1000} required placeholder="Decisión y fundamento" /></label><AdminSubmitButton>Guardar resolución</AdminSubmitButton></form></details>}
                </article>; })}
              </div>}
            </>
          )}

          {section === "guia" && <AdminGuide data={data} />}

          {section === "auditoria" && (
            <>
              <div className="admin-section-heading"><div><span>Trazabilidad</span><h2>Auditoría técnica</h2></div><small>Últimos {data.audit.length} eventos</small></div>
              {data.audit.length === 0 ? <EmptyAdmin>No hay eventos técnicos registrados.</EmptyAdmin> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Fecha</th><th>Acción</th><th>Entidad</th><th>Resultado</th></tr></thead><tbody>{data.audit.map((entry) => <tr key={entry.id}><td>{formatDate(entry.created_at)}</td><td><strong>{entry.action}</strong></td><td>{entry.entity_type ?? "—"}<small>{entry.entity_id?.slice(0, 14)}</small></td><td><span className={`admin-status status-${entry.outcome}`}>{entry.outcome}</span></td></tr>)}</tbody></table></div>}
            </>
          )}
        </div>
      </section>
      <SiteFooter inner />
    </main>
  );
}
