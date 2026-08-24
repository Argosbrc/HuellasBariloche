HUELLAS BARILOCHE - MIGRACION 021
ALERTAS PUSH PARA SOLICITUDES DE ADOPCION

1. Confirmar primero que 020_verify.sql devolvio "result": "PASS".
2. Ejecutar una sola vez 021_adoption_push_notifications.sql.
3. Ejecutar 021_verify.sql.
4. Continuar solamente si el resultado es "PASS".

La notificacion interna del panel sigue funcionando siempre. La alerta del
telefono solo se envia a los rescatistas que hayan activado las notificaciones
en ese dispositivo.

No repetir las migraciones 001 a 020.
