HUELLAS BARILOCHE - ACTUALIZACION WEB 028
COMUNIDAD INTERACTIVA Y MENSAJERIA PRIVADA

FUNCIONES INCORPORADAS

- Cada publicación de Comunidad tiene una ficha propia con galería, fecha,
  comentarios, Me gusta y compartir.
- Los autores pueden editar sus publicaciones, cambiar su vigencia, marcarlas
  como resueltas, reabrirlas o retirarlas desde su panel.
- Los pedidos y ofrecimientos vencen automáticamente para mantener el feed
  actual y evitar llamados a la acción desactualizados.
- La ficha de cada caso permite iniciar una conversación privada con la persona
  responsable sin publicar ni revelar su teléfono.
- Nueva bandeja /conversaciones con mensajes no leídos, caso relacionado y
  acceso al hilo privado.
- Los participantes pueden archivar, bloquear, desbloquear y denunciar mensajes.
- Publicaciones, comentarios y mensajes pueden denunciarse a administración.
- El panel administrativo identifica el tipo y el contenido denunciado.
- Todas las lecturas y escrituras privadas se resuelven con sesión autenticada y
  funciones SECURITY DEFINER de alcance limitado; no se usa service_role en la UI.

ORDEN DE INSTALACION

1. Confirmar que la migración 023 está aplicada y que 023_verify.sql dio PASS.
2. Ejecutar una sola vez supabase/024_community_messaging.sql.
3. Ejecutar supabase/024_verify.sql.
4. Continuar solamente si el JSON devuelve "result": "PASS".
5. Conservar el archivo .env.local al reemplazar el proyecto.
6. Ejecutar npm install.
7. Ejecutar npm run build y desplegar.

No repetir las migraciones 001 a 023.

VALIDACIONES DE ESTA ENTREGA

- TypeScript: PASS.
- ESLint: PASS.
- Build de producción Next.js: PASS.
- Parser nativo de PostgreSQL para 024 y su verificador: PASS.

PRUEBA FUNCIONAL RECOMENDADA

- Cuenta A publica un caso y una publicación de Comunidad.
- Cuenta B comenta, reacciona e inicia una conversación desde el caso.
- Cuenta A responde y confirma que el contador de no leídos se limpia al abrir.
- Cuenta B bloquea y desbloquea; la conversación debe quedar utilizable de nuevo.
- Cuenta B denuncia un comentario o mensaje.
- Una administradora revisa la denuncia en /admin?section=denuncias.
