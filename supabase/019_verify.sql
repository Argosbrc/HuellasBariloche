-- Huellas Bariloche - verificador de la migracion 019.
-- Ejecutar solamente despues de 019_adoption_applications_map_contacts.sql.

with
function_refs as (
  select
    to_regprocedure('public.submit_adoption_application_v1(uuid,text,text,text,text,text,text,text,text)') as submit_oid,
    to_regprocedure('public.review_adoption_application_v1(uuid,text)') as review_oid,
    to_regprocedure('public.get_my_adoption_dashboard_v1()') as dashboard_oid,
    to_regprocedure('public.get_public_pet_case_contact_v1(uuid)') as contact_oid
),
checks as (
  select
    to_regclass('public.adoption_request_details_019') is not null as details_table_exists,
    coalesce((
      select relation.relrowsecurity
      from pg_class relation
      where relation.oid = to_regclass('public.adoption_request_details_019')
    ), false) as details_rls_enabled,
    not has_table_privilege('anon', 'public.adoption_request_details_019', 'SELECT')
      and not has_table_privilege('authenticated', 'public.adoption_request_details_019', 'SELECT') as details_table_private,
    (select submit_oid is not null from function_refs) as submit_function_exists,
    (select review_oid is not null from function_refs) as review_function_exists,
    (select dashboard_oid is not null from function_refs) as dashboard_function_exists,
    (select contact_oid is not null from function_refs) as contact_function_exists,
    coalesce((
      select bool_and(function_ref.prosecdef and coalesce(array_to_string(function_ref.proconfig, ','), '') like '%search_path=%')
      from pg_proc function_ref
      where function_ref.oid in (
        (select submit_oid from function_refs),
        (select review_oid from function_refs),
        (select dashboard_oid from function_refs),
        (select contact_oid from function_refs)
      )
      having count(*) = 4
    ), false) as functions_hardened,
    coalesce((
      select bool_and(
        not has_function_privilege('anon', function_ref.oid, 'EXECUTE')
        and has_function_privilege('authenticated', function_ref.oid, 'EXECUTE')
      )
      from pg_proc function_ref
      where function_ref.oid in (
        (select submit_oid from function_refs),
        (select review_oid from function_refs),
        (select dashboard_oid from function_refs)
      )
      having count(*) = 3
    ), false) as private_function_privileges_ok,
    coalesce((
      select has_function_privilege('anon', contact_oid, 'EXECUTE')
        and has_function_privilege('authenticated', contact_oid, 'EXECUTE')
      from function_refs
    ), false) as contact_function_public,
    coalesce((
      select lower(pg_get_functiondef(contact_oid)) like '%post.post_type::text <> ''adoption''%'
        and lower(pg_get_functiondef(contact_oid)) like '%post.show_whatsapp%'
        and lower(pg_get_functiondef(contact_oid)) like '%post.moderation_status::text = ''visible''%'
      from function_refs
    ), false) as contact_consent_hardened,
    coalesce((
      select lower(pg_get_functiondef(submit_oid)) like '%adoption_request_created%'
        and lower(pg_get_functiondef(submit_oid)) like '%/panel#solicitudes-adopcion%'
      from function_refs
    ), false) as adoption_notification_ready,
    not exists (
      select 1
      from public.adoption_request_details_019 detail
      left join public.adoption_requests request on request.id = detail.adoption_request_id
      left join public.pet_posts post on post.id = request.pet_post_id
      where request.id is null or post.post_type::text <> 'adoption'
    ) as details_links_valid,
    exists (
      select 1 from private.app_migrations
      where version = '019' and name = 'adoption_applications_and_map_contacts'
    ) as migration_registered
)
select jsonb_pretty(
  jsonb_build_object(
    'result', case when
      details_table_exists
      and details_rls_enabled
      and details_table_private
      and submit_function_exists
      and review_function_exists
      and dashboard_function_exists
      and contact_function_exists
      and functions_hardened
      and private_function_privileges_ok
      and contact_function_public
      and contact_consent_hardened
      and adoption_notification_ready
      and details_links_valid
      and migration_registered
    then 'PASS' else 'FAIL' end,
    'schema', jsonb_build_object(
      'details_table_exists', details_table_exists,
      'details_rls_enabled', details_rls_enabled,
      'details_table_private', details_table_private
    ),
    'security', jsonb_build_object(
      'functions_hardened', functions_hardened,
      'private_function_privileges_ok', private_function_privileges_ok,
      'contact_function_public', contact_function_public,
      'contact_consent_hardened', contact_consent_hardened
    ),
    'workflow', jsonb_build_object(
      'submit_function_exists', submit_function_exists,
      'review_function_exists', review_function_exists,
      'dashboard_function_exists', dashboard_function_exists,
      'contact_function_exists', contact_function_exists,
      'adoption_notification_ready', adoption_notification_ready,
      'details_links_valid', details_links_valid
    ),
    'migration', jsonb_build_object(
      'version', '019',
      'registered', migration_registered
    )
  )
) as verification
from checks;
