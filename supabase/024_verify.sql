-- Huellas Bariloche - verificador de la migracion 024.
-- Ejecutar solamente despues de 024_community_messaging.sql.

with refs as (
  select
    to_regprocedure('public.get_my_community_posts_v1()') as my_posts_oid,
    to_regprocedure('public.update_my_community_post_v1(uuid,text,text,timestamp with time zone,timestamp with time zone)') as update_post_oid,
    to_regprocedure('public.set_my_community_post_state_v1(uuid,text)') as state_post_oid,
    to_regprocedure('public.get_my_conversation_inbox_v1()') as inbox_oid,
    to_regprocedure('public.get_my_conversation_v1(uuid)') as conversation_oid,
    to_regprocedure('public.submit_content_report_v1(text,uuid,text,text)') as report_oid
), checks as (
  select
    to_regclass('public.api_community_feed') is not null
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'community_posts' and column_name = 'resolved_at'
      )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'community_posts' and column_name = 'expires_at'
      )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'content_reports' and column_name = 'community_post_id'
      )
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'content_reports' and column_name = 'community_comment_id'
      ) as columns_and_view_exist,
    my_posts_oid is not null and update_post_oid is not null and state_post_oid is not null
      and inbox_oid is not null and conversation_oid is not null and report_oid is not null
      as functions_exist,
    lower(pg_get_viewdef('public.api_community_feed'::regclass, true)) like '%resolved_at is null%'
      and lower(pg_get_viewdef('public.api_community_feed'::regclass, true)) like '%expires_at%now()%'
      as inactive_community_is_filtered,
    coalesce(lower(pg_get_functiondef(update_post_oid)) like '%target_author <> actor%'
      and lower(pg_get_functiondef(state_post_oid)) like '%target_author <> actor%'
      and lower(pg_get_functiondef(state_post_oid)) like '%resolve%reopen%remove%', false)
      as community_management_is_owner_controlled,
    coalesce(lower(pg_get_functiondef(inbox_oid)) like '%member.user_id = actor%'
      and lower(pg_get_functiondef(conversation_oid)) like '%actor in (conversation.owner_id, conversation.participant_id)%'
      and lower(pg_get_functiondef(conversation_oid)) not like '%profile_contacts%', false)
      as conversations_are_private_without_phone,
    coalesce(lower(pg_get_functiondef(report_oid)) like '%community_post_id%'
      and lower(pg_get_functiondef(report_oid)) like '%community_comment_id%'
      and lower(pg_get_functiondef(report_oid)) like '%message_id%'
      and lower(pg_get_functiondef(report_oid)) like '%auth.uid()%'
      and lower(pg_get_functiondef(report_oid)) like '%admin_profile.role%', false)
      as reports_cover_community_and_messages,
    coalesce(not has_function_privilege('anon', inbox_oid, 'EXECUTE')
      and has_function_privilege('authenticated', inbox_oid, 'EXECUTE')
      and not has_function_privilege('anon', conversation_oid, 'EXECUTE')
      and has_function_privilege('authenticated', conversation_oid, 'EXECUTE')
      and not has_function_privilege('anon', report_oid, 'EXECUTE')
      and has_function_privilege('authenticated', report_oid, 'EXECUTE'), false)
      as private_grants_are_correct,
    exists (
      select 1 from private.app_migrations
      where version = '024' and name = 'community_messaging'
    ) as migration_registered
  from refs
), final as (
  select *,
    columns_and_view_exist
      and functions_exist
      and inactive_community_is_filtered
      and community_management_is_owner_controlled
      and conversations_are_private_without_phone
      and reports_cover_community_and_messages
      and private_grants_are_correct
      and migration_registered as passed
  from checks
)
select jsonb_build_object(
  'result', case when passed then 'PASS' else 'FAIL' end,
  'columns_and_view_exist', columns_and_view_exist,
  'functions_exist', functions_exist,
  'inactive_community_is_filtered', inactive_community_is_filtered,
  'community_management_is_owner_controlled', community_management_is_owner_controlled,
  'conversations_are_private_without_phone', conversations_are_private_without_phone,
  'reports_cover_community_and_messages', reports_cover_community_and_messages,
  'private_grants_are_correct', private_grants_are_correct,
  'migration_registered', migration_registered
)
from final;
