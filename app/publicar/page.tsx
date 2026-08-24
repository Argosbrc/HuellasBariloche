import { LockKeyhole } from "lucide-react";
import { PublishPetForm } from "@/components/publish-pet-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { requireAccount } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function PublishPage() {
  const { supabase, profile } = await requireAccount();
  const [rescuerResult, contactResult] = await Promise.all([
    supabase.from("rescuer_profiles").select("verification_status").eq("user_id", profile.id).maybeSingle(),
    supabase.from("profile_contacts").select("whatsapp").eq("user_id", profile.id).maybeSingle(),
  ]);
  const canPublishAdoption = rescuerResult.data?.verification_status === "verified";
  const hasWhatsapp = Boolean(contactResult.data?.whatsapp?.trim());

  return <main className="inner-shell publish-page"><SiteHeader inner /><section className="publish-intro"><div><span className="section-kicker">Nueva publicación</span><h1>Una ficha clara puede<em>acercarlo a casa.</em></h1><p>Publicá un animal perdido, encontrado o en adopción. Los rescatistas también pueden buscar un hogar de tránsito para animales que ya están a resguardo.</p></div><div className="privacy-note"><LockKeyhole size={18} /><span><strong>Tu ubicación exacta no es pública</strong><small>Solo se muestra el barrio y un punto aproximado. En adopciones de rescatistas, lugar y momento son opcionales.</small></span></div></section><PublishPetForm canPublishAdoption={canPublishAdoption} hasWhatsapp={hasWhatsapp} /><SiteFooter inner /></main>;
}
