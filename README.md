# Huellas Bariloche

Aplicación web de la red solidaria Huellas Bariloche. Este repositorio usa Next.js, TypeScript, Supabase y está preparado para desarrollo local y despliegue en Vercel.

## Qué incluye esta entrega

- Inicio responsive con la identidad visual aprobada.
- Casos, adopciones, hogares de tránsito, mapa real en el inicio, comunidad, encuentros, medallero, red solidaria y Datos útiles.
- Lectura real de las vistas públicas creadas por la migración `012`.
- Registro e ingreso con Supabase Auth y sesión SSR.
- Panel `/panel` adaptado a usuario, rescatista o administrador.
- Perfil editable con nombre, biografía, ciudad, WhatsApp, correo público y foto.
- Panel `/admin` protegido por rol, con usuarios, casos, rescatistas, denuncias, auditoría y Datos útiles.
- Datos útiles con categorías administrables, horarios, guardias, atención a domicilio, especializaciones, productos, envíos, teléfonos y redes.
- Portal público de rescatistas aprobados con ficha, alias opcional, necesidades actuales y contacto.
- Comunidad pública que conserva la sesión activa y vuelve correctamente después del ingreso.
- Comunidad interactiva con detalle, comentarios, reacciones, compartir,
  denuncias y gestión de vigencia por parte del autor.
- Conversaciones privadas vinculadas a casos, con bandeja, lectura, archivado,
  bloqueo y denuncia de mensajes sin exponer teléfonos.
- Acciones administrativas mediante las funciones seguras ya existentes; no usa `service_role`.
- ImageKit Free para las imágenes públicas; Supabase conserva datos, autenticación y evidencias privadas.
- Compresión previa a la carga según las migraciones `013` y `014`:
  - WebP como salida.
  - 1 MB máximo almacenado.
  - 1600 px máximo por lado.
  - Hasta cuatro imágenes.
  - JPG, PNG, WebP, HEIC y HEIF como entrada.
- Validación adicional en el servidor antes de enviar cada imagen a ImageKit.
- Carpetas por usuario y destino, registro de propiedad en Supabase y limpieza de cargas fallidas.
- Formulario real para animales perdidos, encontrados o en adopción:
  - Una a cuatro fotografías optimizadas y adjuntadas a la publicación.
  - Adopciones exclusivas para rescatistas verificados.
  - Fecha, zona, datos físicos, salud, señas y contacto opcional.
  - Ubicación exacta privada y coordenada pública redondeada.
  - Protección contra dobles envíos y límite preventivo de abuso.
  - Lugar y momento opcionales en adopciones de rescatistas verificados.
  - Búsqueda de hogar de tránsito vinculada a la adopción.
- Portal `/transitos` para que las cuentas comunes ofrezcan un hogar temporal y
  los rescatistas revisen cada propuesta desde su panel.
- Marcadores del mapa con la foto real y acceso directo a la ficha del caso.
- Contacto por WhatsApp únicamente cuando el publicador lo autorizó.
- Formulario privado de adopción con datos de contacto, domicilio y filtro
  esencial; solicitudes recibidas y enviadas visibles en el panel.
- Aplicación instalable en Android, iPhone y computadora, con acceso desde el
  menú móvil y el panel.
- Alertas Web Push opcionales para avistamientos, animales a resguardo y nuevas
  solicitudes de adopción.
- Alertas opt-in de mascotas perdidas a 3 o 5 km, con un único punto privado,
  sin historial de movimientos y con notificación interna aunque no haya push.
- Medallas por criterios verificables, ranking solidario, perfiles públicos y
  agradecimientos a quienes colaboraron en un reencuentro.
- Un único ingreso para miembros, rescatistas y administración; las opciones se
  habilitan dentro del panel según el rol aprobado.
- Opción para ver u ocultar la contraseña en ingreso y registro.
- Footer “Desarrollado por Argos IT” y enlaces a Instagram y Cafecito.
- Ninguna clave `service_role` ni VAPID privada dentro del código o del repositorio.

## Requisitos

- Node.js 22 o superior.
- npm 10 o superior.
- El proyecto Supabase de Huellas Bariloche con las migraciones `001` a `024` aprobadas.
- Una cuenta gratuita de ImageKit.

## Instalación en Windows

1. Descomprimí el ZIP en una carpeta.
2. Abrí esa carpeta con Visual Studio Code.
3. Copiá `.env.example` como `.env.local`.
4. Completá estas variables desde Supabase → Project Settings → API:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/TU_ID
IMAGEKIT_PRIVATE_KEY=TU_CLAVE_PRIVADA_DE_IMAGEKIT
SUPABASE_SERVICE_ROLE_KEY=TU_CLAVE_SECRETA_SOLO_SERVIDOR
NEXT_PUBLIC_VAPID_PUBLIC_KEY=TU_CLAVE_PUBLICA_VAPID
VAPID_PRIVATE_KEY=TU_CLAVE_PRIVADA_VAPID
VAPID_SUBJECT=mailto:TU-CORREO
```

5. En la terminal ejecutá:

```bash
npm install
npm run dev
```

6. Abrí `http://localhost:3000`.

