import { Archive, ArrowRight, MessageCircle, PawPrint, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { loadConversationInbox } from "@/lib/conversations";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "Sin mensajes todavía";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [data, params] = await Promise.all([loadConversationInbox(), searchParams]);
  return <main className="inner-shell conversation-shell">
    <SiteHeader inner />
    <section className="conversation-hero">
      <div><span className="section-kicker"><MessageCircle /> Mensajería protegida</span><h1>Tus conversaciones</h1><p>Coordiná la ayuda dentro de Huellas sin publicar tu teléfono. Solo las dos personas del hilo pueden leer los mensajes.</p></div>
      <div className="conversation-privacy"><ShieldCheck /><span><strong>Privadas por diseño</strong><small>Podés bloquear, archivar o denunciar cuando lo necesites.</small></span></div>
    </section>
    {(params.ok || params.error) && <div className={params.error ? "admin-feedback admin-feedback-error" : "admin-feedback"}>{params.error ?? params.ok}</div>}
    {data.error && <div className="admin-feedback admin-feedback-error">{data.error}</div>}
    <section className="conversation-inbox">
      {data.conversations.length ? data.conversations.map((item) => <Link className="conversation-row" href={`/conversaciones/${item.id}`} key={item.id}>
        {item.pet_photo_url ? <img src={item.pet_photo_url} alt={item.pet_name || "Mascota del caso"} /> : <span className="conversation-pet-placeholder"><PawPrint /></span>}
        <div className="conversation-row-copy"><header><strong>{item.other_display_name}</strong><small>{formatDate(item.last_message_at)}</small></header><span>{item.pet_name || "Caso sin nombre"}</span><p>{item.last_message || "Abrí la conversación para enviar el primer mensaje."}</p></div>
        {item.unread_count > 0 && <em>{item.unread_count}</em>}
        {item.blocked_by_me && <span className="conversation-blocked"><Archive />Bloqueado</span>}
        <ArrowRight className="conversation-row-arrow" />
      </Link>) : <div className="conversation-empty"><MessageCircle /><h2>Todavía no hay conversaciones</h2><p>Desde la ficha de una mascota podés contactar al publicador sin revelar tu número.</p><Link className="button button-primary" href="/casos">Ver casos</Link></div>}
    </section>
    <SiteFooter inner />
  </main>;
}
