-- Huellas Bariloche - verificador de la migracion 020.
-- Ejecutar solamente despues de 020_sighting_alerts_web_push.sql.

with
function_refs as (
  select
    to_regprocedure('public.submit_pet_sighting_alert_v1(uuid,text,text,double precision,double precision,text,text,text,text)') as submit_oid,
    to_regprocedure('public.claim_pet_sighting_push_delivery_v1(uuid,uuid)') as claim_oid,
    to_regprocedure('public.upsert_my_web_push_subscription_v1(text,text,text,text)') as subscribe_oid,
    to_regprocedure('public.deactivate_my_web_push_subscription_v1(text)') as unsubscribe_oid,
    to_regprocedure('public.get_my_pet_sighting_alerts_v1()') as dashboard_oid
),
checks as (
  select
    to_regclass('public.pet_sighting_alerts_020') is not null as alerts_table_exists,
    to_regclass('public.web_push_subscriptions_020') is not null as subscriptions_table_exists,
    coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.pet_sighting_alerts_020')), false) as alerts_rls_enabled,
    coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.web_push_subscriptions_020')), false) as subscriptions_rls_enabled,
    not has_table_privilege('anon', 'public.pet_sighting_alerts_020', 'SELECT')
      and not has_table_privilege('authenticated', 'public.pet_sighting_alerts_020', 'SELECT') as alerts_private,
    not has_table_privilege('anon', 'public.web_push_subscriptions_020', 'SELECT')
      and not has_table_privilege('authenticated', 'public.web_push_subscriptions_020', 'SELECT') as subscriptions_private,
    (select submit_oid is not null from function_refs) as submit_function_exists,
    (select claim_oid is not null from function_refs) as claim_function_exists,
    (select subscribe_oid is not null from function_refs) as subscribe_function_exists,
    (select unsubscribe_oid is not null from function_refs) as unsubscribe_function_exists,
    (select dashboard_oid is not null from function_refs) as dashboard_function_exists,
    coalesce((
      select bool_and(function_ref.prosecdef and coalesce(array_to_string(function_ref.proconfig, ','), '') like '%search_path=%')
      from pg_proc function_ref
      where function_ref.oid in (
        (select submit_oid from function_refs),
        (select claim_oid from function_refs),
        (select subscribe_oid from function_refs),
        (select unsubscribe_oid from function_refs),
        (select dashboard_oid from function_refs)
      )
      having count(*) = 5
    ), false) as functions_hardened,
    coalesce((
      select has_function_privilege('anon', submit_oid, 'EXECUTE')
        and has_function_privilege('authenticated', submit_oid, 'EXECUTE')
      from function_refs
    ), false) as public_submission_privileges_ok,
    coalesce((
      select not has_function_privilege('anon', subscribe_oid, 'EXECUTE')
        and has_function_privilege('authenticated', subscribe_oid, 'EXECUTE')
        and not has_function_privilege('anon', unsubscribe_oid, 'EXECUTE')
        and has_function_privilege('authenticated', unsubscribe_oid, 'EXECUTE')
        and not has_function_privilege('anon', claim_oid, 'EXECUTE')
        and not has_function_privilege('authenticated', claim_oid, 'EXECUTE')
        and has_function_privilege('service_role', claim_oid, 'EXECUTE')
        and not has_function_privilege('anon', dashboard_oid, 'EXECUTE')
        and has_function_privilege('authenticated', dashboard_oid, 'EXECUTE')
      from function_refs
    ), false) as private_function_privileges_ok,
    coalesce((
      select lower(pg_get_functiondef(submit_oid)) like '%post.post_type::text = ''lost''%'
        and lower(pg_get_functiondef(submit_oid)) like '%lost_pet_sighting%'
        and lower(pg_get_functiondef(submit_oid)) like '%lost_pet_sheltered%'
        and lower(pg_get_functiondef(submit_oid)) like '%/panel#avisos-casos%'
      from function_refs
    ), false) as alert_workflow_ready,
    coalesce((
      select lower(pg_get_functiondef(claim_oid)) like '%dispatch_claimed_at is null%'
        and lower(pg_get_functiondef(claim_oid)) like '%interval ''10 minutes''%'
      from function_refs
    ), false) as push_claim_single_use,
    coalesce((
      select lower(pg_get_functiondef(dashboard_oid)) like '%sighting.owner_user_id = (select auth.uid())%'
        and lower(pg_get_functiondef(dashboard_oid)) like '%contact_phone%'
        and lower(pg_get_functiondef(dashboard_oid)) like '%contact_social%'
      from function_refs
    ), false) as dashboard_owner_hardened,
    exists (
      select 1 from private.app_migrations
      where version = '020' and name = 'pet_sighting_alerts_and_web_push'
    ) as migration_registered
),
final_checks as (
  select *,
    alerts_table_exists
      and subscriptions_table_exists
      and alerts_rls_enabled
      and subscriptions_rls_enabled
      and alerts_private
      and subscriptions_private
      and submit_function_exists
      and claim_function_exists
      and subscribe_function_exists
      and unsubscribe_function_exists
      and dashboard_function_exists
      and functions_hardened
      and public_submission_privileges_ok
      and private_function_privileges_ok
      and alert_workflow_ready
      and push_claim_single_use
      and dashboard_owner_hardened
      and migration_registered as all_passed
  from checks
)
select jsonb_pretty(jsonb_build_object(
  'result', case when all_passed then 'PASS' else 'FAIL' end,
  'schema', jsonb_build_object(
    'alerts_table_exists', alerts_table_exists,
    'subscriptions_table_exists', subscriptions_table_exists,
    'alerts_rls_enabled', alerts_rls_enabled,
    'subscriptions_rls_enabled', subscriptions_rls_enabled,
    'alerts_private', alerts_private,
    'subscriptions_private', subscriptions_private
  ),
  'security', jsonb_build_object(
    'functions_hardened', functions_hardened,
    'public_submission_privileges_ok', public_submission_privileges_ok,
    'private_function_privileges_ok', private_function_privileges_ok,
    'push_claim_single_use', push_claim_single_use,
    'dashboard_owner_hardened', dashboard_owner_hardened
  ),
  'workflow', jsonb_build_object(
    'submit_function_exists', submit_function_exists,
    'claim_function_exists', claim_function_exists,
    'subscribe_function_exists', subscribe_function_exists,
    'unsubscribe_function_exists', unsubscribe_function_exists,
    'dashboard_function_exists', dashboard_function_exists,
    'alert_workflow_ready', alert_workflow_ready
  ),
  'migration', jsonb_build_object(
    'version', '020',
    'registered', migration_registered
  )
)) as verification
from final_checks;
