-- Huellas Bariloche - verificador de la migracion 022.
-- Ejecutar solamente despues de 022_pet_case_management.sql.

with function_refs as (
  select
    to_regprocedure('public.get_my_pet_post_editor_v1(uuid)') as editor_oid,
    to_regprocedure('public.update_my_pet_post_v1(uuid,text,text,text,text,text,text,text[],text,text,text,text,text[],text,double precision,double precision,text,boolean,timestamp with time zone)') as update_oid,
    to_regprocedure('public.resolve_my_pet_case_v1(uuid,text,text)') as resolve_oid,
    to_regprocedure('public.set_my_pet_sighting_alert_status_v1(uuid,text)') as alert_oid,
    to_regprocedure('public.review_adoption_application_v1(uuid,text)') as review_oid
), checks as (
  select
    exists (
      select 1 from private.app_migrations
      where version = '022' and name = 'pet_case_management'
    ) as migration_registered,
    editor_oid is not null
      and update_oid is not null
      and resolve_oid is not null
      and alert_oid is not null
      and review_oid is not null as functions_exist,
    editor_oid is not null
      and lower(pg_get_functiondef(editor_oid)) like '%post.owner_id = actor%'
      and lower(pg_get_functiondef(editor_oid)) like '%pet_locations_private%'
      and lower(pg_get_functiondef(editor_oid)) like '%post_status_history%' as editor_is_private_and_complete,
    update_oid is not null
      and lower(pg_get_functiondef(update_oid)) like '%target_owner <> actor%'
      and lower(pg_get_functiondef(update_oid)) like '%target_state not in%lost%sighted%found%available%'
      and lower(pg_get_functiondef(update_oid)) like '%cardinality(clean_photos) not between 1 and 4%'
      and lower(pg_get_functiondef(update_oid)) like '%pet_locations_private%'
      and lower(pg_get_functiondef(update_oid)) like '%profile_contacts%' as editor_validates_owner_media_and_contact,
    resolve_oid is not null
      and lower(pg_get_functiondef(resolve_oid)) like '%set_pet_post_state%'
      and lower(pg_get_functiondef(resolve_oid)) like '%set_transit_request_status_v1%'
      and lower(pg_get_functiondef(resolve_oid)) like '%adoption_requests%'
      and lower(pg_get_functiondef(resolve_oid)) like '%pet_sighting_alerts_020%' as resolution_closes_related_workflows,
    review_oid is not null
      and lower(pg_get_functiondef(review_oid)) like '%postulante seleccionado; adopcion aun no concretada%'
      and lower(pg_get_functiondef(review_oid)) not like '%set post_state = ''adopted''%'
      and lower(pg_get_functiondef(review_oid)) not like '%update public.pet_posts%' as adoption_selection_is_not_completion,
    alert_oid is not null
      and lower(pg_get_functiondef(alert_oid)) like '%alert.owner_user_id = actor%'
      and lower(pg_get_functiondef(alert_oid)) like '%contacted%resolved%dismissed%' as sighting_status_is_owner_controlled,
    has_function_privilege('authenticated', 'public.get_my_pet_post_editor_v1(uuid)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.update_my_pet_post_v1(uuid,text,text,text,text,text,text,text[],text,text,text,text,text[],text,double precision,double precision,text,boolean,timestamp with time zone)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.resolve_my_pet_case_v1(uuid,text,text)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.set_my_pet_sighting_alert_status_v1(uuid,text)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.get_my_pet_post_editor_v1(uuid)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.update_my_pet_post_v1(uuid,text,text,text,text,text,text,text[],text,text,text,text,text[],text,double precision,double precision,text,boolean,timestamp with time zone)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.resolve_my_pet_case_v1(uuid,text,text)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.set_my_pet_sighting_alert_status_v1(uuid,text)', 'EXECUTE') as grants_are_private,
    not exists (
      select 1 from public.pet_posts post
      where (post.post_state in ('lost','sighted','found','available') and post.status <> 'active')
         or (post.post_state = 'reunited' and post.status <> 'reunited')
         or (post.post_state = 'adopted' and post.status <> 'adopted')
         or (post.post_state = 'closed' and post.status <> 'closed')
         or (post.post_state = 'archived' and post.status <> 'archived')
    ) as states_remain_consistent
  from function_refs
), result as (
  select
    *,
    migration_registered
      and functions_exist
      and editor_is_private_and_complete
      and editor_validates_owner_media_and_contact
      and resolution_closes_related_workflows
      and adoption_selection_is_not_completion
      and sighting_status_is_owner_controlled
      and grants_are_private
      and states_remain_consistent as passed
  from checks
)
select jsonb_build_object(
  'result', case when passed then 'PASS' else 'FAIL' end,
  'migration_registered', migration_registered,
  'functions_exist', functions_exist,
  'editor_is_private_and_complete', editor_is_private_and_complete,
  'editor_validates_owner_media_and_contact', editor_validates_owner_media_and_contact,
  'resolution_closes_related_workflows', resolution_closes_related_workflows,
  'adoption_selection_is_not_completion', adoption_selection_is_not_completion,
  'sighting_status_is_owner_controlled', sighting_status_is_owner_controlled,
  'grants_are_private', grants_are_private,
  'states_remain_consistent', states_remain_consistent
) as verification
from result;
