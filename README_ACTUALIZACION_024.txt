HUELLAS BARILOCHE - ACTUALIZACION WEB 024
APP INSTALABLE, RESPONSIVE Y ALERTAS DE ADOPCION

FUNCIONES INCORPORADAS

- Ojo para ver u ocultar la contraseña al ingresar o crear una cuenta.
- Boton "Instalar Huellas" en el menu de celulares y en el panel.
- Aviso de instalacion no invasivo en dispositivos moviles.
- Instrucciones especificas para Android y para iPhone/iPad.
- Manifiesto PWA, acceso directo, service worker y atajos rapidos.
- Responsive reforzado para formularios, panel, menu y pantallas angostas.
- Campos de formularios a 16 px en celulares para evitar el zoom automatico.
- Alertas push opcionales para nuevas solicitudes de adopcion.
- Se mantienen las alertas internas aunque el usuario no active push.
- Correccion de build:vercel y unificacion de NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT.

ORDEN DE INSTALACION

1. Confirmar que 020_verify.sql devolvio "result": "PASS".
2. Ejecutar una sola vez supabase/021_adoption_push_notifications.sql.
3. Ejecutar supabase/021_verify.sql y confirmar "result": "PASS".
4. Conservar .env.local al reemplazar el proyecto.
5. Ejecutar npm install.
6. Ejecutar npm run dev.

PARA INSTALAR EN EL CELULAR

- Android: tocar "Instalar Huellas". Si el navegador no muestra la ventana,
  abrir el menu de Chrome y elegir "Instalar app".
- iPhone/iPad: abrir en Safari, tocar Compartir y elegir
  "Agregar a pantalla de inicio". Luego abrir Huellas desde ese icono.
- En cada dispositivo, ingresar al panel y tocar "Activar" en Alertas.

Las notificaciones son voluntarias y se activan por dispositivo. No repetir
las migraciones 001 a 020.
