import { ArrowLeft, CalendarDays, CheckCircle2, Flag, Heart, MapPin, MessageCircle, PencilLine, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { addCommunityComment, removeCommunityComment, reportCommunityContent, setCommunityLike } from "@/app/comunidad/actions";
import { CommunityShareButton } from "@/components/community-share-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { loadCommunityPost } from "@/lib/community";
import { storagePublicUrl } from "@/lib/public-api";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function reportForm(postId: string, targetType: "community_post" | "community_comment", targetId: string) {
  return <details className="community-report"><summary><Flag />Denunciar</summary><form action={reportCommunityContent}><input name="post_id" type="hidden" value={postId} /><input name="target_type" type="hidden" value={targetType} /><input name="target_id" type="hidden" value={targetId} /><label>Motivo<select name="reason" required defaultValue=""><option disabled value="">Elegir</option><option value="spam">Spam</option><option value="abuse">Maltrato o acoso</option><option value="fraud">Engaño o fraude</option><option value="privacy">Datos privados</option><option value="other">Otro</option></select></label><label>Detalle <small>opcional</small><textarea maxLength={1000} minLength={5} name="details" rows={3} /></label><button type="submit">Enviar a administración</button></form></details>;
}

export default async function CommunityPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  const { post, comments, userId } = await loadCommunityPost(id);
  const isOwner = userId === post.author_id;
  const images = (post.media ?? []).map((item) => ({ ...item, url: storagePublicUrl("community-media", item.storage_path) })).filter((item) => item.url);
  return <main className="inner-shell community-detail-shell">
    <SiteHeader inner />
    <section className="community-detail-top"><Link href="/comunidad"><ArrowLeft />Volver a Comunidad</Link>{isOwner && <Link className="button button-light" href={`/panel/comunidad/${post.id}`}><PencilLine />Gestionar publicación</Link>}</section>
    {(feedback.ok || feedback.error) && <div className={feedback.error ? "admin-feedback admin-feedback-error" : "admin-feedback"}>{feedback.error ?? feedback.ok}</div>}
    <article className="community-detail-card">
      <header><span className="community-detail-avatar">{post.author_display_name.slice(0, 2).toUpperCase()}</span><div><h1>{post.author_display_name}</h1><span>{post.place_name && <><MapPin />{post.place_name} · </>}{formatDate(post.created_at)}</span></div><ShieldCheck /></header>
      {images.length > 0 && <div className={images.length > 1 ? "community-detail-gallery multiple" : "community-detail-gallery"}>{images.map((image) => <img alt={image.alt_text} key={image.id} src={image.url || undefined} />)}</div>}
      <div className="community-detail-body"><p>{post.body}</p>{post.event_at && <div className="community-event-date"><CalendarDays /><span><strong>Fecha de la actividad</strong>{formatDate(post.event_at)}</span></div>}</div>
      <footer className="community-detail-actions">
        {userId ? <form action={setCommunityLike}><input name="post_id" type="hidden" value={post.id} /><input name="liked" type="hidden" value={post.liked_by_me ? "false" : "true"} /><button className={post.liked_by_me ? "liked" : ""} type="submit"><Heart />{post.liked_by_me ? "Te gusta" : "Me gusta"} · {post.likes_count}</button></form> : <Link href={`/ingresar?returnTo=/comunidad/${post.id}`}><Heart />Me gusta · {post.likes_count}</Link>}
        <a href="#comentarios"><MessageCircle />Comentarios · {post.comments_count}</a>
        <CommunityShareButton canRecord={Boolean(userId)} postId={post.id} shareCount={post.shares_count} text={`${post.author_display_name}: ${post.body}`} />
        {!isOwner && userId && reportForm(post.id, "community_post", post.id)}
      </footer>
    </article>

    <section className="community-comments" id="comentarios">
      <header><div><span className="section-kicker"><MessageCircle /> Conversación pública</span><h2>Comentarios</h2></div><span>{comments.length}</span></header>
      {userId ? <form className="community-comment-form" action={addCommunityComment}><input name="post_id" type="hidden" value={post.id} /><label htmlFor="community-comment">Sumate a la conversación</label><textarea id="community-comment" maxLength={1500} minLength={1} name="body" placeholder="Escribí un comentario respetuoso y útil…" required rows={3} /><button className="button button-primary" type="submit"><MessageCircle />Comentar</button></form> : <div className="community-login-note"><ShieldCheck /><span><strong>Ingresá para comentar</strong><small>Tu nombre público acompañará el comentario.</small></span><Link href={`/ingresar?returnTo=/comunidad/${post.id}`}>Ingresar</Link></div>}
      <div className="community-comment-list">{comments.length ? comments.map((comment) => <article key={comment.id}><span className="community-comment-avatar">{comment.author_display_name.slice(0, 2).toUpperCase()}</span><div><header><strong>{comment.author_display_name}</strong><small>{formatDate(comment.created_at)}</small></header><p>{comment.body}</p><footer>{userId === comment.author_id ? <form action={removeCommunityComment}><input name="post_id" type="hidden" value={post.id} /><input name="comment_id" type="hidden" value={comment.id} /><button type="submit"><Trash2 />Retirar</button></form> : userId ? reportForm(post.id, "community_comment", comment.id) : null}</footer></div></article>) : <div className="community-no-comments"><CheckCircle2 /><span><strong>Todavía no hay comentarios</strong><small>Podés dejar el primero y ayudar a mover la publicación.</small></span></div>}</div>
    </section>
    <SiteFooter inner />
  </main>;
}
