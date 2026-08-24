HUELLAS BARILOCHE - MIGRACION 015

Objetivo
Crear el contrato transaccional para publicar animales perdidos, encontrados o
en adopcion con fotografias de ImageKit y ubicacion exacta privada.

Orden
1. Confirmar que 014_verify.sql devolvio PASS.
2. Ejecutar 015_pet_post_publishing.sql una sola vez en Supabase SQL Editor.
3. Ejecutar 015_verify.sql.
4. Continuar solamente si el resultado es PASS.

La migracion agrega
- public.create_pet_post_v1(...)
- private.pet_post_requests para impedir dobles publicaciones por reintentos.
- Validacion de 1 a 4 imagenes ImageKit propias.
- Control de adopciones exclusivo para rescatistas verificados.
- Coordenada exacta en pet_locations_private y punto publico redondeado.
- Limite preventivo de 10 publicaciones por cuenta cada 24 horas.
- Alta directa revocada: el cliente publica solamente mediante la funcion 015.

No repetir las migraciones 001 a 014.
