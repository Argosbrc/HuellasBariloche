import { ArrowLeft, CalendarDays, Cat, Dog, HeartHandshake, MapPin, MessageCircle, PawPrint, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DataNotice } from "@/components/data-notice";
import { CaseSightingReport } from "@/components/case-sighting-report";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPetCase, getPetCaseContact, storagePublicUrl } from "@/lib/public-api";
import { getOptionalAccountProfile } from "@/lib/account";
import { startConversation } from "@/app/conversaciones/actions";

export const dynamic = "force-dynamic";

function statusLabel(type: string) {
  if (type === "lost") return "Perdido";
  if (type === "found") return "Encontrado";
  if (type === "adoption") return "En adopción";
  return type;
}

export default async function PetCaseDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { id } = await params;
  const [petResult, contactResult, account, feedback] = await Promise.all([getPetCase(id), getPetCaseContact(id), getOptionalAccountProfile(), searchParams]);
  const pet = petResult.data;
  if (!pet) notFound();
  const contact = contactResult.data;
  const Icon = pet.species?.toLowerCase().includes("gat") ? Cat : Dog;
  const images = (pet.photo_paths || []).map((path) => storagePublicUrl("pet-photos", path)).filter(Boolean) as string[];
  const whatsappUrl = contact?.whatsapp
    ? `https://wa.me/${contact.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, vi la publicación de ${pet.name || "la mascota"} en Huellas Bariloche.`)}`
    : null;

  return (
    <main className="inner-shell case-detail-shell">
      <SiteHeader inner />
      <DataNotice configured={petResult.configured} empty={false} />
      {(feedback.ok || feedback.error) && <div className={feedback.error ? "admin-feedback admin-feedback-error case-detail-feedback" : "admin-feedback case-detail-feedback"}>{feedback.error ?? feedback.ok}</div>}
      <section className="case-detail">
        <Link className="case-detail-back" href="/casos"><ArrowLeft />Volver a casos</Link>
        <div className="case-detail-grid">
          <div className="case-detail-gallery">
            {images.length ? <img className="case-detail-cover" src={images[0]} alt={pet.name || "Mascota publicada"} /> : <span className="case-detail-placeholder"><Icon /></span>}
            {images.length > 1 && <div className="case-detail-thumbs">{images.slice(1).map((image, index) => <img src={image} alt={`Foto ${index + 2} de ${pet.name || "la mascota"}`} key={image} />)}</div>}
          </div>

          <div className="case-detail-content">
            <span className={`case-detail-status ${pet.post_type}`}>{statusLabel(pet.post_type)}</span>
            <h1>{pet.name || "Sin nombre"}</h1>
            <p className="case-detail-species">{[pet.species, pet.breed, pet.sex, pet.age_label].filter(Boolean).join(" · ")}</p>
            <div className="case-detail-facts"><span><MapPin />{pet.zone_name || pet.city_name}<small>Ubicación pública aproximada</small></span>{pet.event_at && <span><CalendarDays />{new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" }).format(new Date(pet.event_at))}</span>}<span><PawPrint />Publicado por {pet.rescuer_name || pet.owner_display_name || "un miembro de la comunidad"}</span></div>
            <div className="case-detail-description"><h2>Información del caso</h2><p>{pet.description || pet.distinctive_features || "No se agregó una descripción adicional."}</p>{pet.distinctive_features && pet.description && <p><strong>Señas particulares:</strong> {pet.distinctive_features}</p>}</div>

            {pet.post_type !== "adoption" && account?.id !== pet.owner_id && (account ? <div className="case-contact-card huellas-chat"><ShieldCheck /><div><strong>Contactar por Huellas</strong><span>Escribile dentro de la plataforma sin mostrar tu teléfono.</span></div><form action={startConversation}><input name="pet_post_id" type="hidden" value={pet.id} /><button className="button button-primary" type="submit"><MessageCircle />Enviar mensaje</button></form></div> : <div className="case-contact-card huellas-chat"><ShieldCheck /><div><strong>Contacto privado disponible</strong><span>Ingresá para escribir dentro de Huellas sin compartir tu número.</span></div><Link className="button button-primary" href={`/ingresar?returnTo=/casos/${pet.id}`}>Ingresar</Link></div>)}

            {pet.post_type === "adoption" ? (
              <div className="case-contact-card adoption"><HeartHandshake /><div><strong>¿Querés darle un hogar?</strong><span>Completá el filtro esencial para que el rescatista pueda evaluar la solicitud.</span></div><a className="button adoption-primary-action" href={`/adopciones/${pet.id}/solicitar`}>Quiero adoptar</a></div>
            ) : pet.post_type === "lost" ? (
              <>
                {account?.id === pet.owner_id ? (
                  <div className="case-contact-card huellas-chat">
                    <ShieldCheck />
                    <div>
                      <strong>Este es tu caso</strong>
                      <span>Podés revisar los avisos y avistamientos recibidos desde tu panel.</span>
                    </div>
                    <Link className="button button-primary" href="/panel#avisos-casos">
                      <MessageCircle />
                      Ver avisos
                    </Link>
                  </div>
                ) : (
                  <>
                    {whatsappUrl && <div className="case-contact-card"><MessageCircle /><div><strong>Contactar a {contact?.publisher_name}</strong><span>El publicador autorizó mostrar este medio de contacto.</span></div><a className="button button-primary" href={whatsappUrl} target="_blank" rel="noreferrer">Enviar WhatsApp</a></div>}
                    <CaseSightingReport petPostId={pet.id} petName={pet.name || "esta mascota"} publisherName={contact?.publisher_name || pet.owner_display_name || "la persona que publicó el caso"} hasPublicWhatsapp={Boolean(whatsappUrl)} />
                  </>
                )}
              </>
            ) : whatsappUrl ? (
              <div className="case-contact-card"><MessageCircle /><div><strong>Contactar a {contact?.publisher_name}</strong><span>El publicador autorizó mostrar este medio de contacto.</span></div><a className="button button-primary" href={whatsappUrl} target="_blank" rel="noreferrer">Enviar WhatsApp</a></div>
            ) : (
              <div className="case-contact-card private"><ShieldCheck /><div><strong>Contacto protegido</strong><span>La persona no habilitó un teléfono público. Compartí la ficha para ayudar a que llegue a su red.</span></div></div>
            )}
          </div>
        </div>
      </section>
      <SiteFooter inner />
    </main>
  );
}
