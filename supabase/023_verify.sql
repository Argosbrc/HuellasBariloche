-- Huellas Bariloche - verificador de la migracion 023.
-- Ejecutar solamente despues de 023_medals_reunions_nearby_alerts.sql.

with function_refs as (
  select
    to_regprocedure('public.get_community_medal_board_v1()') as medal_board_oid,
    to_regprocedure('public.get_public_community_profile_v1(uuid)') as public_profile_oid,
    to_regprocedure('public.get_public_reunions_v1(integer)') as reunions_oid,
    to_regprocedure('public.get_my_nearby_alert_preferences_v1()') as nearby_get_oid,
    to_regprocedure('public.set_my_nearby_alert_preferences_v1(boolean,integer,double precision,double precision)') as nearby_set_oid,
    to_regprocedure('public.claim_nearby_lost_case_push_delivery_v1(uuid)') as nearby_push_oid,
    to_regprocedure('private.refresh_community_badges_023(uuid)') as badge_refresh_oid,
    to_regprocedure('private.capture_reunion_contributors_023(uuid)') as reunion_capture_oid,
    to_regprocedure('private.enqueue_nearby_lost_case_023(uuid)') as nearby_enqueue_oid
), checks as (
  select
    exists (
      select 1 from private.app_migrations
      where version = '023' and name = 'medals_reunions_nearby_alerts'
    ) as migration_registered,
    to_regclass('public.badge_rules_023') is not null
      and to_regclass('public.reunion_contributors_023') is not null
      and to_regclass('public.nearby_alert_settings_023') is not null
      and to_regclass('public.nearby_case_deliveries_023') is not null as tables_exist,
    medal_board_oid is not null
      and public_profile_oid is not null
      and reunions_oid is not null
      and nearby_get_oid is not null
      and nearby_set_oid is not null
      and nearby_push_oid is not null
      and badge_refresh_oid is not null
      and reunion_capture_oid is not null
      and nearby_enqueue_oid is not null as functions_exist,
    (select count(*) = 9 from public.badge_rules_023 where is_active) as nine_criteria_badges_exist,
    not exists (
      select 1
      from public.badge_rules_023 rule
      join public.badges badge on badge.id = rule.badge_id
      where badge.is_active or badge.points_required <> 0
    ) as criteria_badges_bypass_legacy_points_engine,
    not exists (
      select 1 from public.badge_rules_023
      where rule_key = 'confirmed_sightings' and threshold not in (1, 10)
    )
      and badge_refresh_oid is not null
      and lower(pg_get_functiondef(badge_refresh_oid)) like '%status::text = ''confirmed''%'
      and lower(pg_get_functiondef(badge_refresh_oid)) not like '%status::text = ''pending''%' as sightings_require_owner_confirmation,
    reunion_capture_oid is not null
      and lower(pg_get_functiondef(reunion_capture_oid)) like '%gracias a vos y a la comunidad%'
      and lower(pg_get_functiondef(reunion_capture_oid)) like '%reunion_contributors_023%'
      and lower(pg_get_functiondef(reunion_capture_oid)) like '%reporter_user_id%' as reunion_thanks_are_private_and_attributed,
    nearby_set_oid is not null
      and lower(pg_get_functiondef(nearby_set_oid)) like '%p_radius_km not in (3, 5)%'
      and lower(pg_get_functiondef(nearby_set_oid)) like '%location_history%false%'
      and lower(pg_get_functiondef(nearby_set_oid)) like '%exact_latitude%'
      and lower(pg_get_functiondef(nearby_set_oid)) like '%exact_longitude%' as nearby_alerts_are_opt_in_3_or_5_km,
    nearby_push_oid is not null
      and lower(pg_get_functiondef(nearby_push_oid)) like '%service_role%'
      and not has_function_privilege('anon', 'public.claim_nearby_lost_case_push_delivery_v1(uuid)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'public.claim_nearby_lost_case_push_delivery_v1(uuid)', 'EXECUTE')
      and has_function_privilege('service_role', 'public.claim_nearby_lost_case_push_delivery_v1(uuid)', 'EXECUTE') as push_claim_is_backend_only,
    has_function_privilege('anon', 'public.get_community_medal_board_v1()', 'EXECUTE')
      and has_function_privilege('anon', 'public.get_public_community_profile_v1(uuid)', 'EXECUTE')
      and has_function_privilege('anon', 'public.get_public_reunions_v1(integer)', 'EXECUTE')
      and not has_function_privilege('anon', 'public.get_my_nearby_alert_preferences_v1()', 'EXECUTE')
      and not has_function_privilege('anon', 'public.set_my_nearby_alert_preferences_v1(boolean,integer,double precision,double precision)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.get_my_nearby_alert_preferences_v1()', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.set_my_nearby_alert_preferences_v1(boolean,integer,double precision,double precision)', 'EXECUTE') as grants_match_public_and_private_surfaces,
    not has_table_privilege('anon', 'public.nearby_alert_settings_023', 'SELECT')
      and not has_table_privilege('authenticated', 'public.nearby_alert_settings_023', 'SELECT')
      and not has_table_privilege('anon', 'public.reunion_contributors_023', 'SELECT')
      and not has_table_privilege('authenticated', 'public.reunion_contributors_023', 'SELECT') as sensitive_tables_are_private,
    exists (
      select 1 from pg_trigger trigger_ref
      join pg_class relation_ref on relation_ref.oid = trigger_ref.tgrelid
      join pg_namespace namespace_ref on namespace_ref.oid = relation_ref.relnamespace
      where not trigger_ref.tgisinternal
        and namespace_ref.nspname = 'public'
        and relation_ref.relname = 'pet_locations_private'
        and trigger_ref.tgname = 'pet_location_nearby_alert_023'
    )
      and exists (
        select 1 from pg_trigger trigger_ref
        join pg_class relation_ref on relation_ref.oid = trigger_ref.tgrelid
        join pg_namespace namespace_ref on namespace_ref.oid = relation_ref.relnamespace
        where not trigger_ref.tgisinternal
          and namespace_ref.nspname = 'public'
          and relation_ref.relname = 'pet_posts'
          and trigger_ref.tgname = 'pet_post_resolution_023'
      ) as automation_triggers_exist,
    not exists (
      select 1 from public.nearby_alert_settings_023 setting
      where setting.enabled
        and (setting.exact_latitude is null or setting.exact_longitude is null or setting.radius_km not in (3, 5))
    ) as existing_nearby_settings_are_consistent
  from function_refs
), result as (
  select
    *,
    migration_registered
      and tables_exist
      and functions_exist
      and nine_criteria_badges_exist
      and criteria_badges_bypass_legacy_points_engine
      and sightings_require_owner_confirmation
      and reunion_thanks_are_private_and_attributed
      and nearby_alerts_are_opt_in_3_or_5_km
      and push_claim_is_backend_only
      and grants_match_public_and_private_surfaces
      and sensitive_tables_are_private
      and automation_triggers_exist
      and existing_nearby_settings_are_consistent as passed
  from checks
)
select jsonb_build_object(
  'result', case when passed then 'PASS' else 'FAIL' end,
  'migration_registered', migration_registered,
  'tables_exist', tables_exist,
  'functions_exist', functions_exist,
  'nine_criteria_badges_exist', nine_criteria_badges_exist,
  'criteria_badges_bypass_legacy_points_engine', criteria_badges_bypass_legacy_points_engine,
  'sightings_require_owner_confirmation', sightings_require_owner_confirmation,
  'reunion_thanks_are_private_and_attributed', reunion_thanks_are_private_and_attributed,
  'nearby_alerts_are_opt_in_3_or_5_km', nearby_alerts_are_opt_in_3_or_5_km,
  'push_claim_is_backend_only', push_claim_is_backend_only,
  'grants_match_public_and_private_surfaces', grants_match_public_and_private_surfaces,
  'sensitive_tables_are_private', sensitive_tables_are_private,
  'automation_triggers_exist', automation_triggers_exist,
  'existing_nearby_settings_are_consistent', existing_nearby_settings_are_consistent
) as verification
from result;
