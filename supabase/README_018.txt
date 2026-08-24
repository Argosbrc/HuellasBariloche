HUELLAS BARILOCHE - MIGRACION 018
=================================

Esta migracion corrige y agrega:

- Las senas particulares son realmente opcionales al publicar.
- En adopciones creadas por rescatistas verificados, zona, fecha y hora son opcionales.
- Perdidos y encontrados siguen exigiendo zona, fecha y hora.
- Una publicacion de adopcion puede marcar que necesita hogar de transito.
- Portal publico /transitos con busquedas activas.
- Cualquier cuenta activa puede ofrecer un hogar temporal.
- Los datos privados de la oferta solo llegan al rescatista responsable.
- El rescatista revisa ofertas y cierra busquedas desde /panel.

ORDEN DE INSTALACION
--------------------

1. Confirmar que las migraciones 001 a 017 ya estan instaladas.
2. Ejecutar una sola vez 018_rescuer_posts_transit_homes.sql.
3. Ejecutar 018_verify.sql.
4. Continuar unicamente si el JSON devuelve "result": "PASS".
5. Actualizar el proyecto web conservando .env.local.
6. Ejecutar npm install y npm run dev.

No repetir las migraciones 001 a 017.

PRUEBA RECOMENDADA
------------------

1. Ingresar como rescatista verificado.
2. Publicar una adopcion sin zona ni fecha.
3. Marcar "Necesita hogar de transito" y completar la necesidad.
4. Confirmar que aparece en /adopciones y /transitos.
5. Ingresar con una cuenta comun y ofrecer transito.
6. Volver al rescatista y aceptar o rechazar la oferta desde /panel.
