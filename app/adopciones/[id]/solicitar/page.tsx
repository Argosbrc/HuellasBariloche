import { ArrowLeft, HeartHandshake, Home, MapPin, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { submitAdoptionApplication } from "@/app/adopciones/actions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { requireAccount } from "@/lib/account";
import { getPetCase, storagePublicUrl } from "@/lib/public-api";

export const dynamic = "force-dynamic";

const questions = [
  {
    name: "secure_home",
    title: "¿El lugar donde va a vivir cuenta con patio totalmente cercado y portón seguro?",
    options: [
      ["yes", "Sí"],
      ["no", "No"],
      ["apartment_safe_balcony", "Es departamento (tiene balcón seguro)"],
    ],
  },
  {
    name: "financial_capacity",
    title: "La adopción requiere vacunas anuales, buen alimento y atención veterinaria si se enferma. ¿Podés afrontar estos gastos?",
    options: [["yes", "Sí"], ["no", "No"], ["with_effort", "Con esfuerzo"]],
  },
  {
    name: "neuter_commitment",
    title: "¿Te comprometés firmemente a castrarlo antes del año de vida?",
    options: [["agreed", "Sí, de acuerdo"], ["cannot_guarantee", "No puedo garantizarlo"]],
  },
  {
    name: "follow_up_commitment",
    title: "¿Estás de acuerdo con firmar un compromiso de adopción y enviarnos fotos o videos para el seguimiento de su adaptación?",
    options: [["agreed", "Sí, totalmente"], ["prefer_not", "Prefiero que no"]],
  },
] as const;

export default async function AdoptionApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [{ profile, contacts }, petResult] = await Promise.all([
    requireAccount().then(async (account) => {
      const { data: contacts } = await account.supabase
        .from("profile_contacts")
        .select("whatsapp")
        .eq("user_id", account.profile.id)
        .maybeSingle();
      return { profile: account.profile, contacts };
    }),
    getPetCase(id),
  ]);

  const pet = petResult.data;
  if (!pet || pet.post_type !== "adoption" || pet.post_state !== "available") notFound();
  const imageUrl = storagePublicUrl("pet-photos", pet.cover_image_path || pet.photo_paths?.[0] || null);

  return (
    <main className="inner-shell adoption-application-shell">
      <SiteHeader inner />
      <section className="adoption-application-hero">
        <a href="/adopciones"><ArrowLeft size={16} />Volver a adopciones</a>
        <div className="adoption-application-pet">
          {imageUrl ? <img src={imageUrl} alt={pet.name || "Mascota en adopción"} /> : <span><HeartHandshake /></span>}
          <div><small>Solicitud de adopción responsable</small><h1>Quiero adoptar a {pet.name || "esta mascota"}</h1><p><MapPin size={14} />{pet.zone_name || pet.city_name} · Rescatista {pet.rescuer_name || "verificado"}</p></div>
        </div>
      </section>

      <section className="adoption-application-layout">
        <form action={submitAdoptionApplication} className="adoption-application-form">
          <input name="pet_post_id" type="hidden" value={pet.id} />
          <header><span className="section-kicker">Filtro esencial</span><h2>Contanos sobre tu hogar</h2><p>Estas respuestas son privadas y solo las verá el rescatista responsable.</p></header>
          {query.error && <div className="admin-feedback admin-feedback-error">{query.error}</div>}

          <div className="adoption-contact-grid">
            <label>Nombre y apellido<input name="full_name" required minLength={2} maxLength={80} defaultValue={profile.display_name} /></label>
            <label>Teléfono de contacto<input name="phone" required minLength={7} maxLength={30} defaultValue={contacts?.whatsapp || ""} inputMode="tel" /></label>
            <label className="form-wide">Dirección<input name="home_address" required minLength={5} maxLength={200} autoComplete="street-address" /></label>
            <label className="form-wide">Localidad o zona<input name="locality" required minLength={2} maxLength={80} placeholder="Ej.: Centro, Melipal, Frutillar" /></label>
          </div>

          <div className="adoption-question-list">
            {questions.map((question, index) => (
              <fieldset key={question.name}>
                <legend><span>{index + 1}</span>{question.title}</legend>
                <div>
                  {question.options.map(([value, label]) => (
                    <label key={value}><input name={question.name} required type="radio" value={value} /><span>{label}</span></label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="adoption-consent-note"><ShieldCheck /><span><strong>Compromiso responsable</strong><small>Enviar la solicitud no confirma la adopción. El rescatista revisará la compatibilidad y coordinará una entrevista.</small></span></div>
          <button className="button button-primary adoption-submit" type="submit"><HeartHandshake />Enviar solicitud al rescatista</button>
        </form>

        <aside className="adoption-application-aside"><Home /><h2>¿Por qué hacemos estas preguntas?</h2><p>Ayudan a evitar devoluciones y a encontrar un hogar seguro y sostenible para cada animal.</p><ul><li>El rescatista recibe tus respuestas ordenadas.</li><li>Tu dirección y teléfono nunca se publican.</li><li>Podrás ver el estado desde tu panel.</li></ul></aside>
      </section>
      <SiteFooter inner />
    </main>
  );
}
