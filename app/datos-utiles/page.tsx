import { BookOpenCheck, Stethoscope } from "lucide-react";
import { DataNotice } from "@/components/data-notice";
import { GuideExplorer } from "@/components/guide-explorer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getServices } from "@/lib/public-api";

export const dynamic = "force-dynamic";

export default async function UsefulDataPage() {
  const result = await getServices();
  return (
    <main className="inner-shell">
      <SiteHeader inner />
      <section className="inner-hero services-hero guide-hero">
        <div><span className="section-kicker">Datos útiles</span><h1>Información clara<em>cuando la necesitás.</em></h1><p>Veterinarias, guardias, pet shops, alimento, farmacias y otros servicios de Bariloche, con horarios y formas de contacto.</p></div>
        <div className="emergency-banner"><Stethoscope size={25} /><div><span>¿Es una urgencia?</span><strong>Filtrá guardias, atención 24 h y visitas a domicilio.</strong></div><a className="button button-white" href="#directorio">Buscar ahora</a></div>
      </section>
      <DataNotice configured={result.configured} empty={result.data.length === 0} />
      <section className="inner-content guide-content" id="directorio">
        {result.data.length ? <GuideExplorer services={result.data} /> : <div className="empty-state"><BookOpenCheck size={36} /><strong>Datos útiles está listo</strong><span>El administrador puede cargar veterinarias, pet shops, alimento y otros lugares desde su panel.</span></div>}
      </section>
      <SiteFooter inner />
    </main>
  );
}
