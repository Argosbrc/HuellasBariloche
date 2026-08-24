"use client";

import {
  CircleUserRound,
  Coffee,
  Download,
  Menu,
  PawPrint,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { PwaInstallButton } from "@/components/pwa-install";

const navigation = [
  ["/casos", "Casos"],
  ["/adopciones", "Adopciones"],
  ["/encuentros", "Encuentros"],
  ["/rescatistas", "Red solidaria"],
  ["/comunidad", "Comunidad"],
  ["/datos-utiles", "Datos útiles"],
] as const;

export function SiteHeader({ inner = false }: { inner?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className={inner ? "inner-topbar" : "topbar"}>
      <Link className="brand" href="/" aria-label="Huellas Bariloche, inicio">
        <span className="brand-mark"><PawPrint size={23} strokeWidth={2.5} /></span>
        <span><strong>Huellas</strong><small>Bariloche</small></span>
      </Link>

      <nav className="desktop-nav" aria-label="Navegación principal">
        {navigation.map(([href, label]) => (
          <a className={pathname === href ? "nav-active" : undefined} href={href} key={href}>
            {label}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        <a className="button button-cafecito" href="https://cafecito.app/argosit" target="_blank" rel="noreferrer">
          <Coffee size={17} />Cafecito
        </a>
        <a className="button button-ghost" href="/panel">
          <CircleUserRound size={18} />Mi panel
        </a>
        <a className="button button-primary" href="/publicar">
          <PawPrint size={17} />Publicar caso
        </a>
      </div>

      <button
        className="menu-button"
        type="button"
        aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((value) => !value)}
      >
        {menuOpen ? <X /> : <Menu />}
      </button>

      {menuOpen && (
        <nav className="mobile-nav" aria-label="Navegación móvil">
          {navigation.map(([href, label]) => (
            <a href={href} key={href} onClick={() => setMenuOpen(false)}>{label}</a>
          ))}
          <a className="button button-cafecito cafecito-mobile" href="https://cafecito.app/argosit" target="_blank" rel="noreferrer">
            <Coffee size={17} />Invitame un Cafecito
          </a>
          <a href="/panel" onClick={() => setMenuOpen(false)}>Mi panel</a>
          <PwaInstallButton className="mobile-install-button" icon={<Download size={17} />} label="Instalar Huellas" onInstalled={() => setMenuOpen(false)} />
          <a className="button button-primary" href="/publicar" onClick={() => setMenuOpen(false)}>Publicar caso</a>
        </nav>
      )}
    </header>
  );
}
