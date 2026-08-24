HUELLAS BARILOCHE - MIGRACION 022
GESTION, EDICION Y CIERRE DE CASOS

ORDEN

1. Confirmar que 021_verify.sql devolvio "result": "PASS".
2. Ejecutar una sola vez 022_pet_case_management.sql.
3. Ejecutar 022_verify.sql.
4. Continuar solamente si el resultado es "PASS".

NO REPETIR LAS MIGRACIONES 001 A 021.

La migracion 022 permite que el titular edite su ficha y fotografias, consulte
el historial, cierre o archive el caso y gestione avisos privados. Una adopcion
ya no se marca como concretada al seleccionar un postulante: la confirmacion
final se realiza por separado desde la gestion del caso.

Al resolver una adopcion, tambien se cierra la busqueda de hogar de transito
relacionada. Los casos cerrados se conservan en la base y dejan de aparecer en
el mapa, carrusel y listados activos.
