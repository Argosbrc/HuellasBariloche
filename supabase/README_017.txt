HUELLAS BARILOCHE - MIGRACION 017

Objetivo
Corregir la aprobacion o rechazo de solicitudes de rescatistas cuando la regla
de seguridad de notificaciones instalada por la migracion 009 esta activa.

Orden
1. Ejecutar una vez 017_rescuer_approval_fix.sql en Supabase SQL Editor.
2. Ejecutar 017_verify.sql.
3. Confirmar que el JSON devuelva "result": "PASS".
4. Volver al panel administrador y aprobar la solicitud pendiente.

No volver a ejecutar las migraciones 001 a 016.
La solicitud que fallo antes de esta correccion permanece pendiente y puede
aprobarse despues de instalar 017.
