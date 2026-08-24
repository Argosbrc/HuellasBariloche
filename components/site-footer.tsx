import { Coffee, Instagram, PawPrint } from "lucide-react";
import Link from "next/link";

export function SiteFooter({ inner = false }: { inner?: boolean }) {
  return (
    <footer className={inner ? "footer inner-footer" : "footer"}>
      <div className="footer-brand">
        <span className="brand-mark"><PawPrint size={23} /></span>
        <span><strong>Huellas</strong><small>Bariloche</small></span>
      </div>
      <p>Una comunidad para encontrarnos, cuidarnos y volver a casa.</p>
      <div className="footer-right">
        <div className="footer-links">
          <Link href="/casos">Casos</Link><Link href="/encuentros">Encuentros</Link><Link href="/medallas">Medallas</Link><Link href="/rescatistas">Red solidaria</Link><Link href="/datos-utiles">Datos útiles</Link>
        </div>
        <div className="footer-partners">
          <a href="https://www.instagram.com/argos.brc/" target="_blank" rel="noreferrer">
            <Instagram size={15} />Desarrollado por Argos IT
          </a>
          <a className="footer-cafecito" href="https://cafecito.app/argosit" target="_blank" rel="noreferrer">
            <Coffee size={15} />Invitame un Cafecito
          </a>
        </div>
      </div>
      <small>© 2026 Huellas Bariloche · Hecho con amor por los animales.</small>
    </footer>
  );
}
