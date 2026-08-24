import {
  BadgeCheck,
  Cat,
  Check,
  Dog,
  Heart,
  HeartHandshake,
  Home,
  Info,
  MapPin,
  PawPrint,
  ShieldCheck,
} from "lucide-react";
import { DataNotice } from "@/components/data-notice";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getAdoptions, storagePublicUrl } from "@/lib/public-api";

export const dynamic = "force-dynamic";

function sexLabel(value: string | null) {
  if (!value) return "A consultar";
  const clean = value.toLowerCase();
  if (["male", "macho", "masculino"].includes(clean)) return "Macho";
  if (["female", "hembra", "femenino"].includes(clean)) return "Hembra";
  return value;
}

export default async function AdoptionsPage() {
  const result = await getAdoptions();
  return (
    <main className="inner-shell">
      <SiteHeader inner />
      <section className="inner-hero adoption-hero">
        <div><span className="section-kicker">Adopción responsable</span><h1>Una nueva historia<em>empieza en casa.</em></h1><p>Conocé animales publicados por rescatistas verificados y encontrá una adopción compatible con tu familia.</p></div>
        <div className="adoption-illustration"><span className="adoption-halo" /><Dog className="adoption-dog" size={125} /><Cat className="adoption-cat" size={92} /><div><ShieldCheck size={22} /><strong>Publicaciones verificadas</strong><small>Información sanitaria y requisitos de hogar.</small></div></div>
      </section>
      <DataNotice configured={result.configured} empty={result.data.length === 0} />
      <section className="section adoption-list">
        <div className="section-heading heading-row"><div><span className="section-kicker">Esperan una familia</span><h2>Adopciones disponibles</h2></div></div>
        {result.data.length ? <div className="adoption-profile-list">
          {result.data.map((item) => {
            const Icon = item.species?.toLowerCase().includes("gat") ? Cat : Dog;
            const imageUrl = storagePublicUrl(
              "pet-photos",
              item.cover_image_path || item.photo_paths?.[0] || null,
            );
            const healthFacts = [
              item.vaccinated ? "Vacunado" : null,
              item.dewormed ? "Desparasitado" : null,
              item.neutered ? "Castrado" : null,
            ].filter(Boolean) as string[];
            const compatibility = [
              item.good_with_children ? "Convive con niños" : null,
              item.good_with_dogs ? "Convive con perros" : null,
              item.good_with_cats ? "Convive con gatos" : null,
            ].filter(Boolean) as string[];
            return <article className="adoption-profile-card" key={item.id}>
              <div className="adoption-profile-media case-amber">
                {imageUrl ? <img src={imageUrl} alt={item.name || "Mascota en adopción"} loading="lazy" decoding="async" /> : <Icon size={104} strokeWidth={1.15} />}
                <span className="adoption-photo-label"><HeartHandshake size={13} />En adopción</span>
                <span className="adoption-heart" aria-hidden="true"><Heart size={23} /></span>
              </div>

              <div className="adoption-profile-main">
                <span className="adoption-verified"><BadgeCheck size={14} />Publicación de rescatista verificado</span>
                <h2>{item.name || "Sin nombre"}</h2>
                <div className="adoption-main-facts">
                  <span><strong>Sexo</strong>{sexLabel(item.sex)}</span>
                  <span><strong>Tamaño</strong>{item.size_label || "A consultar"}</span>
                  <span><strong>Especie</strong>{[item.species, item.breed].filter(Boolean).join(" · ") || "Mascota"}</span>
                </div>
                <p>{item.description || "Está esperando una familia responsable. Consultá con el rescatista para conocer su historia y personalidad."}</p>
                {(healthFacts.length > 0 || compatibility.length > 0) && <div className="adoption-traits">
                  {healthFacts.map((fact) => <span key={fact}><Check size={12} />{fact}</span>)}
                  {compatibility.map((fact) => <span key={fact}><PawPrint size={12} />{fact}</span>)}
                </div>}
                <a className="button adoption-primary-action" href={`/adopciones/${item.id}/solicitar`}>Quiero adoptar a {item.name || "esta mascota"}</a>
              </div>

              <aside className="adoption-profile-aside">
                <dl>
                  <div><dt>Edad</dt><dd>{item.age_label || "A consultar"}</dd></div>
                  <div><dt>Está en</dt><dd>Resguardo</dd></div>
                  <div><dt>Ubicación</dt><dd><MapPin size={14} />{item.zone_name || item.city_name}</dd></div>
                  <div><dt>Rescatista</dt><dd>{item.rescuer_name || "Verificado"}</dd></div>
                </dl>
                <div className="adoption-home-note"><Home size={18} /><span><strong>Hogar ideal</strong><small>{item.home_requirements || "Los requisitos se coordinan con el rescatista."}</small></span></div>
                <a className="adoption-more-link" href={`/casos/${item.id}`}><Info size={15} />Más información</a>
              </aside>
            </article>;
          })}
        </div> : <div className="empty-state"><HeartHandshake size={36} /><strong>Todavía no hay adopciones publicadas</strong><span>La sección se actualizará automáticamente.</span></div>}
      </section>
      <SiteFooter inner />
    </main>
  );
}
