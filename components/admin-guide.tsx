import { Clock3, ImagePlus, MapPin, Plus, Settings2, Store, Trash2 } from "lucide-react";
import type {
  AdminService,
  AdminServiceCategory,
  AdminServiceMedia,
  AdminUsefulDetails,
} from "@/lib/admin";
import { ImageKitUploader } from "@/components/imagekit-uploader";
import { AdminSubmitButton } from "@/components/admin-submit-button";
import {
  configureImageKit,
  removeGuideServiceImage,
  setGuideServiceStatus,
  upsertGuideService,
  upsertUsefulCategory,
} from "@/app/admin/actions";

type GuideData = {
  categories: AdminServiceCategory[];
  services: AdminService[];
  serviceMedia: AdminServiceMedia[];
  serviceDetails: AdminUsefulDetails[];
  cities: Array<{ id: string; name: string; province: string }>;
  mediaProvider: { provider?: string; configured?: boolean; url_endpoint?: string | null };
};

function hoursValue(hours: unknown) {
  if (hours && typeof hours === "object" && "display" in hours) {
    return String((hours as { display?: unknown }).display ?? "");
  }
  return "";
}

function join(items: string[] | undefined) {
  return items?.join(", ") ?? "";
}

function ServiceFields({
  service,
  details,
  data,
}: {
  service?: AdminService;
  details?: AdminUsefulDetails;
  data: GuideData;
}) {
  return (
    <div className="guide-admin-form-grid">
      <input name="service_id" type="hidden" value={service?.id || ""} />
      <div className="guide-form-group form-wide">
        <strong>Información principal</strong>
        <span>Nombre, categoría y descripción pública.</span>
      </div>
      <label>Nombre<input name="name" required minLength={2} maxLength={140} defaultValue={service?.name || ""} /></label>
      <label>Categoría<select name="category_id" required defaultValue={service?.category_id || data.categories[0]?.id}>{data.categories.filter((item) => item.active || item.id === service?.category_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Ciudad<select name="city_id" required defaultValue={service?.city_id || data.cities[0]?.id}>{data.cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
      <label>Identificador web<input name="slug" defaultValue={service?.slug || ""} placeholder="Se genera desde el nombre" /></label>
      <label className="form-wide">Resumen<input name="summary" maxLength={280} defaultValue={service?.summary || ""} placeholder="Qué ofrece y por qué puede ser útil" /></label>
      <label className="form-wide">Descripción<textarea name="description" rows={3} maxLength={5000} defaultValue={service?.description || ""} /></label>

      <div className="guide-form-group form-wide">
        <strong>Ubicación, contacto y redes</strong>
        <span>Los campos vacíos no se mostrarán públicamente.</span>
      </div>
      <label className="form-wide">Dirección<input name="address" required minLength={3} maxLength={300} defaultValue={service?.address || ""} /></label>
      <label>Barrio o zona<input name="neighborhood" maxLength={120} defaultValue={service?.neighborhood || ""} /></label>
      <label>Teléfono<input name="phone" maxLength={50} defaultValue={service?.phone || ""} /></label>
      <label>WhatsApp<input name="whatsapp" maxLength={50} defaultValue={service?.whatsapp || ""} /></label>
      <label>Teléfono de guardia<input name="emergency_phone" maxLength={50} defaultValue={service?.emergency_phone || ""} /></label>
      <label>Instagram<input name="instagram" maxLength={160} defaultValue={service?.instagram || ""} placeholder="Usuario o enlace" /></label>
      <label>Facebook<input name="facebook" maxLength={300} defaultValue={details?.facebook || ""} placeholder="Usuario o enlace" /></label>
      <label>TikTok<input name="tiktok" maxLength={300} defaultValue={details?.tiktok || ""} placeholder="Usuario o enlace" /></label>
      <label className="form-wide">Sitio web<input name="website" type="url" maxLength={500} defaultValue={service?.website || ""} /></label>

      <div className="guide-form-group form-wide">
        <strong>Horarios y modalidades</strong>
        <span>Útil para veterinarias, pet shops, alimento y otros servicios.</span>
      </div>
      <label className="form-wide">Horarios<input name="opening_hours" maxLength={300} defaultValue={hoursValue(service?.opening_hours)} placeholder="Lun a sáb 9 a 20 h · domingos cerrado" /></label>
      <label className="guide-check"><input name="is_emergency" type="checkbox" defaultChecked={service?.is_emergency} />Atiende urgencias</label>
      <label className="guide-check"><input name="is_24_hours" type="checkbox" defaultChecked={service?.is_24_hours} />Abierto 24 horas</label>
      <label className="guide-check"><input name="home_visit" type="checkbox" defaultChecked={details?.home_visit} />Atención a domicilio</label>
      <label className="guide-check"><input name="has_on_call" type="checkbox" defaultChecked={details?.has_on_call} />Tiene guardia</label>
      <label className="guide-check"><input name="delivery_available" type="checkbox" defaultChecked={details?.delivery_available} />Realiza envíos</label>
      <label className="form-wide">Especializaciones<input name="specializations" maxLength={800} defaultValue={join(details?.specializations)} placeholder="Traumatología, dermatología, animales exóticos…" /></label>
      <label className="form-wide">Productos o rubros<input name="product_types" maxLength={800} defaultValue={join(details?.product_types)} placeholder="Alimento balanceado, medicamentos, cuchas, accesorios…" /></label>
      <label className="form-wide">Medios de pago<input name="payment_methods" maxLength={500} defaultValue={join(details?.payment_methods)} placeholder="Efectivo, transferencia, débito…" /></label>
      <label className="form-wide">Información adicional<textarea name="useful_notes" rows={3} maxLength={1600} defaultValue={details?.notes || ""} placeholder="Datos que ayuden a elegir o contactar este lugar" /></label>
      <label>Latitud pública<input name="public_latitude" inputMode="decimal" /></label>
      <label>Longitud pública<input name="public_longitude" inputMode="decimal" /></label>
    </div>
  );
}

export function AdminGuide({ data }: { data: GuideData }) {
  return (
    <>
      <div className="admin-section-heading">
        <div><span>Información local administrable</span><h2>Datos útiles</h2></div>
        <small>{data.services.length} lugares cargados</small>
      </div>

      <article className="admin-panel imagekit-config">
        <header><div><span>Imágenes públicas</span><h3>ImageKit Free</h3></div><Settings2 /></header>
        {data.mediaProvider.configured ? <div className="provider-ready"><strong>Configurado</strong><span>{data.mediaProvider.url_endpoint}</span><small>La clave privada se lee únicamente en el servidor.</small></div> : <form action={configureImageKit} className="provider-form"><label>URL endpoint público<input name="url_endpoint" required type="url" placeholder="https://ik.imagekit.io/tu_id" /></label><AdminSubmitButton>Activar ImageKit</AdminSubmitButton><small>Debe coincidir exactamente con NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT.</small></form>}
      </article>

      <details className="admin-panel guide-category-create">
        <summary><span><Plus />Agregar categoría</span><small>Para sumar un rubro que todavía no exista.</small></summary>
        <form action={upsertUsefulCategory} className="guide-category-form">
          <label>Nombre<input name="category_name" required minLength={2} maxLength={80} placeholder="Ej. Transporte de mascotas" /></label>
          <label>Identificador<input name="category_slug" maxLength={80} placeholder="Se genera automáticamente" /></label>
          <label>Orden<input name="category_sort_order" type="number" min={0} max={999} defaultValue={100} /></label>
          <label className="form-wide">Descripción<input name="category_description" maxLength={300} /></label>
          <AdminSubmitButton>Agregar categoría</AdminSubmitButton>
        </form>
      </details>

      <details className="admin-panel guide-create" open={data.services.length === 0}>
        <summary><span><Store />Agregar dato útil</span><small>Veterinaria, pet shop, alimento, farmacia y más.</small></summary>
        <form action={upsertGuideService}><ServiceFields data={data} /><AdminSubmitButton>Guardar como borrador</AdminSubmitButton></form>
      </details>

      {data.services.length === 0 ? <div className="admin-empty"><Store /><p>Datos útiles está listo para cargar su primer lugar.</p></div> : <div className="guide-admin-list">{data.services.map((service) => {
        const images = data.serviceMedia.filter((item) => item.service_id === service.id);
        const details = data.serviceDetails.find((item) => item.service_id === service.id);
        return <article className="guide-admin-record" key={service.id}><header><div><span className="admin-avatar admin-avatar-badge"><Store /></span><div><strong>{service.name}</strong><small><MapPin size={12} />{service.address} · <Clock3 size={12} />{service.status}</small></div></div><span className={`admin-status status-${service.status}`}>{service.status}</span></header>{images.length > 0 && <div className="guide-admin-images">{images.map((image) => <div key={image.id}><img src={image.object_path} alt={image.alt_text} /><form action={removeGuideServiceImage}><input name="media_id" type="hidden" value={image.id} /><button type="submit" aria-label="Retirar imagen"><Trash2 size={15} /></button></form></div>)}</div>}<div className="guide-admin-actions"><ImageKitUploader purpose="service" entityId={service.id} altText={`Imagen de ${service.name}`} label={images.length ? "Agregar otra imagen" : "Agregar imagen"} icon={<ImagePlus size={17} />} /><form action={setGuideServiceStatus}><input name="service_id" type="hidden" value={service.id} /><select name="status" defaultValue={service.status}><option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option></select><AdminSubmitButton>Guardar estado</AdminSubmitButton></form></div><details className="admin-details"><summary>Editar datos</summary><form action={upsertGuideService}><ServiceFields service={service} details={details} data={data} /><AdminSubmitButton>Guardar cambios</AdminSubmitButton></form></details></article>;
      })}</div>}
    </>
  );
}