La clave publicable de Supabase, la clave pública VAPID y el URL endpoint de
ImageKit pueden estar en el navegador. `SUPABASE_SERVICE_ROLE_KEY`,
`IMAGEKIT_PRIVATE_KEY` y `VAPID_PRIVATE_KEY` son privadas: nunca deben usar el
prefijo `NEXT_PUBLIC_`, copiarse en el código, enviarse por chat ni subirse a Git.

## Migración 014

Dentro de `supabase/` están los archivos nuevos:

1. Ejecutá `014_imagekit_panels.sql` una sola vez en Supabase SQL Editor.
2. Ejecutá `014_verify.sql`.
3. Continuá solamente si el resultado es `PASS`.

La migración se detiene sin cambios si encuentra imágenes públicas preexistentes. Esto es intencional: la base aprobada hasta `013` informó cero imágenes, por lo que el cambio de proveedor puede realizarse sin trasladar archivos.

No repitas las migraciones `001` a `013`.

## Migración 015

Después de confirmar que la `014` está aprobada:

1. Ejecutá `015_pet_post_publishing.sql` una sola vez en Supabase SQL Editor.
2. Ejecutá `015_verify.sql`.
3. Continuá solamente si el resultado es `PASS`.

La migración crea el contrato `create_pet_post_v1`, que valida la sesión, el
rol, la propiedad de las imágenes, la privacidad geográfica y la clave de
idempotencia antes de crear el caso. No repitas las migraciones `001` a `014`.

## Migración 016

Después de confirmar que la `015` está aprobada:

1. Ejecutá `016_useful_data_rescuers.sql` una sola vez en Supabase SQL Editor.
2. Ejecutá `016_verify.sql`.
3. Continuá solamente si el resultado es `PASS`.

La migración agrega los datos específicos de cada rubro, categorías iniciales,
el directorio público de rescatistas aprobados y los campos opcionales de
donaciones. No modifica ni repite las migraciones anteriores.

## Migraciones 017 y 018

Después de confirmar que la `016` está aprobada:

1. Ejecutá `017_rescuer_approval_fix.sql` y confirmá `PASS` con `017_verify.sql`.
2. Ejecutá `018_rescuer_posts_transit_homes.sql` una sola vez.
3. Ejecutá `018_verify.sql` y continuá solamente si devuelve `PASS`.

La `018` corrige los campos opcionales de publicación, permite omitir zona y
fecha en adopciones de rescatistas, y conecta publicaciones con búsquedas y
ofertas privadas de hogares de tránsito. No repitas las migraciones anteriores.

## Migración 019

Después de confirmar que la `018` está aprobada:

1. Ejecutá `019_adoption_applications_map_contacts.sql` una sola vez.
2. Ejecutá `019_verify.sql`.
3. Continuá solamente si el resultado es `PASS`.

La `019` agrega el filtro privado de adopción, la bandeja de solicitudes para
rescatistas y el contacto público condicionado por la autorización del
publicador. No repitas las migraciones anteriores.

## Migraciones 020 y 021

1. Ejecutá `020_sighting_alerts_web_push.sql` y confirmá `PASS` con
   `020_verify.sql`.
2. Ejecutá una sola vez `021_adoption_push_notifications.sql`.
3. Ejecutá `021_verify.sql` y continuá solamente si devuelve `PASS`.

La `020` habilita avistamientos, resguardos y suscripciones voluntarias por
dispositivo. La `021` agrega la entrega push privada y no duplicada de nuevas
solicitudes de adopción a los rescatistas que activaron alertas.

## Migración 022

Después de confirmar que `021_verify.sql` devolvió `PASS`:

1. Ejecutá `022_pet_case_management.sql` una sola vez.
2. Ejecutá `022_verify.sql`.
3. Continuá solamente si devuelve `"result": "PASS"`.

La `022` habilita la edición y el cierre seguro de casos, conserva el historial,
cierra búsquedas de tránsito relacionadas y separa la selección de un postulante
de la confirmación final de una adopción.

## Migración 023

Después de confirmar que `022_verify.sql` devolvió `PASS`:

1. Ejecutá `023_medals_reunions_nearby_alerts.sql` una sola vez.
2. Ejecutá `023_verify.sql`.
3. Continuá solamente si devuelve `"result": "PASS"`.

La `023` incorpora nueve medallas por acciones concretas, ranking y perfiles
públicos, historias de reencuentro, agradecimientos privados y alertas
voluntarias de 3 o 5 km. Las coordenadas exactas permanecen privadas, no se
guarda historial de movimientos y la entrega push se reclama solo desde el
backend. No repitas las migraciones `001` a `022`.

