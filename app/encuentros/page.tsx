import { ArrowRight, HeartHandshake, House, MapPin, PawPrint, Sparkles, UsersRound } from "lucide-react";
import Link from "next/link";
import { DataNotice } from "@/components/data-notice";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPublicReunions, storagePublicUrl } from "@/lib/public-api";

export const dynamic = "force-dynamic";

export default async function EncountersPage() {
  const result = await getPublicReunions();
  return <main className="inner-shell reunion-page">
    <SiteHeader inner />
    <section className="reunion-hero"><div><span className="section-kicker"><House size={15} /> Encuentros</span><h1>Historias que vuelven <em>a casa.</em></h1><p>Este espacio celebra a las mascotas reunidas con su familia y a cada persona que miró, avisó, compartió o ayudó.</p><Link className="button button-primary" href="/casos">Ayudar en una búsqueda <ArrowRight /></Link></div><aside><Sparkles /><strong>Tu atención puede cambiar una historia</strong><span>Cuando un aviso confirmado ayuda en un reencuentro, la persona recibe un agradecimiento y su medalla.</span></aside></section>
    <DataNotice configured={result.configured} empty={result.data.length === 0} />
    <section className="reunion-content"><header><div><span className="section-kicker">Volvieron con su familia</span><h2>Cada encuentro es de toda la comunidad</h2></div><Link href="/medallas">Ver medallero</Link></header>{result.data.length ? <div className="reunion-grid">{result.data.map((item) => {
      const image = storagePublicUrl("pet-photos", item.photo_url);
      return <article id={`encuentro-${item.id}`} key={item.id}><div className="reunion-photo">{image ? <img src={image} alt={item.name || "Mascota reunida con su familia"} /> : <PawPrint />}<span><House />Reencuentro</span></div><div className="reunion-copy"><small>{new Intl.DateTimeFormat("es-AR", { dateStyle: "long" }).format(new Date(item.reunited_at))}</small><h3>{item.name || "Esta mascota"} volvió a casa</h3><p><MapPin />{item.zone_name || "San Carlos de Bariloche"}</p><blockquote>“{item.name || "Esta mascota"} pudo reencontrarse con su familia gracias a vos y a toda la red.”</blockquote>{item.contributor_count > 0 && <span className="reunion-contributors"><UsersRound />{item.contributor_count === 1 ? "1 colaboración vinculada" : `${item.contributor_count} colaboraciones vinculadas`}</span>}</div></article>;
    })}</div> : <div className="empty-state reunion-empty"><HeartHandshake /><strong>Las próximas historias felices aparecerán acá</strong><span>Cuando una familia marque su caso como reunido, se sumará automáticamente.</span></div>}</section>
    <SiteFooter inner />
  </main>;
}
