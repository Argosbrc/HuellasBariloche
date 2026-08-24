-- Huellas Bariloche - Verificacion de la migracion 017
-- Ejecutar solamente despues de 017_rescuer_approval_fix.sql.

with function_ref as (
  select to_regprocedure(
    'public.admin_review_rescuer_application(uuid,public.rescuer_application_status,text)'
  ) as oid
), checks as (
  select
    (select oid is not null from function_ref) as review_function_exists,
    coalesce((
      select function_ref.oid is not null
        and prosecdef
        and coalesce(proconfig, '{}'::text[])
          @> array['search_path=""']::text[]
      from function_ref
      join pg_catalog.pg_proc procedure_ref on procedure_ref.oid = function_ref.oid
    ), false) as review_function_hardened,
    has_function_privilege(
      'authenticated',
      'public.admin_review_rescuer_application(uuid,public.rescuer_application_status,text)',
      'EXECUTE'
    )
      and not has_function_privilege(
        'anon',
        'public.admin_review_rescuer_application(uuid,public.rescuer_application_status,text)',
        'EXECUTE'
      ) as function_privileges_ok,
    coalesce((
      select lower(pg_get_functiondef(function_ref.oid))
        like '%rescuer_application_approved%'
        and lower(pg_get_functiondef(function_ref.oid))
          like '%rescuer_application_rejected%'
        and lower(pg_get_functiondef(function_ref.oid))
          not like '%''rescuer_application.'' || decision%'
      from function_ref
    ), false) as notification_contract_ok,
    not exists (
      select 1
      from public.notifications notification
      where notification.event_type !~ '^[a-z][a-z0-9_]{0,63}$'
    ) as existing_notifications_valid,
    not exists (
      select 1
      from public.rescuer_applications application
      where application.status in ('approved', 'rejected')
        and (
          application.reviewed_by is null
          or application.reviewed_at is null
        )
    ) as reviewed_applications_consistent,
    exists (
      select 1
      from private.app_migrations migration
      where migration.version = '017'
    ) as migration_registered
), sections as (
  select
    jsonb_build_object(
      'review_function_exists', review_function_exists,
      'review_function_hardened', review_function_hardened,
      'function_privileges_ok', function_privileges_ok
    ) as schema_section,
    jsonb_build_object(
      'notification_contract_ok', notification_contract_ok,
      'existing_notifications_valid', existing_notifications_valid,
      'reviewed_applications_consistent', reviewed_applications_consistent
    ) as workflow_section,
    jsonb_build_object(
      'version', '017',
      'registered', migration_registered
    ) as migration_section
  from checks
)
select jsonb_build_object(
  'result', case
    when not exists (
      select 1
      from sections section_ref,
      lateral jsonb_each_text(
        section_ref.schema_section
          || section_ref.workflow_section
          || section_ref.migration_section
      ) check_value
      where check_value.key <> 'version'
        and check_value.value <> 'true'
    ) then 'PASS'
    else 'FAIL'
  end,
  'schema', schema_section,
  'workflow', workflow_section,
  'migration', migration_section
) as result
from sections;
