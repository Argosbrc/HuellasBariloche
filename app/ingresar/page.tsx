import { AuthForm } from "@/components/auth-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const params = await searchParams;
  const returnTo = params.returnTo?.startsWith("/") && !params.returnTo.startsWith("//")
    ? params.returnTo
    : "/panel";
  return <main className="inner-shell"><SiteHeader inner /><section className="auth-page"><AuthForm configured={hasSupabaseEnv()} returnTo={returnTo} /><aside><span className="section-kicker">Un único acceso</span><h2>Ingresá con tu cuenta de Huellas.</h2><p>Usuarios, rescatistas y administración entran desde el mismo lugar. Al iniciar sesión, el panel habilita automáticamente las opciones correspondientes al rol aprobado.</p></aside></section><SiteFooter inner /></main>;
}
