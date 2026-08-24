-- Huellas Bariloche - verificador de Migracion 014
with checks as (
  select
    exists (select 1 from private.app_migrations where version = '014') as migration_registered,
    to_regclass('public.external_media') is not null as external_media_exists,
    to_regclass('private.media_provider_config') is not null as provider_config_exists,
    to_regprocedure('public.get_media_provider_configuration()') is not null as provider_contract_exists,
    to_regprocedure('public.admin_configure_imagekit(text)') is not null as provider_admin_function_exists,
    to_regprocedure('public.authorize_imagekit_upload(text)') is not null as upload_authorizer_exists,
    to_regprocedure('public.register_imagekit_upload(text,text,text,text,bigint,integer,integer,text)') is not null as upload_register_exists,
    to_regprocedure('public.set_my_avatar(uuid)') is not null as avatar_function_exists,
    to_regprocedure('public.discard_imagekit_upload(uuid)') is not null as discard_function_exists,
    to_regprocedure('public.update_my_profile(text,text,uuid,text,text)') is not null as profile_function_exists,
    to_regprocedure('private.detach_external_media_014()') is not null as detach_helper_exists,
    exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'external_media' and c.relrowsecurity
    ) as external_media_rls,
    not has_table_privilege('anon', 'public.external_media', 'SELECT') as anon_cannot_read_external_media,
    not has_table_privilege('authenticated', 'public.external_media', 'INSERT')
      and not has_table_privilege('authenticated', 'public.external_media', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.external_media', 'DELETE') as clients_cannot_write_external_media,
    exists (
      select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'pet_posts'
        and t.tgname = 'pet_posts_validate_photo_paths_013' and t.tgenabled = 'O'
    ) as pet_trigger_enabled,
    exists (
      select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'community_media'
        and t.tgname = 'community_media_detach_external_014' and t.tgenabled = 'O'
    ) as community_detach_enabled,
    exists (
      select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'service_media'
        and t.tgname = 'service_media_detach_external_014' and t.tgenabled = 'O'
    ) as service_detach_enabled,
    not exists (
      select 1 from public.external_media e
      where e.byte_size > 1048576 or e.width > 1600 or e.height > 1600
        or e.mime_type <> 'image/webp' or e.provider <> 'imagekit'
    ) as all_external_media_valid,
    not exists (
      select 1 from public.pet_posts p, unnest(p.photo_paths) path
      where not exists (select 1 from public.external_media e where e.public_url = path)
    ) as all_pet_images_registered,
    not exists (
      select 1 from public.sightings s, unnest(s.photo_paths) path
      where not exists (select 1 from public.external_media e where e.public_url = path)
    ) as all_sighting_images_registered,
    not exists (
      select 1 from public.community_media m
      where not exists (select 1 from public.external_media e where e.public_url = m.storage_path)
    ) as all_community_images_registered,
    not exists (
      select 1 from public.service_media m
      where not exists (select 1 from public.external_media e where e.public_url = m.object_path)
    ) as all_service_images_registered
), result as (
  select *, (
    migration_registered and external_media_exists and provider_config_exists
    and provider_contract_exists and provider_admin_function_exists
    and upload_authorizer_exists and upload_register_exists
    and avatar_function_exists and discard_function_exists and profile_function_exists and detach_helper_exists
    and external_media_rls and anon_cannot_read_external_media
    and clients_cannot_write_external_media and pet_trigger_enabled
    and community_detach_enabled and service_detach_enabled
    and all_external_media_valid and all_pet_images_registered
    and all_sighting_images_registered and all_community_images_registered
    and all_service_images_registered
  ) as pass
  from checks
)
select jsonb_build_object(
  'result', case when pass then 'PASS' else 'FAIL' end,
  'migration', jsonb_build_object('version', '014', 'registered', migration_registered),
  'provider', jsonb_build_object(
    'external_media_table', external_media_exists,
    'configuration_table', provider_config_exists,
    'configuration_contract', provider_contract_exists,
    'admin_configuration', provider_admin_function_exists,
    'upload_authorization', upload_authorizer_exists,
    'upload_registration', upload_register_exists
  ),
  'profiles', jsonb_build_object(
    'avatar_function', avatar_function_exists,
    'discard_function', discard_function_exists,
    'profile_function', profile_function_exists
  ),
  'security', jsonb_build_object(
    'external_media_rls', external_media_rls,
    'anon_cannot_read_external_media', anon_cannot_read_external_media,
    'clients_cannot_write_external_media', clients_cannot_write_external_media
  ),
  'triggers', jsonb_build_object(
    'pet_images', pet_trigger_enabled,
    'community_detach', community_detach_enabled,
    'service_detach', service_detach_enabled,
    'detach_helper', detach_helper_exists
  ),
  'integrity', jsonb_build_object(
    'all_external_media_valid', all_external_media_valid,
    'all_pet_images_registered', all_pet_images_registered,
    'all_sighting_images_registered', all_sighting_images_registered,
    'all_community_images_registered', all_community_images_registered,
    'all_service_images_registered', all_service_images_registered
  )
)
from result;
