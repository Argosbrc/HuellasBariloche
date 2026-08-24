import { MessageCircle } from "lucide-react";
import { CommunityPostForm } from "@/components/community-post-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { requireAccount } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function PublishCommunityPage() {
  const { profile } = await requireAccount();
  return <main className="inner-shell publish-page">
    <SiteHeader inner />
    <section className="publish-intro community-publish-intro">
      <div><span className="section-kicker">Nueva publicación comunitaria</span><h1>Una ayuda concreta puede<em>mover a todo el barrio.</em></h1><p>Pedí una mano, convocá una actividad, ofrecé recursos o compartí información útil para los animales de Bariloche.</p></div>
      <div className="privacy-note"><MessageCircle size={18} /><span><strong>Un espacio solidario</strong><small>No reemplaza los casos de animales perdidos, encontrados o en adopción.</small></span></div>
    </section>
    <CommunityPostForm displayName={profile.display_name} />
    <SiteFooter inner />
  </main>;
}
