import { BellRing } from "lucide-react";
import { CasesExplorer } from "@/components/cases-explorer";
import { DataNotice } from "@/components/data-notice";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPetCases, storagePublicUrl } from "@/lib/public-api";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const result = await getPetCases();
  const cases = result.data.map((item) => ({
    ...item,
    imageUrl: storagePublicUrl(
      "pet-photos",
      item.cover_image_path || item.photo_paths?.[0] || null,
    ),
  }));
  return (
    <main className="inner-shell">
      <SiteHeader inner />
      <section className="inner-hero cases-hero">
        <div><span className="section-kicker">Búsqueda solidaria</span><h1>Casos que necesitan<em>ojos atentos.</em></h1><p>Buscá mascotas perdidas, encontradas y en adopción usando información pública y ubicaciones aproximadas.</p></div>
        <div className="hero-help-card"><BellRing size={26} /><span><strong>¿Querés actuar rápido?</strong><small>Publicá un caso y la red podrá verlo enseguida.</small></span><a className="button button-primary" href="/publicar">Publicar</a></div>
      </section>
      <DataNotice configured={result.configured} empty={result.data.length === 0} />
      <CasesExplorer cases={cases} />
      <SiteFooter inner />
    </main>
  );
}
