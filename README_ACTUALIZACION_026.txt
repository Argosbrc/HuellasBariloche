HUELLAS BARILOCHE - ACTUALIZACION 026
GESTION Y CIERRE DE CASOS

INCLUYE

- Acceso "Gestionar" desde cada publicacion del panel.
- Edicion de datos, zona, contacto, ubicacion privada y fotografias.
- Cambio de portada y reemplazo seguro de imagenes.
- Historial completo de estados.
- Cierre como reunido, adopcion concretada, cerrado o archivado.
- Retiro automatico del mapa, carrusel y listados activos.
- Cierre de la busqueda de transito vinculada a una adopcion.
- Seleccion de postulante separada de la adopcion concretada.
- Estados para avisos: contactado, resuelto o descartado.
- Notificaciones individuales o masivas como leidas.
- Diseno responsive para celulares.

ORDEN DE INSTALACION

1. Confirmar que 021_verify.sql devolvio "result": "PASS".
2. Ejecutar supabase/022_pet_case_management.sql una sola vez.
3. Ejecutar supabase/022_verify.sql.
4. Continuar solamente si devuelve "result": "PASS".
5. Conservar .env.local y reemplazar el proyecto.
6. Ejecutar npm install y npm run dev.

No repetir las migraciones 001 a 021.
