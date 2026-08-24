"use client";

import { CheckCircle2, Download, Share, Smartphone, X } from "lucide-react";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallContextValue = {
  installed: boolean;
  available: boolean;
  install: () => Promise<boolean>;
  openHelp: () => void;
};

const InstallContext = createContext<InstallContextValue | null>(null);

function isStandalone() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function detectIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const platformTimer = window.setTimeout(() => {
      setInstalled(isStandalone());
      setIsIos(detectIos());
    }, 0);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setBannerOpen(false);
      setHelpOpen(false);
      localStorage.setItem("huellas-app-installed", "1");
    };
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const handleDisplayMode = () => setInstalled(isStandalone());

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    displayMode.addEventListener?.("change", handleDisplayMode);

    const dismissed = localStorage.getItem("huellas-install-dismissed") === "1";
    const timer = window.setTimeout(() => {
      if (!dismissed && !isStandalone() && window.matchMedia("(max-width: 760px)").matches) {
        setBannerOpen(true);
      }
    }, 1800);

    return () => {
      window.clearTimeout(platformTimer);
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      displayMode.removeEventListener?.("change", handleDisplayMode);
    };
  }, []);

  const install = useCallback(async () => {
    if (installed) return true;
    if (!promptEvent) {
      setHelpOpen(true);
      return false;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      setBannerOpen(false);
      return true;
    }
    return false;
  }, [installed, promptEvent]);

  const openHelp = useCallback(() => setHelpOpen(true), []);

  function dismissBanner() {
    setBannerOpen(false);
    localStorage.setItem("huellas-install-dismissed", "1");
  }

  const value = useMemo<InstallContextValue>(() => ({
    installed,
    available: !installed,
    install,
    openHelp,
  }), [installed, install, openHelp]);

  return (
    <InstallContext.Provider value={value}>
      {children}
      {bannerOpen && !installed && <aside className="pwa-install-banner" aria-label="Instalar Huellas Bariloche">
        <span className="pwa-install-banner-icon"><Smartphone /></span>
        <div><strong>Llevá Huellas en tu celular</strong><span>Instalala para entrar rápido y recibir alertas importantes.</span></div>
        <button className="button button-primary" type="button" onClick={install}><Download />Instalar</button>
        <button className="pwa-install-dismiss" type="button" aria-label="Cerrar aviso de instalación" onClick={dismissBanner}><X /></button>
      </aside>}

      {helpOpen && <div className="pwa-help-modal" role="dialog" aria-modal="true" aria-labelledby="pwa-help-title">
        <button className="pwa-help-backdrop" type="button" aria-label="Cerrar instrucciones" onClick={() => setHelpOpen(false)} />
        <section className="pwa-help-sheet">
          <header><span><Smartphone /></span><div><small>Acceso directo y alertas</small><h2 id="pwa-help-title">Instalar Huellas</h2></div><button type="button" aria-label="Cerrar" onClick={() => setHelpOpen(false)}><X /></button></header>
          {isIos ? <ol>
            <li><span>1</span><div><strong>Abrí este sitio en Safari</strong><small>La instalación en iPhone o iPad se realiza desde Safari.</small></div></li>
            <li><span>2</span><div><strong>Tocá Compartir <Share /></strong><small>Es el cuadrado con una flecha hacia arriba.</small></div></li>
            <li><span>3</span><div><strong>Elegí “Agregar a pantalla de inicio”</strong><small>Luego abrí Huellas desde el nuevo ícono para activar notificaciones.</small></div></li>
          </ol> : <ol>
            <li><span>1</span><div><strong>Abrí el menú del navegador</strong><small>En Chrome suele estar en los tres puntos.</small></div></li>
            <li><span>2</span><div><strong>Elegí “Instalar app”</strong><small>También puede aparecer como “Agregar a pantalla principal”.</small></div></li>
            <li><span>3</span><div><strong>Abrí Huellas desde su ícono</strong><small>Ingresá a tu panel y activá las alertas en ese dispositivo.</small></div></li>
          </ol>}
          <button className="button button-primary" type="button" onClick={() => setHelpOpen(false)}>Entendido</button>
        </section>
      </div>}
    </InstallContext.Provider>
  );
}

function usePwaInstall() {
  const context = useContext(InstallContext);
  if (!context) throw new Error("PwaInstallButton debe usarse dentro de PwaInstallProvider.");
  return context;
}

export function PwaInstallButton({
  className = "",
  icon = <Download size={17} />,
  label = "Instalar app",
  onInstalled,
}: {
  className?: string;
  icon?: ReactNode;
  label?: string;
  onInstalled?: () => void;
}) {
  const { installed, available, install } = usePwaInstall();
  if (installed || !available) return null;
  return <button className={className} type="button" onClick={async () => {
    await install();
    onInstalled?.();
  }}>{icon}{label}</button>;
}

export function PwaInstallCard({ icon = <Download /> }: { icon?: ReactNode }) {
  const { installed, install, openHelp } = usePwaInstall();
  return <section className={`pwa-account-card ${installed ? "installed" : ""}`}>
    <span className="pwa-account-icon">{installed ? <CheckCircle2 /> : icon}</span>
    <div><small>Huellas en tu celular</small><h2>{installed ? "La app ya está instalada" : "Instalá la app y enterate a tiempo"}</h2><p>{installed ? "Podés abrirla desde el ícono de tu pantalla principal y mantener activas las alertas de este dispositivo." : "Accedé con un toque y recibí avistamientos de tus mascotas o solicitudes de adopción, siempre que actives las notificaciones."}</p></div>
    {!installed && <div className="pwa-account-actions"><button className="button button-primary" type="button" onClick={install}><Download />Instalar Huellas</button><button className="button button-light" type="button" onClick={openHelp}>Ver instrucciones</button></div>}
  </section>;
}
