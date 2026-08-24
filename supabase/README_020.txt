HUELLAS BARILOCHE - MIGRACION 020

1. Ejecutar una sola vez: 020_sighting_alerts_web_push.sql
2. Ejecutar despues: 020_verify.sql
3. Confirmar que el JSON devuelva "result": "PASS".

No repetir las migraciones 001 a 019.

Esta migracion incorpora:
- avisos privados de avistamiento o resguardo;
- telefono, red social y coordenadas visibles solo para el dueño del caso;
- notificacion interna siempre disponible;
- suscripciones Web Push voluntarias por dispositivo;
- entrega push de un solo uso y limite basico contra abuso.
