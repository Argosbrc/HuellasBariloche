-- Huellas Bariloche - Verificacion posterior a la migracion 016.
-- Solo lectura. El resultado esperado es un unico JSON con "result": "PASS".

with checks as (
  select
    to_regclass('public.service_details_016') is not null as service_details_exists,
    to_regclass('public.rescuer_directory_profiles_016') is not null as rescuer_details_exists,
    to_regclass('public.api_useful_data_directory_v1') is not null as useful_view_exists,
    to_regclass('public.api_rescuer_directory_v1') is not null as rescuer_view_exists,
    to_regprocedure('public.admin_upsert_service_details_v1(uuid,boolean,boolean,text[],text[],boolean,text[],text,text,text)') is not null as service_details_function_exists,
    to_regprocedure('public.admin_upsert_service_category_v1(uuid,text,text,text,integer,boolean)') is not null as category_function_exists,
    to_regprocedure('public.update_my_rescuer_directory_profile_v1(text,text,text[],text,text,text,text,text)') is not null as rescuer_update_function_exists,
    has_table_privilege('anon', 'public.api_useful_data_directory_v1', 'SELECT')
      and has_table_privilege('authenticated', 'public.api_useful_data_directory_v1', 'SELECT') as useful_view_public,
    has_table_privilege('anon', 'public.api_rescuer_directory_v1', 'SELECT')
      and has_table_privilege('authenticated', 'public.api_rescuer_directory_v1', 'SELECT') as rescuer_view_public,
    not has_table_privilege('anon', 'public.service_details_016', 'SELECT, INSERT, UPDATE, DELETE')
      and not has_table_privilege('anon', 'public.rescuer_directory_profiles_016', 'SELECT, INSERT, UPDATE, DELETE') as extension_tables_not_anonymous,
    (select relrowsecurity from pg_class where oid = 'public.service_details_016'::regclass)
      and (select relrowsecurity from pg_class where oid = 'public.rescuer_directory_profiles_016'::regclass) as extension_rls_enabled,
    not has_function_privilege(
      'anon',
      'public.admin_upsert_service_details_v1(uuid,boolean,boolean,text[],text[],boolean,text[],text,text,text)',
      'EXECUTE'
    ) and has_function_privilege(
      'authenticated',
      'public.admin_upsert_service_details_v1(uuid,boolean,boolean,text[],text[],boolean,text[],text,text,text)',
      'EXECUTE'
    ) as admin_function_privileges_ok,
    not has_function_privilege(
      'anon',
      'public.update_my_rescuer_directory_profile_v1(text,text,text[],text,text,text,text,text)',
      'EXECUTE'
    ) and has_function_privilege(
      'authenticated',
      'public.update_my_rescuer_directory_profile_v1(text,text,text[],text,text,text,text,text)',
      'EXECUTE'
    ) as rescuer_function_privileges_ok,
    exists (
      select 1
      from pg_catalog.pg_proc function_definition
      where function_definition.oid = 'public.admin_upsert_service_details_v1(uuid,boolean,boolean,text[],text[],boolean,text[],text,text,text)'::regprocedure
        and function_definition.prosecdef
        and function_definition.provolatile = 'v'
        and coalesce(function_definition.proconfig, '{}'::text[]) @> array['search_path=""']
    )
      and lower(pg_get_functiondef('public.admin_upsert_service_details_v1(uuid,boolean,boolean,text[],text[],boolean,text[],text,text,text)'::regprocedure)) like '%private.is_admin()%'
      as service_function_hardened,
    exists (
      select 1
      from pg_catalog.pg_proc function_definition
      where function_definition.oid = 'public.admin_upsert_service_category_v1(uuid,text,text,text,integer,boolean)'::regprocedure
        and function_definition.prosecdef
        and function_definition.provolatile = 'v'
        and coalesce(function_definition.proconfig, '{}'::text[]) @> array['search_path=""']
    )
      and lower(pg_get_functiondef('public.admin_upsert_service_category_v1(uuid,text,text,text,integer,boolean)'::regprocedure)) like '%private.is_admin()%'
      and lower(pg_get_functiondef('public.admin_upsert_service_category_v1(uuid,text,text,text,integer,boolean)'::regprocedure)) like '%created_by%'
      as category_function_hardened,
    exists (
      select 1
      from pg_catalog.pg_proc function_definition
      where function_definition.oid = 'public.update_my_rescuer_directory_profile_v1(text,text,text[],text,text,text,text,text)'::regprocedure
        and function_definition.prosecdef
        and function_definition.provolatile = 'v'
        and coalesce(function_definition.proconfig, '{}'::text[]) @> array['search_path=""']
    )
      and lower(pg_get_functiondef('public.update_my_rescuer_directory_profile_v1(text,text,text[],text,text,text,text,text)'::regprocedure)) like '%verification_status%'
      and lower(pg_get_functiondef('public.update_my_rescuer_directory_profile_v1(text,text,text[],text,text,text,text,text)'::regprocedure)) like '%private.is_active_user()%'
      as rescuer_function_hardened,
    (
      select count(*) >= 3
      from public.service_categories
      where slug in ('veterinarias', 'pet-shops', 'alimentos')
        and active
    ) as core_categories_ready,
    not exists (
      select 1
      from public.api_rescuer_directory_v1 public_rescuer
      where not exists (
        select 1
        from public.rescuer_profiles rescuer
        where rescuer.id = public_rescuer.id
          and rescuer.verification_status::text = 'verified'
      )
    ) as only_verified_rescuers_public,
    exists (
      select 1 from private.app_migrations migration where migration.version = '016'
    ) as migration_registered
), sections as (
  select
    jsonb_build_object(
      'service_details_exists', service_details_exists,
      'rescuer_details_exists', rescuer_details_exists,
      'useful_view_exists', useful_view_exists,
      'rescuer_view_exists', rescuer_view_exists,
      'extension_rls_enabled', extension_rls_enabled
    ) as schema_section,
    jsonb_build_object(
      'service_details_function_exists', service_details_function_exists,
      'category_function_exists', category_function_exists,
      'rescuer_update_function_exists', rescuer_update_function_exists,
      'admin_function_privileges_ok', admin_function_privileges_ok,
      'rescuer_function_privileges_ok', rescuer_function_privileges_ok,
      'service_function_hardened', service_function_hardened,
      'category_function_hardened', category_function_hardened,
      'rescuer_function_hardened', rescuer_function_hardened
    ) as security_section,
    jsonb_build_object(
      'useful_view_public', useful_view_public,
      'rescuer_view_public', rescuer_view_public,
      'extension_tables_not_anonymous', extension_tables_not_anonymous,
      'core_categories_ready', core_categories_ready,
      'only_verified_rescuers_public', only_verified_rescuers_public
    ) as workflow_section,
    jsonb_build_object(
      'version', '016',
      'registered', migration_registered
    ) as migration_section
  from checks
)
select jsonb_build_object(
  'result', case
    when not exists (
      select 1
      from sections section_value,
      lateral jsonb_each_text(
        section_value.schema_section
        || section_value.security_section
        || section_value.workflow_section
        || section_value.migration_section
      ) check_value
      where check_value.key <> 'version'
        and check_value.value <> 'true'
    ) then 'PASS'
    else 'FAIL'
  end,
  'schema', schema_section,
  'security', security_section,
  'workflow', workflow_section,
  'migration', migration_section
) as result
from sections;
