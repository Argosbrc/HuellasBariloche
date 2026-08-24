import { Award, BadgeCheck, CircleUserRound, Gift, ImagePlus, Medal, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ImageKitUploader } from "@/components/imagekit-uploader";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { loadAccountDashboard } from "@/lib/account";
import { updateProfile, updateRescuerProfile } from "../actions";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const params = await searchParams;
  const data = await loadAccountDashboard();
  const directory = data.rescuerDirectory;

  return (
    <main className="inner-shell profile-shell">
      <SiteHeader inner />
      <section className="profile-hero">
        <div><span className="section-kicker">Cuenta personal</span><h1>Tu perfil, <em>siempre actualizado.</em></h1><p>Estos datos identifican tus publicaciones y permiten que la comunidad se comunique con vos.</p></div>
        <Link className="button button-light" href="/panel">Volver al panel</Link>
      </section>

      {(params.ok || params.error) && <div className={params.error ? "admin-feedback admin-feedback-error profile-feedback" : "admin-feedback profile-feedback"}>{params.error ?? params.ok}</div>}

      <section className="profile-layout">
        <aside className="profile-photo-card">
          {data.profile.avatar_url ? <img src={data.profile.avatar_url} alt="Foto de perfil actual" /> : <span><CircleUserRound size={54} /></span>}
          <h2>{data.profile.display_name}</h2>
          <p>{data.profile.role}</p>
          <div className="profile-medal-summary"><Medal /><span><strong>{data.badges.length}</strong><small>{data.badges.length === 1 ? "medalla" : "medallas"}</small></span></div>
          {data.badges.length > 0 && <div className="profile-mini-medals" aria-label="Medallas obtenidas">{data.badges.slice(0, 4).map((item) => <span title={item.badge?.name || "Medalla"} key={item.badge_id}><Award /></span>)}</div>}
          <Link className="profile-public-link" href={`/perfiles/${data.profile.id}`}>Ver perfil público</Link>
          <ImageKitUploader purpose="avatar" label="Cambiar foto" icon={<ImagePlus size={17} />} />
          <small>La foto se optimiza a WebP y se guarda en ImageKit.</small>
        </aside>

        <div className="profile-forms">
          <form action={updateProfile} className="profile-form">
            <header><span><CircleUserRound /></span><div><small>Datos generales</small><h2>Perfil público</h2></div></header>
            <div className="form-grid">
              <label>Nombre visible<input name="display_name" required minLength={2} maxLength={60} defaultValue={data.profile.display_name} /></label>
              <label>Ciudad<select name="city_id" defaultValue={data.profile.city_id}>{data.cities.map((city) => <option value={city.id} key={city.id}>{city.name}</option>)}</select></label>
              <label>WhatsApp<input name="whatsapp" minLength={7} maxLength={30} defaultValue={data.contacts.whatsapp || ""} placeholder="Ej. 2944 000000" /></label>
              <label>Correo público<input name="public_email" type="email" maxLength={254} defaultValue={data.contacts.public_email || ""} /></label>
              <label className="form-wide">Biografía<textarea name="bio" maxLength={500} rows={5} defaultValue={data.profile.bio || ""} placeholder="Contá brevemente quién sos y cómo ayudás" /></label>
            </div>
            <button className="button button-primary" type="submit">Guardar perfil</button>
          </form>

          {data.rescuer && <form action={updateRescuerProfile} className="profile-form rescuer-form">
            <header><span><BadgeCheck /></span><div><small>Rol aprobado</small><h2>Ficha de rescatista</h2></div></header>
            <div className="form-grid">
              <label>Rescatista u organización<input name="organization_name" required minLength={2} maxLength={100} defaultValue={data.rescuer.organization_name} /></label>
              <label>Área de trabajo<input name="contact_area" maxLength={120} defaultValue={data.rescuer.contact_area || ""} placeholder="Bariloche y Dina Huapi" /></label>
              <label className="form-wide">Presentación<textarea name="description" maxLength={1200} rows={5} defaultValue={data.rescuer.description || ""} placeholder="Contá qué hacen y qué animales asisten" /></label>
              <label className="form-wide">Red social principal<input name="social_url" maxLength={300} defaultValue={data.rescuer.social_url || ""} /></label>

              <div className="rescuer-form-divider form-wide"><Gift /><div><strong>Donaciones y necesidades</strong><span>Solo se publica lo que completes en esta sección.</span></div></div>
              <label>Alias para donaciones<input name="donation_alias" maxLength={60} defaultValue={directory?.donation_alias || ""} placeholder="alias.ejemplo" /></label>
              <label>Teléfono público<input name="rescuer_public_phone" maxLength={50} defaultValue={directory?.public_phone || ""} /></label>
              <label>Correo público<input name="rescuer_public_email" type="email" maxLength={254} defaultValue={directory?.public_email || ""} /></label>
              <label>Sitio web<input name="rescuer_website" type="url" maxLength={500} defaultValue={directory?.website || ""} /></label>
              <label>Instagram<input name="rescuer_instagram" maxLength={300} defaultValue={directory?.instagram || ""} placeholder="Usuario o enlace" /></label>
              <label>Facebook<input name="rescuer_facebook" maxLength={300} defaultValue={directory?.facebook || ""} placeholder="Usuario o enlace" /></label>
              <label className="form-wide">Necesidades actuales<input name="current_needs" maxLength={900} defaultValue={directory?.current_needs?.join(", ") || ""} placeholder="Alimento, cuchas, vacunas, tránsito, mantas…" /></label>
              <label className="form-wide">Mensaje de donaciones<textarea name="donation_note" maxLength={1200} rows={4} defaultValue={directory?.donation_note || ""} placeholder="Explicá para qué se usarán las donaciones o cómo coordinar la entrega" /></label>
            </div>
            <div className="profile-form-actions"><button className="button button-primary" type="submit">Guardar ficha</button><Link className="button button-light" href="/rescatistas">Ver portal público</Link></div>
          </form>}

          <div className="profile-security-note"><ShieldCheck /><div><strong>Datos protegidos</strong><span>El rol y el estado de verificación solo pueden ser aprobados o modificados por administración.</span></div></div>
        </div>
      </section>
      <SiteFooter inner />
    </main>
  );
}
