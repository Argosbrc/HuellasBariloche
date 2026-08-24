# Contratos de Supabase usados por la web

La aplicación no consulta tablas privadas ni necesita `service_role`.

## Lecturas públicas de la migración 012

- `get_public_home_summary('bariloche')`
- `api_pet_cases`
- `api_adoptions`
- `api_community_feed`
- `api_campaigns`
- `api_service_directory`

El mapa usa únicamente `public_latitude` y `public_longitude` aproximadas de `api_pet_cases`.

## Multimedia de la migración 013

La web aplica antes de transmitir:

- Hasta 4 imágenes.
- Hasta 1600 px por lado.
- Salida WebP.
- Menos de 1 MB por imagen.
- Eliminación de metadatos EXIF durante la compresión.

La validación del navegador mejora consumo y experiencia, pero no reemplaza las restricciones del servidor.

## ImageKit y perfiles de la migración 014

- `get_media_provider_configuration()` informa si ImageKit está configurado.
- `authorize_imagekit_upload(p_purpose)` valida sesión, rol y límites antes de subir.
- `register_imagekit_upload(...)` registra propiedad y metadatos después de una carga validada.
- `set_my_avatar(p_media_id)` adjunta una imagen propia al perfil.
- `discard_imagekit_upload(p_media_id)` marca una carga fallida o huérfana como eliminada.
- `update_my_profile(...)` actualiza datos públicos y contacto sin permitir cambios de rol.
- `admin_configure_imagekit(p_url_endpoint)` configura el endpoint público; nunca guarda la clave privada.

Las columnas históricas `photo_paths`, `storage_path`, `object_path` y `cover_image_path` conservan su nombre para no romper las vistas de `012`, pero después de `014` referencian URL públicas registradas de ImageKit.

## Storage privado y buckets heredados

- `pet-photos`, `community-media` y `service-media`: quedan como buckets heredados; la aplicación nueva no carga imágenes públicas allí.
- `claim-evidence`: pruebas privadas; conserva PDF y hasta 5 MB.

No vuelvas a ejecutar las migraciones `001` a `013`. Aplicá `014` una sola vez.

## Publicación de casos de la migración 015

- `create_pet_post_v1(...)` crea publicaciones idempotentes para evitar dobles envíos.
- Requiere de una a cuatro URL de ImageKit registradas por la misma cuenta con propósito `pet_post`.
- `lost` y `found` están disponibles para cuentas activas.
- `adoption` requiere un perfil rescatista con `verification_status = verified`.
- La coordenada exacta se escribe únicamente en `pet_locations_private`.
- `pet_posts` recibe solamente coordenadas redondeadas a tres decimales y `location_precision = approximate`.
- El WhatsApp solo puede mostrarse cuando ya existe en `profile_contacts`.
- Las operaciones quedan registradas en `audit_log`.

Aplicá `015_pet_post_publishing.sql` una sola vez y confirmá `PASS` con
`015_verify.sql`. No repitas las migraciones anteriores.

## Datos útiles y rescatistas de la migración 016

- `api_useful_data_directory_v1` amplía el directorio con domicilio, guardia,
  especializaciones, productos, envíos, medios de pago y redes.
- `admin_upsert_service_details_v1(...)` guarda los campos adicionales de un
  lugar y exige rol administrador.
- `admin_upsert_service_category_v1(...)` permite crear categorías desde el
  panel administrador.
- `api_rescuer_directory_v1` publica únicamente perfiles con
  `verification_status = verified`.
- `update_my_rescuer_directory_profile_v1(...)` permite que cada rescatista
  aprobado gestione alias, necesidades y contacto público.
- Las tablas auxiliares no admiten lectura anónima directa; el público accede
  solamente a las vistas filtradas.

Aplicá `016_useful_data_rescuers.sql` una sola vez y confirmá `PASS` con
`016_verify.sql`. No repitas las migraciones anteriores.

## Publicaciones rescatistas y hogares de tránsito de la migración 018

- `create_pet_post_v2(...)` reemplaza el alta web de `015` y mantiene su
  idempotencia, propiedad de imágenes y ubicación exacta privada.
- `distinctive_features` es opcional para todos los casos.
- `zone_name` y `event_at` pueden quedar vacíos únicamente en adopciones de
  rescatistas verificados; siguen siendo obligatorios para `lost` y `found`.
- `transit_campaign_details_018` vincula una adopción con una campaña de tipo
  `transit` ya definida en la migración `005`.
- `api_transit_requests_v1` publica solo búsquedas activas de rescatistas
  verificados y nunca expone datos de los hogares colaboradores.
- `offer_transit_home_v1(...)` permite que una cuenta activa se ofrezca como
  tránsito y comparte WhatsApp solo si la persona lo autoriza.
- `review_transit_offer_v1(...)` y `set_transit_request_status_v1(...)` quedan
  limitadas al rescatista responsable o administración.
- `get_my_transit_dashboard_v1()` entrega únicamente las búsquedas y ofertas
  correspondientes a la sesión activa.

Aplicá `018_rescuer_posts_transit_homes.sql` una sola vez y confirmá `PASS` con
`018_verify.sql`. No repitas las migraciones anteriores.

## Solicitudes de adopción y contacto desde el mapa de la migración 019

- `submit_adoption_application_v1(...)` guarda el filtro esencial de adopción
  con nombre, dirección, teléfono, localidad y cuatro respuestas obligatorias.
- `adoption_request_details_019` no admite lectura directa desde el navegador;
  los datos solo se entregan a las partes mediante funciones controladas.
- `get_my_adoption_dashboard_v1()` devuelve solicitudes recibidas al rescatista
  responsable y solicitudes enviadas al postulante.
