import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, Eye, MapPin, RotateCcw, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { setMyCommunityPostState, updateMyCommunityPost } from "@/app/comunidad/actions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { loadMyCommunityPost } from "@/lib/community";

export const dynamic = "force-dynamic";

function inputDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export default async function ManageCommunityPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  const { post } = await loadMyCommunityPost(id);
  const removed = post.moderation_status === "removed";
  return <main className="inner-shell community-manage-shell">
    <SiteHeader inner />
    <section className="community-manage-heading"><Link href="/panel"><ArrowLeft />Volver a mi panel</Link><div><span className="section-kicker">Mi publicación</span><h1>Gestionar Comunidad</h1><p>Editá la información, ajustá su vigencia o marcala como resuelta.</p></div>{!removed && !post.resolved_at && <Link className="button button-light" href={`/comunidad/${post.id}`}><Eye />Ver publicada</Link>}</section>
    {(feedback.ok || feedback.error) && <div className={feedback.error ? "admin-feedback admin-feedback-error" : "admin-feedback"}>{feedback.error ?? feedback.ok}</div>}
    <section className="community-manage-status"><article><Clock3 /><span><strong>Vigencia</strong><small>{post.is_expired ? "Vencida" : post.expires_at ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(post.expires_at)) : "Sin fecha"}</small></span></article><article><CheckCircle2 /><span><strong>Estado</strong><small>{removed ? "Retirada" : post.resolved_at ? "Resuelta" : "Activa"}</small></span></article><article><Eye /><span><strong>Interacciones</strong><small>{post.likes_count} Me gusta · {post.comments_count} comentarios</small></span></article></section>
    {!removed && <form className="community-edit-form" action={updateMyCommunityPost}><input name="post_id" type="hidden" value={post.id} /><label className="form-wide">Publicación<textarea defaultValue={post.body} maxLength={3000} minLength={3} name="body" required rows={8} /></label><label><MapPin />Lugar o barrio<input defaultValue={post.place_name || ""} maxLength={160} minLength={2} name="place_name" placeholder="Ej.: Centro, Melipal, Frutillar" /></label><label><CalendarDays />Fecha de actividad<input defaultValue={inputDate(post.event_at)} name="event_at" type="datetime-local" /></label><label><Clock3 />Visible hasta<input defaultValue={inputDate(post.expires_at)} name="expires_at" type="datetime-local" /></label><div className="community-edit-submit"><button className="button button-primary" type="submit"><Save />Guardar cambios</button></div></form>}
    {!removed && <section className="community-state-actions"><div><h2>Cambiar estado</h2><p>Cuando la ayuda ya llegó, marcala como resuelta para retirarla del feed activo.</p></div>{post.resolved_at ? <form action={setMyCommunityPostState}><input name="post_id" type="hidden" value={post.id} /><input name="action" type="hidden" value="reopen" /><button className="button button-light" type="submit"><RotateCcw />Reabrir publicación</button></form> : <form action={setMyCommunityPostState}><input name="post_id" type="hidden" value={post.id} /><input name="action" type="hidden" value="resolve" /><button className="button button-primary" type="submit"><CheckCircle2 />Marcar resuelta</button></form>}<details><summary><Trash2 />Retirar definitivamente</summary><p>Dejará de mostrarse y no podrá reabrirse.</p><form action={setMyCommunityPostState}><input name="post_id" type="hidden" value={post.id} /><input name="action" type="hidden" value="remove" /><button type="submit">Confirmar retiro</button></form></details></section>}
    <SiteFooter inner />
  </main>;
}
