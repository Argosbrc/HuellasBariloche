"use client";

import {
  CalendarDays,
  CircleHelp,
  Heart,
  Lightbulb,
  MapPin,
  MessageCircle,
  PackageOpen,
  Share2,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { recordCommunityShare } from "@/app/comunidad/actions";
import type { CommunityPost } from "@/lib/types";

type CommunityPostWithImage = CommunityPost & { imageUrl: string | null };

const categories = [
  { value: "all", label: "Todo" },
  { value: "help", label: "Piden ayuda" },
  { value: "activity", label: "Actividades" },
  { value: "offer", label: "Ofrecen" },
  { value: "info", label: "Información" },
] as const;

function categoryFor(postType: string) {
  if (postType === "question") return { value: "help", label: "Pedido de ayuda", Icon: CircleHelp, className: "help" };
  if (["walk", "meetup", "event"].includes(postType)) return { value: "activity", label: "Convocatoria", Icon: CalendarDays, className: "activity" };
  if (postType === "recommendation") return { value: "offer", label: "Ofrecimiento", Icon: PackageOpen, className: "offer" };
  return { value: "info", label: "Información útil", Icon: Lightbulb, className: "info" };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(new Date(value));
}

export function CommunityFeed({ posts, canRecordShares }: { posts: CommunityPostWithImage[]; canRecordShares: boolean }) {
  const [filter, setFilter] = useState("all");
  const visible = useMemo(
    () => posts.filter((post) => filter === "all" || categoryFor(post.post_type).value === filter),
    [filter, posts],
  );

  async function sharePost(post: CommunityPost) {
    const text = `${post.author_display_name}: ${post.body}`;
    const url = `${window.location.origin}/comunidad/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Comunidad Huellas", text, url });
        if (canRecordShares) void recordCommunityShare(post.id);
      } catch {
        // Cancelar la hoja nativa no debe contabilizarse como contenido compartido.
      }
      return;
    }
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      if (canRecordShares) void recordCommunityShare(post.id);
    } catch {
      return;
    }
  }

  return <>
    <div className="feed-heading community-feed-heading">
      <div><span className="section-kicker">Actividad reciente</span><h2>La comunidad se organiza</h2></div>
      <div className="filter-row community-filters" role="group" aria-label="Filtrar publicaciones comunitarias">
        {categories.map((category) => <button className={filter === category.value ? "filter active" : "filter"} key={category.value} onClick={() => setFilter(category.value)} type="button">{category.label}</button>)}
      </div>
    </div>

    {visible.length ? visible.map((post) => {
      const category = categoryFor(post.post_type);
      const Icon = category.Icon;
      return <article className={`feed-card community-post-card community-post-${category.className}`} id={`publicacion-${post.id}`} key={post.id}>
        <header>
          <span className="avatar avatar-green">{post.author_display_name.slice(0, 2).toUpperCase()}</span>
          <div><strong>{post.author_display_name}<ShieldCheck size={13} /></strong><small><MapPin size={11} />{post.place_name || "Bariloche"} · {formatDate(post.created_at)}</small></div>
        </header>
        {post.imageUrl && <Link className="community-feed-photo-link" href={`/comunidad/${post.id}`}><img className="feed-photo" src={post.imageUrl} alt={`Imagen de ${category.label.toLowerCase()}`} loading="lazy" decoding="async" /></Link>}
        <div className="feed-copy">
          <span className={`community-type community-type-${category.className}`}><Icon size={13} />{category.label}</span>
          <p>{post.body}</p>
          {post.event_at && <div className="community-event-date"><CalendarDays size={14} /><span><strong>Fecha de la actividad</strong>{new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(post.event_at))}</span></div>}
          <Link className="community-open-post" href={`/comunidad/${post.id}`}>Ver publicación y participar</Link>
        </div>
        <footer>
          <Link href={`/comunidad/${post.id}`}><Heart size={14} />{post.likes_count}</Link>
          <Link href={`/comunidad/${post.id}#comentarios`}><MessageCircle size={14} />{post.comments_count}</Link>
          <button onClick={() => sharePost(post)} type="button"><Share2 size={14} />Compartir · {post.shares_count}</button>
        </footer>
      </article>;
    }) : <div className="empty-state"><MessageCircle size={36} /><strong>No hay publicaciones en esta categoría</strong><span>Podés ser la primera persona en activar esta parte de la red.</span></div>}
  </>;
}