- `review_adoption_application_v1(...)` permite aceptar o rechazar únicamente
  al rescatista responsable o a administración.
- `get_public_pet_case_contact_v1(...)` devuelve WhatsApp solo para casos no
  adoptivos cuyo publicador marcó expresamente `show_whatsapp`.
- Las adopciones siempre usan el formulario privado en lugar de publicar el
  teléfono del rescatista.

Aplicá `019_adoption_applications_map_contacts.sql` una sola vez y confirmá
`PASS` con `019_verify.sql`. No repitas las migraciones anteriores.

## Avistamientos, resguardo y Web Push de la migración 020

- `submit_pet_sighting_alert_v1(...)` recibe avisos para casos perdidos activos,
  crea la notificación interna y limita envíos repetidos por origen.
- `pet_sighting_alerts_020` guarda teléfono, red social y coordenadas sin lectura
  directa para `anon` ni `authenticated`.
- `get_my_pet_sighting_alerts_v1()` entrega los datos privados solamente al
  dueño de la publicación o a administración.
- `web_push_subscriptions_020` conserva una suscripción voluntaria por
  dispositivo y tampoco admite lectura directa desde el navegador.
- `upsert_my_web_push_subscription_v1(...)` y
  `deactivate_my_web_push_subscription_v1(...)` requieren una cuenta activa.
- `claim_pet_sighting_push_delivery_v1(...)` solo puede ejecutarse con
  `service_role`, exige un token de un solo uso y vence a los diez minutos.
- La notificación interna funciona aunque Web Push no esté configurado o el
  usuario rechace el permiso del navegador.

Aplicá `020_sighting_alerts_web_push.sql` una sola vez y confirmá `PASS` con
`020_verify.sql`. No repitas las migraciones anteriores.

## Push de solicitudes de adopción de la migración 021

- `claim_adoption_request_push_delivery_v1(...)` solamente puede ejecutarse
  con la clave secreta del backend.
- Verifica que la solicitud pertenezca al postulante autenticado que acaba de
  crearla y permite una sola entrega por solicitud.
- El push se envía exclusivamente a las suscripciones activas del rescatista.
- Domicilio, teléfono y respuestas del filtro no forman parte del mensaje push;
  permanecen dentro del panel privado.
- La notificación interna de la migración `019` sigue siendo el respaldo cuando
  el rescatista no activó alertas en su dispositivo.

Aplicá `021_adoption_push_notifications.sql` una sola vez y confirmá `PASS`
con `021_verify.sql`. No repitas las migraciones anteriores.

## Gestión de casos de la migración 022

- `get_my_pet_case_for_management_v1(...)` entrega al dueño o a administración
  los datos editables y el historial del caso.
- `update_my_pet_case_v1(...)` conserva la coordenada exacta en la tabla privada
  y la posición pública aproximada.
- `resolve_my_pet_case_v1(...)` centraliza los estados finales, cierra tránsitos
  relacionados y diferencia selección de adopción de entrega concretada.
- Las transiciones se registran en `post_status_history` y las acciones
  sensibles vuelven a validar sesión, propiedad y rol en Supabase.

Aplicá `022_pet_case_management.sql` una sola vez y confirmá `PASS` con
`022_verify.sql`. No repitas las migraciones anteriores.

## Medallas, encuentros y cercanía de la migración 023

- `get_community_medal_board_v1()` publica las nueve medallas por criterio, el
  ranking solidario y las entregas recientes. No existen niveles de usuario.
- `get_public_community_profile_v1(...)` muestra únicamente datos públicos,
  estadísticas confirmadas y medallas obtenidas.
- `get_public_reunions_v1(...)` publica historias de casos reunidos sin datos de
  contacto ni coordenadas exactas.
- Los avistamientos cuentan para medallas solo cuando su estado es `confirmed`.
- `reunion_contributors_023` vincula usuarios registrados con reencuentros y no
  admite lectura directa desde el navegador.
- `set_my_nearby_alert_preferences_v1(...)` exige opt-in y radio de 3 o 5 km.
  Guarda un solo punto privado; al desactivar elimina las coordenadas.
- `get_my_nearby_alert_preferences_v1()` devuelve solamente las preferencias y
  casos cercanos de la sesión activa.
- `claim_nearby_lost_case_push_delivery_v1(...)` es exclusiva de `service_role`.
  La notificación interna sigue funcionando si no existe suscripción push.

Aplicá `023_medals_reunions_nearby_alerts.sql` una sola vez y confirmá `PASS`
con `023_verify.sql`. No repitas las migraciones `001` a `022`.

## Comunidad interactiva y conversaciones de la migración 024

- `api_community_feed` excluye publicaciones resueltas o vencidas y mantiene
  medios, contadores y el estado de reacción de la sesión.
- `get_my_community_posts_v1()`, `update_my_community_post_v1(...)` y
  `set_my_community_post_state_v1(...)` limitan la gestión al autor.
- `get_my_conversation_inbox_v1()` y `get_my_conversation_v1(...)` entregan
  únicamente hilos en los que participa la sesión y nunca consultan contactos.
- Los mensajes se escriben con `send_conversation_message(...)`; lectura,
  archivado y bloqueo conservan los contratos protegidos de la migración `008`.
- `submit_content_report_v1(...)` admite publicaciones, comentarios o mensajes,
  impide denunciar contenido propio y notifica a administración.
- `content_reports` sigue sin lectura pública; la cola se consulta únicamente
  desde el panel protegido por rol administrador.

Aplicá `024_community_messaging.sql` una sola vez y confirmá `PASS` con
`024_verify.sql`. No repitas las migraciones `001` a `023`.
