-- Huellas Bariloche - Verificacion posterior a la migracion 015.
-- Solo lectura. El resultado esperado es un unico JSON con "result": "PASS".

with function_ref as (
  select to_regprocedure(
    'public.create_pet_post_v1(uuid,text,text,text,text,text,text,text,text[],text,text,text,text,text[],text,double precision,double precision,text,boolean,timestamp with time zone)'
  ) as oid
), checks as (
  select
    to_regclass('private.pet_post_requests') is not null as request_table_exists,
    (select oid is not null from function_ref) as publish_function_exists,
    exists (
      select 1
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where p.oid = (select oid from function_ref)
        and n.nspname = 'public'
        and p.prosecdef
        and p.provolatile = 'v'
        and coalesce(p.proconfig, '{}'::text[]) @> array['search_path=""']
    ) as publish_function_hardened,
    not has_function_privilege(
      'anon',
      'public.create_pet_post_v1(uuid,text,text,text,text,text,text,text,text[],text,text,text,text,text[],text,double precision,double precision,text,boolean,timestamp with time zone)',
      'EXECUTE'
    ) and has_function_privilege(
      'authenticated',
      'public.create_pet_post_v1(uuid,text,text,text,text,text,text,text,text[],text,text,text,text,text[],text,double precision,double precision,text,boolean,timestamp with time zone)',
      'EXECUTE'
    ) as function_privileges_ok,
    not has_table_privilege('anon', 'private.pet_post_requests', 'SELECT, INSERT, UPDATE, DELETE')
      and not has_table_privilege('authenticated', 'private.pet_post_requests', 'SELECT, INSERT, UPDATE, DELETE')
      as request_table_private,
    not exists (
      select 1
      from information_schema.column_privileges privilege
      where privilege.table_schema = 'public'
        and privilege.table_name in ('pet_posts', 'pet_locations_private')
        and privilege.grantee = 'authenticated'
        and privilege.privilege_type = 'INSERT'
    ) as direct_client_insert_revoked,
    lower(pg_get_functiondef((select oid from function_ref))) like '%private.is_active_user()%'
      and lower(pg_get_functiondef((select oid from function_ref))) like '%public.external_media%'
      and lower(pg_get_functiondef((select oid from function_ref))) like '%purpose = ''pet_post''%'
      and lower(pg_get_functiondef((select oid from function_ref))) like '%cardinality(clean_photos) not between 1 and 4%'
      as image_contract_ok,
    lower(pg_get_functiondef((select oid from function_ref))) like '%public.pet_locations_private%'
      and lower(pg_get_functiondef((select oid from function_ref))) like '%round(p_exact_latitude::numeric, 3)%'
      and lower(pg_get_functiondef((select oid from function_ref))) like '%''approximate''%'
      as location_privacy_ok,
    lower(pg_get_functiondef((select oid from function_ref))) like '%verification_status = ''verified''%'
      and lower(pg_get_functiondef((select oid from function_ref))) like '%solo un rescatista verificado%'
      as adoption_role_check_ok,
    lower(pg_get_functiondef((select oid from function_ref))) like '%pg_advisory_xact_lock%'
      and lower(pg_get_functiondef((select oid from function_ref))) like '%private.pet_post_requests%'
      as idempotency_ok,
    not exists (
      select 1
      from public.external_media e
      where e.attached_entity_type = 'pet_posts'
        and e.status = 'attached'
        and not exists (
          select 1
          from public.pet_posts p
          where p.id = e.attached_entity_id
            and e.public_url = any(p.photo_paths)
        )
    ) as all_attached_pet_media_valid,
    not exists (
      select 1
      from public.pet_posts p
      where cardinality(p.photo_paths) > 4
    ) as all_post_image_counts_valid,
    not exists (
      select 1
      from private.pet_post_requests r
      where not exists (select 1 from public.pet_posts p where p.id = r.pet_post_id)
    ) as all_request_links_valid,
    exists (
      select 1 from private.app_migrations m where m.version = '015'
    ) as migration_registered
), sections as (
  select
    jsonb_build_object(
      'request_table_exists', request_table_exists,
      'publish_function_exists', publish_function_exists,
      'publish_function_hardened', publish_function_hardened,
      'function_privileges_ok', function_privileges_ok,
      'request_table_private', request_table_private,
      'direct_client_insert_revoked', direct_client_insert_revoked
    ) as schema_section,
    jsonb_build_object(
      'image_contract_ok', image_contract_ok,
      'location_privacy_ok', location_privacy_ok,
      'adoption_role_check_ok', adoption_role_check_ok,
      'idempotency_ok', idempotency_ok
    ) as workflow_section,
    jsonb_build_object(
      'all_attached_pet_media_valid', all_attached_pet_media_valid,
      'all_post_image_counts_valid', all_post_image_counts_valid,
      'all_request_links_valid', all_request_links_valid
    ) as integrity_section,
    jsonb_build_object(
      'version', '015',
      'registered', migration_registered
    ) as migration_section
  from checks
)
select jsonb_build_object(
  'result', case
    when not exists (
      select 1
      from sections s,
      lateral jsonb_each_text(
        s.schema_section || s.workflow_section || s.integrity_section || s.migration_section
      ) check_value
      where check_value.key <> 'version'
        and check_value.value <> 'true'
    ) then 'PASS'
    else 'FAIL'
  end,
  'schema', schema_section,
  'workflow', workflow_section,
  'integrity', integrity_section,
  'migration', migration_section
) as result
from sections;
