with
function_refs as (
  select
    to_regprocedure('public.create_pet_post_v2(uuid,text,text,text,text,text,text,text,text[],text,text,text,text,text[],text,double precision,double precision,text,boolean,timestamp with time zone,boolean,text)') as publish_oid,
    to_regprocedure('public.offer_transit_home_v1(uuid,text,text,boolean,boolean,boolean,text,boolean)') as offer_oid,
    to_regprocedure('public.review_transit_offer_v1(uuid,text)') as review_oid,
    to_regprocedure('public.set_transit_request_status_v1(uuid,text)') as status_oid,
    to_regprocedure('public.get_my_transit_dashboard_v1()') as dashboard_oid
),
checks as (
  select
    to_regclass('public.transit_campaign_details_018') is not null as transit_details_exists,
    to_regclass('public.transit_offer_details_018') is not null as offer_details_exists,
    to_regclass('public.api_transit_requests_v1') is not null as transit_view_exists,
    coalesce((
      select bool_and(column_name in ('distinctive_features','zone_name','event_at') and is_nullable = 'YES')
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'pet_posts'
        and column_name in ('distinctive_features','zone_name','event_at')
      having count(*) = 3
    ), false) as optional_columns_ready,
    coalesce((
      select bool_and(c.relrowsecurity)
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in ('transit_campaign_details_018','transit_offer_details_018')
      having count(*) = 2
    ), false) as extension_rls_enabled,
    (select publish_oid is not null from function_refs) as publish_function_exists,
    (select offer_oid is not null from function_refs) as offer_function_exists,
    (select review_oid is not null from function_refs) as review_function_exists,
    (select status_oid is not null from function_refs) as status_function_exists,
    (select dashboard_oid is not null from function_refs) as dashboard_function_exists,
    coalesce((
      select bool_and(p.prosecdef and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%')
      from pg_proc p
      where p.oid in (
        (select publish_oid from function_refs),
        (select offer_oid from function_refs),
        (select review_oid from function_refs),
        (select status_oid from function_refs),
        (select dashboard_oid from function_refs)
      )
      having count(*) = 5
    ), false) as functions_hardened,
    has_table_privilege('anon', 'public.api_transit_requests_v1', 'SELECT')
      and has_table_privilege('authenticated', 'public.api_transit_requests_v1', 'SELECT') as transit_view_public,
    not has_table_privilege('anon', 'public.transit_campaign_details_018', 'SELECT')
      and not has_table_privilege('authenticated', 'public.transit_campaign_details_018', 'SELECT')
      and not has_table_privilege('anon', 'public.transit_offer_details_018', 'SELECT')
      and not has_table_privilege('authenticated', 'public.transit_offer_details_018', 'SELECT') as extension_tables_private,
    coalesce((
      select bool_and(
        not has_function_privilege('anon', p.oid, 'EXECUTE')
        and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      )
      from pg_proc p
      where p.oid in (
        (select publish_oid from function_refs),
        (select offer_oid from function_refs),
        (select review_oid from function_refs),
        (select status_oid from function_refs),
        (select dashboard_oid from function_refs)
      )
      having count(*) = 5
    ), false) as function_privileges_ok,
    not exists (
      select 1
      from public.transit_campaign_details_018 detail
      join public.rescuer_campaigns campaign on campaign.id = detail.campaign_id
      join public.pet_posts post on post.id = detail.pet_post_id
      left join public.rescuer_profiles rescuer on rescuer.id = campaign.rescuer_profile_id
      where campaign.campaign_type <> 'transit'
         or post.post_type <> 'adoption'
         or post.rescuer_profile_id is distinct from campaign.rescuer_profile_id
         or rescuer.verification_status <> 'verified'
    ) as transit_links_valid,
    not exists (
      select 1
      from public.transit_offer_details_018 detail
      left join public.campaign_help_offers offer on offer.id = detail.offer_id
      left join public.transit_campaign_details_018 transit on transit.campaign_id = offer.campaign_id
      where offer.id is null or transit.campaign_id is null
    ) as transit_offers_valid,
    exists (
      select 1 from private.app_migrations
      where version = '018' and name = 'rescuer_posts_and_transit_homes'
    ) as migration_registered
)
select jsonb_pretty(
  jsonb_build_object(
    'result', case when
      transit_details_exists
      and offer_details_exists
      and transit_view_exists
      and optional_columns_ready
      and extension_rls_enabled
      and publish_function_exists
      and offer_function_exists
      and review_function_exists
      and status_function_exists
      and dashboard_function_exists
      and functions_hardened
      and transit_view_public
      and extension_tables_private
      and function_privileges_ok
      and transit_links_valid
      and transit_offers_valid
      and migration_registered
    then 'PASS' else 'FAIL' end,
    'schema', jsonb_build_object(
      'transit_details_exists', transit_details_exists,
      'offer_details_exists', offer_details_exists,
      'transit_view_exists', transit_view_exists,
      'optional_columns_ready', optional_columns_ready,
      'extension_rls_enabled', extension_rls_enabled
    ),
    'security', jsonb_build_object(
      'functions_hardened', functions_hardened,
      'transit_view_public', transit_view_public,
      'extension_tables_private', extension_tables_private,
      'function_privileges_ok', function_privileges_ok
    ),
    'workflow', jsonb_build_object(
      'publish_function_exists', publish_function_exists,
      'offer_function_exists', offer_function_exists,
      'review_function_exists', review_function_exists,
      'status_function_exists', status_function_exists,
      'dashboard_function_exists', dashboard_function_exists,
      'transit_links_valid', transit_links_valid,
      'transit_offers_valid', transit_offers_valid
    ),
    'migration', jsonb_build_object(
      'version', '018',
      'registered', migration_registered
    )
  )
) as verification
from checks;
