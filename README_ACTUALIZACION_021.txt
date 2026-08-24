HUELLAS BARILOCHE - ACTUALIZACION 021

Mejoras incluidas:
- El mapa muestra la foto real del animal como marcador.
- Al tocar la foto se abre un resumen y el acceso directo a la ficha.
- La ficha permite contactar al publicador solo cuando autorizo mostrar WhatsApp.
- Las adopciones abren un formulario privado con datos personales y filtro esencial.
- El rescatista recibe nombre, animal, respuestas, telefono, localidad y direccion.
- El panel permite revisar, aceptar o rechazar solicitudes.
- La persona postulante puede ver el estado desde su panel.

Instalacion:
1. Confirmar que la migracion 018 ya esta aplicada.
2. Ejecutar supabase/019_adoption_applications_map_contacts.sql una sola vez.
3. Ejecutar supabase/019_verify.sql y confirmar result PASS.
4. Conservar .env.local al reemplazar el proyecto.
5. Ejecutar npm install y npm run dev.

No volver a ejecutar las migraciones 001 a 018.
