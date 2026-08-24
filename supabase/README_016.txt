HUELLAS BARILOCHE - MIGRACION 016

Contenido:
- 016_useful_data_rescuers.sql
- 016_verify.sql

Orden:
1. Ejecutar 016_useful_data_rescuers.sql una sola vez en Supabase SQL Editor.
2. Ejecutar 016_verify.sql.
3. Confirmar que el JSON indique "result": "PASS".

No repetir las migraciones 001 a 015.

La migracion agrega:
- Datos utiles con categorias, horarios, guardias, domicilio, especialidades,
  productos, envios, medios de pago y redes.
- Portal publico exclusivo para rescatistas aprobados.
- Alias, necesidades actuales y datos publicos de donacion opcionales.
- Funciones protegidas para administracion y rescatistas verificados.
- Categorias iniciales atribuidas a un administrador existente, incluso cuando
  la migracion se ejecuta desde SQL Editor sin una sesion de usuario.

La aprobacion o rechazo de solicitudes sigue realizandose exclusivamente desde
el panel administrador.
