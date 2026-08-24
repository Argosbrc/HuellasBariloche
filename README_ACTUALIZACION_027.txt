HUELLAS BARILOCHE - ACTUALIZACION WEB 027
MAPA EN INICIO, MEDALLERO, ENCUENTROS Y ALERTAS CERCANAS

FUNCIONES INCORPORADAS

- El mapa real deja de ser una sección del menú y aparece en el primer bloque
  del inicio, junto al carrusel de mascotas perdidas.
- La URL anterior /mapa redirige al mapa del inicio para conservar enlaces.
- Medallero público con nueve reconocimientos concretos y sin niveles.
- Ranking solidario y perfiles públicos con las medallas obtenidas.
- Los avistamientos cuentan únicamente después de que la familia los confirma.
- Nueva sección Encuentros para celebrar mascotas que volvieron a casa.
- Agradecimiento privado a usuarios registrados cuya colaboración quedó
  vinculada a un reencuentro.
- Alertas voluntarias de mascotas perdidas dentro de un radio de 3 o 5 km.
- Se guarda un único punto privado de referencia y no existe historial de
  movimientos. Al desactivar las alertas, ese punto se elimina.
- Notificación interna siempre; Web Push solamente si el usuario lo habilitó
  también en su dispositivo.
- Un único ingreso para miembros, rescatistas y administración. El panel
  habilita las opciones correspondientes al rol aprobado.
- “Rescatistas” se presenta en la navegación como “Red solidaria” para dejar
  claro que es un directorio público y no otro acceso al sistema.

ORDEN DE INSTALACION

1. Confirmar que la migración 022 ya está aplicada y que 022_verify.sql dio PASS.
2. Ejecutar una sola vez supabase/023_medals_reunions_nearby_alerts.sql.
3. Ejecutar supabase/023_verify.sql.
4. Continuar solamente si el JSON devuelve "result": "PASS".
5. Conservar el archivo .env.local al reemplazar el proyecto.
6. Ejecutar npm install.
7. Ejecutar npm run dev.

No repetir las migraciones 001 a 022.
