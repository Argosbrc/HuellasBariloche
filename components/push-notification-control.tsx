"use client";

import { BellOff, BellRing, LoaderCircle, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function urlBase64ToUint8Array(value: string) {
  const clean = value.trim();

  if (!clean || clean.length < 80) {
    throw new Error("La clave VAPID pública no es válida.");
  }

  const padding = "=".repeat((4 - (clean.length % 4)) % 4);
  const base64 = (clean + padding).replace(/-/g, "+").replace(/_/g, "/");

  try {
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
  } catch {
    throw new Error("La clave VAPID pública tiene un formato incorrecto.");
  }
}

export function PushNotificationControl() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? "";
  const [state, setState] = useState<"loading" | "unsupported" | "disabled" | "enabled" | "denied" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function inspect() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidPublicKey) {
        if (active) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (active) setState("denied");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription();
      if (active) setState(subscription ? "enabled" : "disabled");
    }
    inspect().catch(() => active && setState("error"));
    return () => { active = false; };
  }, [vapidPublicKey]);

  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "disabled");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const serialized = subscription.toJSON();
      const { error } = await createClient().rpc("upsert_my_web_push_subscription_v1", {
        p_endpoint: serialized.endpoint,
        p_p256dh: serialized.keys?.p256dh,
        p_auth: serialized.keys?.auth,
        p_user_agent: navigator.userAgent,
      });
      if (error) throw error;
      setState("enabled");
      setMessage("Las alertas importantes llegarán a este dispositivo.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudieron activar las alertas.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const { error } = await createClient().rpc("deactivate_my_web_push_subscription_v1", { p_endpoint: subscription.endpoint });
        if (error) throw error;
        await subscription.unsubscribe();
      }
      setState("disabled");
      setMessage("Las alertas de este dispositivo quedaron desactivadas.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "No se pudieron desactivar las alertas.");
    } finally {
      setBusy(false);
    }
  }

  return <div className={`push-control ${state}`}>
    <span className="push-control-icon">{busy || state === "loading" ? <LoaderCircle className="spin" /> : state === "enabled" ? <BellRing /> : <Smartphone />}</span>
    <div><strong>Alertas en este teléfono</strong><span>{state === "enabled" ? "Activadas para avistamientos, resguardos y solicitudes de adopción." : state === "denied" ? "El navegador bloqueó las notificaciones. Habilitalas desde los permisos del sitio." : state === "unsupported" ? "No están disponibles en este navegador o falta completar la configuración." : "Recibí avisos importantes aunque no tengas abierta la página."}</span>{message && <small>{message}</small>}<small>En iPhone, instalá primero Huellas desde Safari y abrila desde su ícono.</small></div>
    {state === "enabled" ? <button type="button" onClick={disable} disabled={busy}><BellOff />Desactivar</button> : state !== "unsupported" && state !== "denied" && <button type="button" onClick={enable} disabled={busy || state === "loading"}><BellRing />Activar</button>}
  </div>;
}
