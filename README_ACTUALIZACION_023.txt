HUELLAS BARILOCHE - ACTUALIZACION WEB 023
AVISTAMIENTOS, RESGUARDO Y ALERTAS PUSH

FUNCIONES INCORPORADAS

- En todo caso activo de mascota perdida aparece "Informar ahora".
- La persona puede indicar "Lo vi" o "Lo tengo a resguardo".
- Lugar escrito obligatorio y ubicación GPS exacta opcional.
- Comentario, teléfono/WhatsApp y red social.
- Para un animal a resguardo se exige al menos teléfono o red social.
- El dueño recibe siempre una notificación dentro de su panel.
- Los datos y las coordenadas no se publican: solo los ve el dueño del caso.
- El dueño puede activar alertas Web Push en cada teléfono o computadora.
- En iPhone se incluye soporte instalable; primero hay que agregar el sitio a la pantalla de inicio.

ORDEN DE INSTALACION

1. Ejecutar una sola vez supabase/020_sighting_alerts_web_push.sql.
2. Ejecutar supabase/020_verify.sql y confirmar "result": "PASS".
3. Conservar el archivo .env.local al reemplazar el proyecto.
4. Ejecutar npm install.
5. Completar las variables de Web Push en .env.local.
6. Ejecutar npm run dev.

VARIABLES NUEVAS

SUPABASE_SERVICE_ROLE_KEY=clave_service_role_de_Supabase
NEXT_PUBLIC_VAPID_PUBLIC_KEY=clave_publica_vapid
VAPID_PRIVATE_KEY=clave_privada_vapid
VAPID_SUBJECT=mailto:correo-del-administrador@example.com

IMPORTANTE: SUPABASE_SERVICE_ROLE_KEY y VAPID_PRIVATE_KEY son secretos. Nunca
deben comenzar con NEXT_PUBLIC ni subirse a Git.

GENERAR LAS DOS CLAVES VAPID

npx web-push generate-vapid-keys --json

Copiar publicKey en NEXT_PUBLIC_VAPID_PUBLIC_KEY y privateKey en
VAPID_PRIVATE_KEY. La notificación interna funciona aunque no se configuren
las claves; las alertas del teléfono requieren las cuatro variables nuevas.

No repetir las migraciones 001 a 019.
