"use client";

import {
  Bell,
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

export function SiteHeader({
  inner = false,
  unreadNotifications = 0,
}: { inner?: boolean;
  unreadNotifications?: number;
 }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className={inner ? "inner-topbar" : "topbar"}>

      <Link className="brand" href="/" aria-label="Huellas Bariloche, inicio">
        <span className="brand-mark">
          <PawPrint size={23} strokeWidth={2.5} />
        </span>

        <span>
          <strong>Huellas</strong>
          <small>Bariloche</small>
        </span>
      </Link>


      <nav className="desktop-nav" aria-label="Navegación principal">
        {navigation.map(([href, label]) => (
          <a
            className={pathname === href ? "nav-active" : undefined}
            href={href}
            key={href}
          >
            {label}
          </a>
        ))}
      </nav>


      <div className="header-actions">

        <a
          className="header-notification-button"
          href="/panel#notificaciones"
          aria-label="Notificaciones"
        >
          <Bell size={21} />

         {unreadNotifications > 0 && (
  <span className="notification-badge">
    {unreadNotifications > 9 ? "9+" : unreadNotifications}
  </span>
)}
        </a>


        <a className="button button-ghost" href="/panel">
          <CircleUserRound size={18} />
          Mi cuenta
        </a>


        <a
          className="button button-cafecito"
          href="https://cafecito.app/argosit"
          target="_blank"
          rel="noreferrer"
        >
          <Coffee size={17} />
          Cafecito
        </a>

      </div>


      <div className="header-mobile-actions">

        <a
          className="header-notification-button"
          href="/panel#notificaciones"
          aria-label="Notificaciones"
        >
          <Bell size={21} />

          <span className="notification-badge">
            3
          </span>
        </a>


        <button
          className="menu-button"
          type="button"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>

      </div>
<div className="header-mobile-actions">

  <a
    className="header-notification-button"
    href="/panel#notificaciones"
    aria-label="Notificaciones"
  >
    <Bell size={21} />

    {unreadNotifications > 0 && (
      <span className="notification-badge">
        {unreadNotifications > 9 ? "9+" : unreadNotifications}
      </span>
    )}
  </a>

  <button
    className="menu-button"
    type="button"
    aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
    aria-expanded={menuOpen}
    onClick={() => setMenuOpen((value) => !value)}
  >
    {menuOpen ? <X /> : <Menu />}
  </button>

</div>

      {menuOpen && (
        <nav className="mobile-nav" aria-label="Navegación móvil">

          <a
            href="/panel#notificaciones"
            onClick={() => setMenuOpen(false)}
          >
            🔔 Notificaciones
          </a>


          <a
            href="/panel"
            onClick={() => setMenuOpen(false)}
          >
            👤 Mi cuenta
          </a>




          {navigation.map(([href, label]) => (
            <a
              href={href}
              key={href}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </a>
          ))}


          <a
            className="button button-cafecito cafecito-mobile"
            href="https://cafecito.app/argosit"
            target="_blank"
            rel="noreferrer"
          >
            <Coffee size={17} />
            Invitame un Cafecito
          </a>


          <PwaInstallButton
            className="mobile-install-button"
            icon={<Download size={17} />}
            label="Instalar Huellas"
            onInstalled={() => setMenuOpen(false)}
          />

        </nav>
      )}

    </header>
  );
}