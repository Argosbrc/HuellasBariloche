"use client";

import { Eye, EyeOff, LockKeyhole, Mail, PawPrint } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm({ configured, returnTo = "/cuenta" }: { configured: boolean; returnTo?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) {
      setMessage("Primero configurá las variables de Supabase en .env.local.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName.trim() } } });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("Revisá tu correo para confirmar la cuenta.");
      return;
    }
    const destination = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/cuenta";
    window.location.assign(destination);
  }

  return (
    <div className="auth-card">
      <span className="auth-icon"><PawPrint size={27} /></span>
      <span className="section-kicker">Tu cuenta Huellas</span>
      <h1>{mode === "signin" ? "Volvé a la red" : "Sumate a la red"}</h1>
      <p>{mode === "signin" ? "Ingresá para publicar, guardar casos y activar alertas." : "Creá una cuenta para colaborar con la comunidad."}</p>
      <div className="auth-tabs">
        <button className={mode === "signin" ? "active" : ""} onClick={() => setMode("signin")} type="button">Ingresar</button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")} type="button">Crear cuenta</button>
      </div>
      <form onSubmit={submit}>
        {mode === "signup" && <label>Nombre visible<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={2} maxLength={80} required placeholder="Cómo querés aparecer" /></label>}
        <label>Correo electrónico<span><Mail size={16} /><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required placeholder="vos@correo.com" /></span></label>
        <label>Contraseña<span className="password-field"><LockKeyhole size={16} /><input value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required placeholder="Mínimo 8 caracteres" /><button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
        {message && <div className="form-message" role="status">{message}</div>}
        <button className="button button-primary button-large" disabled={busy} type="submit">{busy ? "Procesando…" : mode === "signin" ? "Ingresar" : "Crear mi cuenta"}</button>
      </form>
      <small>La sesión usa Supabase Auth y las políticas RLS ya aprobadas.</small>
    </div>
  );
}