## Migración 024

Después de confirmar que `023_verify.sql` devolvió `PASS`:

1. Ejecutá `024_community_messaging.sql` una sola vez.
2. Ejecutá `024_verify.sql`.
3. Continuá solamente si devuelve `"result": "PASS"`.

La `024` activa la gestión de publicaciones de Comunidad, incorpora su
vencimiento automático, crea la bandeja privada de conversaciones y centraliza
las denuncias de publicaciones, comentarios y mensajes. Las conversaciones no
exponen teléfonos y solo pueden leerlas sus dos participantes. No repitas las
migraciones `001` a `023`.

## Configurar ImageKit Free

1. Creá la cuenta gratuita en ImageKit.
2. En el panel de ImageKit copiá el **URL endpoint** y la **Private key**.
3. Colocalos en `.env.local` usando los nombres de `.env.example`.
4. Reiniciá `npm run dev`.
5. Ingresá como administradora en `/admin?section=guia`.
6. Pegá allí el mismo URL endpoint y pulsá **Activar ImageKit**.

La aplicación compara el endpoint de `.env.local` con el configurado en Supabase. Si no coinciden, rechaza la carga.

## Acceso administrativo

La ruta `http://localhost:3000/admin` exige una sesión válida y `public.profiles.role = 'admin'`. Las cuentas comunes son redirigidas a Mi cuenta y las acciones vuelven a verificar el rol en el servidor antes de llamar a Supabase.

El panel usa funciones protegidas de la base, entre ellas:

- `admin_set_user_status`
- `admin_moderate_post`
- `admin_resolve_report`
- `admin_review_rescuer_application`
- `admin_upsert_service`
- `admin_set_service_status`
- `admin_configure_imagekit`

Los paneles e ImageKit requieren `014`; la publicación real requiere `015`.

## Paneles por rol

- `/panel`: tablero personal. Cambia automáticamente según `member`, `rescuer` o `admin`.
- `/conversaciones`: bandeja privada vinculada a los casos publicados.
- `/comunidad/[id]`: participación pública; `/panel/comunidad/[id]`: gestión del autor.
- `/medallas`: catálogo, ranking solidario y actividad reciente.
- `/encuentros`: historias públicas de mascotas reunidas con su familia.
- `/perfiles/[id]`: perfil comunitario público con acciones y medallas.
- `/cuenta/perfil`: edición de datos y foto de perfil.
- `/admin`: moderación, aprobación de rescatistas y gestión de Datos útiles, exclusivo para `admin`.
- `/rescatistas`: portal público de perfiles ya aprobados.
- `/transitos`: búsquedas públicas de hogares temporales y ofrecimientos privados.
- `/datos-utiles`: directorio público; `/servicios` redirige por compatibilidad.

Los rescatistas verificados pueden editar su organización, descripción, área de trabajo, redes, alias y necesidades. Los usuarios comunes pueden enviar o retirar su solicitud de verificación desde el panel; solamente el administrador puede aprobarla.

## Supabase Auth

En Authentication → URL Configuration:

- Site URL local: `http://localhost:3000`
- Redirect URL local: `http://localhost:3000/auth/callback`
- Después de publicar, agregá también `https://TU-DOMINIO.vercel.app/auth/callback`.

Las páginas autenticadas son dinámicas y la sesión se actualiza mediante `proxy.ts`.

## Desplegar en Vercel

1. Subí esta carpeta a un repositorio privado de GitHub.
2. Importá el repositorio desde Vercel.
3. Confirmá el preset **Next.js**.
4. Cargá todas las variables de `.env.example` en Vercel. Marcá como sensibles
   `SUPABASE_SERVICE_ROLE_KEY`, `IMAGEKIT_PRIVATE_KEY` y `VAPID_PRIVATE_KEY`.
5. Cambiá `NEXT_PUBLIC_SITE_URL` por el dominio definitivo.
6. Desplegá y agregá el callback definitivo en Supabase Auth.

## Datos vacíos

La base validada todavía no contiene casos, adopciones ni servicios. Cuando las variables estén configuradas, las secciones mostrarán estados vacíos reales y se actualizarán automáticamente al existir datos visibles. Sin variables, la portada conserva datos demostrativos para revisar el diseño.

## Scripts

```bash
npm run dev        # desarrollo local del paquete transferible
npm run build      # compilación de producción
npm run start      # servidor de producción después de compilar
npm run typecheck  # validación TypeScript
npm run lint       # análisis estático
```

## Próximo bloque recomendado

Después de aplicar y verificar la `024`, conviene ejecutar una prueba integral
con dos cuentas y una administradora: iniciar conversación, responder, marcar
lectura, bloquear/desbloquear, comentar, resolver una publicación y revisar una
denuncia desde el panel administrativo.
