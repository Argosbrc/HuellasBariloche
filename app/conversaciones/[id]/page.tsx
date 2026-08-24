import { Archive, ArrowLeft, Ban, Flag, MessageCircle, PawPrint, Send, ShieldCheck, Undo2 } from "lucide-react";
import Link from "next/link";
import { archiveConversation, reportConversationMessage, sendConversationMessage, setConversationBlock } from "@/app/conversaciones/actions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { loadConversation } from "@/lib/conversations";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [{ id }, feedback] = await Promise.all([params, searchParams]);
  const { conversation } = await loadConversation(id);
  const blocked = conversation.blocked_by_me || conversation.blocked_me;
  return <main className="inner-shell conversation-shell">
    <SiteHeader inner />
    <section className="conversation-thread-header">
      <Link href="/conversaciones"><ArrowLeft />Conversaciones</Link>
      <div className="conversation-contact">
        {conversation.other_avatar_url ? <img src={conversation.other_avatar_url} alt={conversation.other_display_name} /> : <span>{conversation.other_display_name.slice(0, 2).toUpperCase()}</span>}
        <div><h1>{conversation.other_display_name}</h1><Link href={`/casos/${conversation.pet_post_id}`}><PawPrint />{conversation.pet_name || "Ver caso relacionado"}</Link></div>
      </div>
      <div className="conversation-tools">
        <form action={archiveConversation}><input name="conversation_id" type="hidden" value={conversation.id} /><button type="submit"><Archive />Archivar</button></form>
        <form action={setConversationBlock}><input name="conversation_id" type="hidden" value={conversation.id} /><input name="target_user_id" type="hidden" value={conversation.other_user_id} /><input name="blocked" type="hidden" value={conversation.blocked_by_me ? "false" : "true"} /><button className={conversation.blocked_by_me ? "unblock" : "block"} type="submit">{conversation.blocked_by_me ? <Undo2 /> : <Ban />}{conversation.blocked_by_me ? "Desbloquear" : "Bloquear"}</button></form>
      </div>
    </section>
    {(feedback.ok || feedback.error) && <div className={feedback.error ? "admin-feedback admin-feedback-error" : "admin-feedback"}>{feedback.error ?? feedback.ok}</div>}
    <section className="conversation-thread" aria-label="Mensajes de la conversación">
      {conversation.messages.length ? conversation.messages.map((message) => <article className={message.mine ? "message-bubble mine" : "message-bubble theirs"} key={message.id}>
        <p>{message.body}</p><small>{formatDate(message.created_at)}</small>
        {!message.mine && <details className="message-report"><summary><Flag />Denunciar mensaje</summary><form action={reportConversationMessage}><input name="conversation_id" type="hidden" value={conversation.id} /><input name="message_id" type="hidden" value={message.id} /><label>Motivo<select name="reason" required defaultValue=""><option disabled value="">Elegir</option><option value="spam">Spam</option><option value="abuse">Maltrato o acoso</option><option value="fraud">Engaño o fraude</option><option value="privacy">Datos privados</option><option value="other">Otro</option></select></label><label>Detalle <small>opcional</small><textarea maxLength={1000} minLength={5} name="details" rows={3} /></label><button type="submit">Enviar denuncia</button></form></details>}
      </article>) : <div className="conversation-empty compact"><MessageCircle /><h2>Iniciá la conversación</h2><p>Contá brevemente por qué te comunicás y evitá compartir datos sensibles hasta confirmar con quién hablás.</p></div>}
    </section>
    {blocked ? <div className="conversation-block-notice"><ShieldCheck /><div><strong>No se pueden enviar mensajes</strong><span>{conversation.blocked_by_me ? "Desbloqueá a esta persona si querés retomar la conversación." : "La conversación fue pausada por una de las personas."}</span></div></div> : <form className="conversation-composer" action={sendConversationMessage}><input name="conversation_id" type="hidden" value={conversation.id} /><label htmlFor="conversation-body">Mensaje</label><textarea id="conversation-body" maxLength={4000} minLength={1} name="body" placeholder="Escribí tu mensaje…" required rows={3} /><button className="button button-primary" type="submit"><Send />Enviar</button></form>}
    <SiteFooter inner />
  </main>;
}
