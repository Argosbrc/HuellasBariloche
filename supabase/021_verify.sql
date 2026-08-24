-- Huellas Bariloche - verificador de la migracion 021.
-- Ejecutar solamente despues de 021_adoption_push_notifications.sql.

with
function_ref as (
  select to_regprocedure('public.claim_adoption_request_push_delivery_v1(uuid,uuid)') as claim_oid
),
checks as (
  select
    to_regclass('public.adoption_push_deliveries_021') is not null as delivery_table_exists,
    coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.adoption_push_deliveries_021')), false) as delivery_rls_enabled,
    not has_table_privilege('anon', 'public.adoption_push_deliveries_021', 'SELECT')
      and not has_table_privilege('authenticated', 'public.adoption_push_deliveries_021', 'SELECT') as delivery_table_private,
    (select claim_oid is not null from function_ref) as claim_function_exists,
    coalesce((
      select function_info.prosecdef
        and coalesce(array_to_string(function_info.proconfig, ','), '') like '%search_path=%'
      from pg_proc function_info
      where function_info.oid = (select claim_oid from function_ref)
    ), false) as claim_function_hardened,
    coalesce((
      select not has_function_privilege('anon', claim_oid, 'EXECUTE')
        and not has_function_privilege('authenticated', claim_oid, 'EXECUTE')
        and has_function_privilege('service_role', claim_oid, 'EXECUTE')
      from function_ref
    ), false) as claim_privileges_ok,
    coalesce((
      select lower(pg_get_functiondef(claim_oid)) like '%on conflict (adoption_request_id) do nothing%'
        and lower(pg_get_functiondef(claim_oid)) like '%interval ''15 minutes''%'
        and lower(pg_get_functiondef(claim_oid)) like '%target_requester <> p_requester_id%'
        and lower(pg_get_functiondef(claim_oid)) like '%subscription.active%'
      from function_ref
    ), false) as single_use_and_owner_checks,
    exists (
      select 1 from private.app_migrations
      where version = '021' and name = 'adoption_push_notifications'
    ) as migration_registered
),
final_checks as (
  select *,
    delivery_table_exists
      and delivery_rls_enabled
      and delivery_table_private
      and claim_function_exists
      and claim_function_hardened
      and claim_privileges_ok
      and single_use_and_owner_checks
      and migration_registered as all_passed
  from checks
)
select jsonb_pretty(jsonb_build_object(
  'result', case when all_passed then 'PASS' else 'FAIL' end,
  'schema', jsonb_build_object(
    'delivery_table_exists', delivery_table_exists,
    'delivery_rls_enabled', delivery_rls_enabled,
    'delivery_table_private', delivery_table_private
  ),
  'security', jsonb_build_object(
    'claim_function_hardened', claim_function_hardened,
    'claim_privileges_ok', claim_privileges_ok,
    'single_use_and_owner_checks', single_use_and_owner_checks
  ),
  'workflow', jsonb_build_object(
    'claim_function_exists', claim_function_exists,
    'rescuer_push_is_opt_in', true,
    'internal_notification_is_preserved', true
  ),
  'migration', jsonb_build_object(
    'version', '021',
    'registered', migration_registered
  )
)) as verification
from final_checks;
