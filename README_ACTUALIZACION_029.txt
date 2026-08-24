HUELLAS BARILOCHE - ACTUALIZACION WEB 029
TRANSITOS DENTRO DE RED SOLIDARIA

CAMBIOS INCLUIDOS

- Tránsitos deja de ser una sección independiente del menú.
- Red solidaria reúne las búsquedas de hogares temporales y el directorio de
  rescatistas y organizaciones verificadas.
- Las personas registradas pueden ofrecer tránsito sin salir de Red solidaria.
- Las propuestas enviadas, los datos del hogar y el WhatsApp compartido siguen
  siendo privados para el rescatista responsable.
- La URL anterior /transitos redirige a /rescatistas#transitos para conservar
  enlaces guardados.
- Los accesos del panel y del inicio apuntan a la nueva ubicación.
- Se aclara que Red solidaria contiene tránsitos, perfiles, necesidades,
  donaciones y formas públicas de contacto.

INSTALACION

1. Confirmar que 024_verify.sql haya devuelto PASS antes de usar la web 029.
2. Conservar el archivo .env.local de la instalación actual.
3. Reemplazar el proyecto por esta versión y restaurar .env.local.
4. Ejecutar npm install y npm run dev.

Esta actualización es únicamente del proyecto web. No requiere una migración
nueva y no se deben repetir las migraciones 001 a 024.
