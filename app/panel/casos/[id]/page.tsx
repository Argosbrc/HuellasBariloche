import { ArrowLeft, Clock3, ExternalLink, History, PencilLine, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CaseStateActions } from "@/components/case-state-actions";
import { EditPetPostForm } from "@/components/edit-pet-post-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { requireAccount } from "@/lib/account";
import type { EditablePetPost } from "@/lib/types";

export const dynamic = "force-dynamic";

function stateLabel(state: string) {
  const labels: Record<string, string> = {
    lost: "Perdido",
    sighted: "Con avistamientos",
    found: "Encontrado",
    available: "En adopción",
    reunited: "Reunido con su familia",
    adopted: "Adopción concretada",
    closed: "Cerrado",
    archived: "Archivado",
  };
  return labels[state] || state;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function ManagePetCasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { supabase, profile } = await requireAccount();
  const [{ data, error }, contactResult] = await Promise.all([
    supabase.rpc("get_my_pet_post_editor_v1", { p_pet_post_id: id }),
    supabase.from("profile_contacts").select("whatsapp").eq("user_id", profile.id).maybeSingle(),
  ]);

  if (error || !data || typeof data !== "object") {
    redirect(`/panel?error=${encodeURIComponent(error?.message || "El caso no existe o no te pertenece.")}`);
  }

  const post = data as EditablePetPost;
  const active = ["lost", "sighted", "found", "available"].includes(post.post_state);
  const hasWhatsapp = Boolean(contactResult.data?.whatsapp?.trim());

  return <main className="inner-shell case-management-page">
    <SiteHeader inner />
    <section className="case-management-hero">
      <div><Link href="/panel"><ArrowLeft />Volver a mi panel</Link><span className="section-kicker"><PencilLine /> Gestión del caso</span><h1>{post.name || `${post.species} sin nombre`}</h1><p>Actualizá la ficha, revisá su historial y cerrá la búsqueda cuando corresponda.</p></div>
      <aside><span className={`case-management-status state-${post.post_state}`}>{stateLabel(post.post_state)}</span><small>Última actualización</small><strong>{formatDate(post.updated_at)}</strong>{["lost", "sighted", "found", "available", "reunited", "adopted"].includes(post.post_state) && <Link href={`/casos/${post.id}`} target="_blank">Ver ficha pública<ExternalLink /></Link>}</aside>
    </section>

    {(query.ok || query.error) && <div className={query.error ? "admin-feedback admin-feedback-error case-management-feedback" : "admin-feedback case-management-feedback"}>{query.error || query.ok}</div>}

    {!active && <div className="case-closed-notice"><ShieldCheck /><div><strong>La edición quedó bloqueada porque el caso ya no está activo.</strong><span>Podés consultar el historial y archivarlo. Los datos no se borraron.</span></div></div>}

    {active && <EditPetPostForm hasWhatsapp={hasWhatsapp} post={post} />}

    <section className="case-management-bottom">
      <article className="case-resolution-panel"><header><span><ShieldCheck /></span><div><small>Cierre seguro</small><h2>Resolver o archivar</h2><p>Al cerrar el caso desaparece del mapa, el carrusel y los listados activos, pero conserva toda su información.</p></div></header><CaseStateActions postId={post.id} postState={post.post_state} postType={post.post_type} /></article>
      <article className="case-history-panel"><header><History /><div><small>Trazabilidad</small><h2>Historial del caso</h2></div></header>{post.history.length ? <ol>{post.history.map((item, index) => <li key={`${item.created_at}-${index}`}><span><Clock3 /></span><div><strong>{stateLabel(item.to_state)}</strong><small>{formatDate(item.created_at)}</small>{item.reason && <p>{item.reason}</p>}</div></li>)}</ol> : <p className="case-history-empty">Todavía no hay cambios de estado registrados.</p>}</article>
    </section>
    <SiteFooter inner />
  </main>;
}
