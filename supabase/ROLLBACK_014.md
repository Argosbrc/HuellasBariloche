# Reversión de la migración 014

La migración `014` cambia el contrato de todas las imágenes públicas. No debe revertirse con un `DROP` directo después de comenzar a cargar archivos en ImageKit.

Si `014_imagekit_panels.sql` falla antes de `commit`, PostgreSQL revierte la transacción completa y no deja cambios parciales.

Si finaliza correctamente pero todavía no existen filas en `public.external_media`, la reversión recomendada es restaurar el respaldo o clon creado inmediatamente antes de ejecutar `014`.

Si ya existen imágenes registradas:

1. Detener temporalmente las cargas desde la aplicación.
2. Exportar `public.external_media` y las tablas que referencian sus URL.
3. Descargar o trasladar los archivos desde ImageKit.
4. Preparar una migración asistida que reescriba cada referencia.
5. Verificar casos, avistamientos, comunidad, campañas, perfiles y servicios antes de eliminar cualquier objeto.

Las evidencias privadas y los PDF no se modifican con `014` y permanecen en Supabase Storage.
