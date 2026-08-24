-- Huellas Bariloche - Migracion 024
-- Comunidad interactiva, bandeja de conversaciones y denuncias privadas.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '0';
set local check_function_bodies = on;

do $preflight$
begin
  if not exists (
    select 1 from private.app_migrations
    where version = '023' and name = 'medals_reunions_nearby_alerts'
  ) then
    raise exception 'La migracion 023 debe estar instalada y verificada antes de ejecutar 024.';
  end if;

  if exists (select 1 from private.app_migrations where version = '024') then
    raise exception 'La migracion 024 ya figura como instalada. No vuelva a ejecutarla.';
  end if;

  if to_regclass('public.community_posts') is null
     or to_regclass('public.community_comments') is null
     or to_regclass('public.community_likes') is null
     or to_regclass('public.community_media') is null
     or to_regclass('public.conversations') is null
     or to_regclass('public.conversation_members') is null
     or to_regclass('public.messages') is null
     or to_regclass('public.user_blocks') is null
     or to_regclass('public.content_reports') is null
     or to_regclass('public.notifications') is null
     or to_regclass('public.audit_log') is null then
    raise exception 'Faltan tablas requeridas para Comunidad o conversaciones.';
  end if;

  if to_regprocedure('public.start_conversation(uuid)') is null
     or to_regprocedure('public.send_conversation_message(uuid,text,uuid)') is null
     or to_regprocedure('public.mark_conversation_read(uuid)') is null
     or to_regprocedure('public.set_conversation_archived(uuid,boolean)') is null
     or to_regprocedure('public.set_user_block(uuid,boolean)') is null
     or to_regprocedure('public.add_community_comment(uuid,text)') is null
     or to_regprocedure('public.set_community_like(uuid,boolean)') is null
     or to_regprocedure('public.record_community_share(uuid)') is null then
    raise exception 'Faltan funciones seguras de las migraciones 006 u 008.';
  end if;
end
$preflight$;

alter table public.community_posts
  add column resolved_at timestamptz,
  add column expires_at timestamptz,
  add constraint community_posts_expiry_after_creation_024
    check (expires_at is null or expires_at > created_at);

alter table public.content_reports
  add column community_post_id uuid references public.community_posts(id) on delete set null,
  add column community_comment_id uuid references public.community_comments(id) on delete set null;

create index community_posts_active_expiry_024
  on public.community_posts (moderation_status, resolved_at, expires_at, created_at desc);
create index content_reports_community_post_024
  on public.content_reports (community_post_id, status, created_at desc)
  where community_post_id is not null;
create index content_reports_community_comment_024
  on public.content_reports (community_comment_id, status, created_at desc)
  where community_comment_id is not null;

update public.community_posts post
set expires_at = case
  when post.post_type::text = 'event' and post.event_at is not null
    then greatest(post.event_at + interval '1 day', post.created_at + interval '1 day')
  when post.post_type::text in ('question', 'recommendation')
    then post.created_at + interval '30 days'
  else post.created_at + interval '90 days'
end
where post.expires_at is null;

create function private.set_community_expiry_024()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.expires_at is null then
    new.expires_at := case
      when new.post_type::text = 'event' and new.event_at is not null
        then greatest(new.event_at + interval '1 day', now() + interval '1 day')
      when new.post_type::text in ('question', 'recommendation')
        then now() + interval '30 days'
      else now() + interval '90 days'
    end;
  end if;

  if new.expires_at <= new.created_at then
    raise exception 'La vigencia debe finalizar despues de la publicacion.';
  end if;

  if new.expires_at > now() + interval '1 year' then
    raise exception 'La vigencia no puede superar un ano.';
  end if;

  return new;
end
$function$;

create trigger community_posts_expiry_024
before insert or update of post_type, event_at, expires_at
on public.community_posts
for each row execute function private.set_community_expiry_024();

create or replace view public.api_community_feed
with (security_invoker = true, security_barrier = true)
as
select
  post.id,
  post.author_id,
  author.display_name as author_display_name,
  author.avatar_url as author_avatar_url,
  post.city_id,
  city.slug as city_slug,
  city.name as city_name,
  post.post_type::text as post_type,
  post.body,
  post.place_name,
  post.event_at,
  post.created_at,
  post.updated_at,
  (
    select media.storage_path
    from public.community_media media
    where media.post_id = post.id
    order by media.position, media.id
    limit 1
  ) as cover_image_path,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', media.id,
        'storage_path', media.storage_path,
        'mime_type', media.mime_type,
        'width', media.width,
        'height', media.height,
        'position', media.position,
        'alt_text', media.alt_text
      ) order by media.position, media.id
    )
    from public.community_media media
    where media.post_id = post.id
  ), '[]'::jsonb) as media,
  (
    select count(*)
    from public.community_comments comment_row
    where comment_row.post_id = post.id
      and comment_row.moderation_status::text = 'visible'
  ) as comments_count,
  (
    select count(*) from public.community_likes like_row
    where like_row.post_id = post.id
  ) as likes_count,
  (
    select count(*) from public.community_shares share_row
    where share_row.post_id = post.id
  ) as shares_count,
  exists (
    select 1 from public.community_likes my_like
    where my_like.post_id = post.id
      and my_like.user_id = auth.uid()
  ) as liked_by_me,
  post.resolved_at,
  post.expires_at
from public.community_posts post
join public.profiles author on author.id = post.author_id
join public.cities city on city.id = post.city_id
where post.moderation_status::text = 'visible'
  and post.resolved_at is null
  and (post.expires_at is null or post.expires_at > now())
  and city.is_active;

comment on view public.api_community_feed is
  'Feed comunitario activo: excluye publicaciones resueltas o vencidas y conserva contadores seguros.';

revoke all on table public.api_community_feed from public, anon, authenticated;
grant select on table public.api_community_feed to anon, authenticated, service_role;

create function public.get_my_community_posts_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  result jsonb;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Se requiere una cuenta activa.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(item.payload order by item.created_at desc), '[]'::jsonb)
  into result
  from (
    select
      post.created_at,
      jsonb_build_object(
        'id', post.id,
        'post_type', post.post_type::text,
        'body', post.body,
        'place_name', post.place_name,
        'event_at', post.event_at,
        'created_at', post.created_at,
        'updated_at', post.updated_at,
        'moderation_status', post.moderation_status::text,
        'resolved_at', post.resolved_at,
        'expires_at', post.expires_at,
        'is_expired', post.expires_at is not null and post.expires_at <= now(),
        'cover_image_path', (
          select media.storage_path
          from public.community_media media
          where media.post_id = post.id
          order by media.position, media.id
          limit 1
        ),
        'comments_count', (
          select count(*) from public.community_comments comment_row
          where comment_row.post_id = post.id
            and comment_row.moderation_status::text = 'visible'
        ),
        'likes_count', (
          select count(*) from public.community_likes like_row
          where like_row.post_id = post.id
        )
      ) as payload
    from public.community_posts post
    where post.author_id = actor
  ) item;

  return result;
end
$function$;

create function public.update_my_community_post_v1(
  p_post_id uuid,
  p_body text,
  p_place_name text default null,
  p_event_at timestamptz default null,
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  clean_body text := btrim(coalesce(p_body, ''));
  target_author uuid;
  target_status text;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Se requiere una cuenta activa.' using errcode = '42501';
  end if;

  if char_length(clean_body) not between 3 and 3000 then
    raise exception 'La publicacion debe tener entre 3 y 3000 caracteres.';
  end if;

  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'La vigencia debe finalizar en el futuro.';
  end if;

  select post.author_id, post.moderation_status::text
  into target_author, target_status
  from public.community_posts post
  where post.id = p_post_id
  for update;

  if not found or target_author <> actor then
    raise exception 'La publicacion no existe o no le pertenece.' using errcode = '42501';
  end if;

  if target_status = 'removed' then
    raise exception 'Una publicacion eliminada no puede editarse.';
  end if;

  update public.community_posts
  set body = clean_body,
      place_name = nullif(btrim(coalesce(p_place_name, '')), ''),
      event_at = p_event_at,
      expires_at = p_expires_at
  where id = p_post_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'community.post_updated_v1', 'community_post', p_post_id::text, '{}'::jsonb);
end
$function$;

create function public.set_my_community_post_state_v1(
  p_post_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  clean_action text := lower(btrim(coalesce(p_action, '')));
  target_author uuid;
  target_status text;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Se requiere una cuenta activa.' using errcode = '42501';
  end if;

  if clean_action not in ('resolve', 'reopen', 'remove') then
    raise exception 'La accion solicitada no es valida.';
  end if;

  select post.author_id, post.moderation_status::text
  into target_author, target_status
  from public.community_posts post
  where post.id = p_post_id
  for update;

  if not found or target_author <> actor then
    raise exception 'La publicacion no existe o no le pertenece.' using errcode = '42501';
  end if;

  if clean_action = 'remove' then
    perform public.remove_community_post(p_post_id, 'El autor retiro la publicacion desde su panel');
    return;
  end if;

  if target_status = 'removed' then
    raise exception 'Una publicacion eliminada no puede reabrirse.';
  end if;

  update public.community_posts
  set resolved_at = case when clean_action = 'resolve' then now() else null end,
      expires_at = case
        when clean_action = 'reopen' and expires_at <= now() then null
        else expires_at
      end
  where id = p_post_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    case when clean_action = 'resolve' then 'community.post_resolved' else 'community.post_reopened' end,
    'community_post',
    p_post_id::text,
    '{}'::jsonb
  );
end
$function$;

create function public.get_my_conversation_inbox_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  result jsonb;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Se requiere una cuenta activa.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(item.payload order by item.sort_at desc), '[]'::jsonb)
  into result
  from (
    select
      coalesce(conversation.last_message_at, conversation.created_at) as sort_at,
      jsonb_build_object(
        'id', conversation.id,
        'pet_post_id', conversation.pet_post_id,
        'pet_name', post.name,
        'pet_state', post.post_state::text,
        'pet_photo_url', post.photo_paths[1],
        'other_user_id', other_profile.id,
        'other_display_name', other_profile.display_name,
        'other_avatar_url', other_profile.avatar_url,
        'last_message_at', conversation.last_message_at,
        'last_message', last_message.body,
        'last_sender_id', last_message.sender_id,
        'unread_count', (
          select count(*) from public.messages unread
          where unread.conversation_id = conversation.id
            and unread.sender_id <> actor
            and unread.created_at > coalesce(member.last_read_at, '-infinity'::timestamptz)
        ),
        'blocked_by_me', exists (
          select 1 from public.user_blocks block_row
          where block_row.blocker_id = actor and block_row.blocked_id = other_profile.id
        ),
        'blocked_me', exists (
          select 1 from public.user_blocks block_row
          where block_row.blocker_id = other_profile.id and block_row.blocked_id = actor
        )
      ) as payload
    from public.conversation_members member
    join public.conversations conversation on conversation.id = member.conversation_id
    join public.pet_posts post on post.id = conversation.pet_post_id
    join public.profiles other_profile on other_profile.id = case
      when conversation.owner_id = actor then conversation.participant_id
      else conversation.owner_id
    end
    left join lateral (
      select message.body, message.sender_id
      from public.messages message
      where message.conversation_id = conversation.id
      order by message.created_at desc, message.id desc
      limit 1
    ) last_message on true
    where member.user_id = actor
      and member.archived_at is null
  ) item;

  return result;
end
$function$;

create function public.get_my_conversation_v1(p_conversation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  conversation_row public.conversations%rowtype;
  member_row public.conversation_members%rowtype;
  other_user uuid;
  result jsonb;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Se requiere una cuenta activa.' using errcode = '42501';
  end if;

  select conversation.* into conversation_row
  from public.conversations conversation
  where conversation.id = p_conversation_id
    and actor in (conversation.owner_id, conversation.participant_id);

  if not found then
    raise exception 'La conversacion no existe o no le pertenece.' using errcode = '42501';
  end if;

  select member.* into member_row
  from public.conversation_members member
  where member.conversation_id = p_conversation_id
    and member.user_id = actor;

  other_user := case
    when conversation_row.owner_id = actor then conversation_row.participant_id
    else conversation_row.owner_id
  end;

  select jsonb_build_object(
    'id', conversation_row.id,
    'pet_post_id', conversation_row.pet_post_id,
    'pet_name', post.name,
    'pet_state', post.post_state::text,
    'pet_photo_url', post.photo_paths[1],
    'other_user_id', profile.id,
    'other_display_name', profile.display_name,
    'other_avatar_url', profile.avatar_url,
    'blocked_by_me', exists (
      select 1 from public.user_blocks block_row
      where block_row.blocker_id = actor and block_row.blocked_id = other_user
    ),
    'blocked_me', exists (
      select 1 from public.user_blocks block_row
      where block_row.blocker_id = other_user and block_row.blocked_id = actor
    ),
    'messages', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', message.id,
          'sender_id', message.sender_id,
          'body', message.body,
          'created_at', message.created_at,
          'mine', message.sender_id = actor
        ) order by message.created_at, message.id
      )
      from (
        select source.id, source.sender_id, source.body, source.created_at
        from public.messages source
        where source.conversation_id = p_conversation_id
        order by source.created_at desc, source.id desc
        limit 200
      ) message
    ), '[]'::jsonb)
  ) into result
  from public.pet_posts post
  join public.profiles profile on profile.id = other_user
  where post.id = conversation_row.pet_post_id;

  return result;
end
$function$;

create function public.submit_content_report_v1(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  clean_type text := lower(btrim(coalesce(p_target_type, '')));
  clean_reason text := lower(btrim(coalesce(p_reason, '')));
  clean_details text := nullif(btrim(coalesce(p_details, '')), '');
  reported_user uuid;
  report_id uuid;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Se requiere una cuenta activa para denunciar contenido.' using errcode = '42501';
  end if;

  if clean_type not in ('community_post', 'community_comment', 'message') then
    raise exception 'El tipo de contenido no es valido.';
  end if;

  if clean_reason not in ('spam', 'abuse', 'fraud', 'privacy', 'other') then
    raise exception 'Seleccione un motivo valido.';
  end if;

  if clean_details is not null and char_length(clean_details) not between 5 and 1000 then
    raise exception 'El detalle debe tener entre 5 y 1000 caracteres.';
  end if;

  if clean_type = 'community_post' then
    select post.author_id into reported_user
    from public.community_posts post
    where post.id = p_target_id and post.moderation_status::text = 'visible';
  elsif clean_type = 'community_comment' then
    select comment_row.author_id into reported_user
    from public.community_comments comment_row
    join public.community_posts post on post.id = comment_row.post_id
    where comment_row.id = p_target_id
      and comment_row.moderation_status::text = 'visible'
      and post.moderation_status::text = 'visible';
  else
    select message.sender_id into reported_user
    from public.messages message
    join public.conversations conversation on conversation.id = message.conversation_id
    where message.id = p_target_id
      and actor in (conversation.owner_id, conversation.participant_id);
  end if;

  if reported_user is null then
    raise exception 'El contenido no existe o no puede denunciarse.' using errcode = '42501';
  end if;

  if reported_user = actor then
    raise exception 'No puede denunciar su propio contenido.';
  end if;

  select report.id into report_id
  from public.content_reports report
  where report.reporter_id = actor
    and report.status::text = 'open'
    and (
      (clean_type = 'community_post' and report.community_post_id = p_target_id)
      or (clean_type = 'community_comment' and report.community_comment_id = p_target_id)
      or (clean_type = 'message' and report.message_id = p_target_id)
    )
  order by report.created_at desc
  limit 1;

  if report_id is not null then
    return report_id;
  end if;

  insert into public.content_reports (
    reporter_id,
    community_post_id,
    community_comment_id,
    message_id,
    reported_profile_id,
    reason,
    details
  ) values (
    actor,
    case when clean_type = 'community_post' then p_target_id else null end,
    case when clean_type = 'community_comment' then p_target_id else null end,
    case when clean_type = 'message' then p_target_id else null end,
    reported_user,
    clean_reason,
    clean_details
  ) returning id into report_id;

  insert into public.notifications (
    user_id, event_type, title, body, link, payload, dedupe_key
  )
  select
    admin_profile.id,
    'content_report_created',
    'Nueva denuncia de contenido',
    'Hay una denuncia pendiente de revision.',
    '/admin?section=denuncias',
    jsonb_build_object('report_id', report_id, 'target_type', clean_type),
    'content-report:' || report_id::text || ':' || admin_profile.id::text
  from public.profiles admin_profile
  where admin_profile.role::text = 'admin'
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    'content.report_created',
    'content_report',
    report_id::text,
    jsonb_build_object('target_type', clean_type, 'target_id', p_target_id)
  );

  return report_id;
end
$function$;

revoke all on function private.set_community_expiry_024() from public, anon, authenticated;

revoke all on function public.get_my_community_posts_v1() from public, anon;
revoke all on function public.update_my_community_post_v1(uuid,text,text,timestamptz,timestamptz) from public, anon;
revoke all on function public.set_my_community_post_state_v1(uuid,text) from public, anon;
revoke all on function public.get_my_conversation_inbox_v1() from public, anon;
revoke all on function public.get_my_conversation_v1(uuid) from public, anon;
revoke all on function public.submit_content_report_v1(text,uuid,text,text) from public, anon;

grant execute on function public.get_my_community_posts_v1() to authenticated;
grant execute on function public.update_my_community_post_v1(uuid,text,text,timestamptz,timestamptz) to authenticated;
grant execute on function public.set_my_community_post_state_v1(uuid,text) to authenticated;
grant execute on function public.get_my_conversation_inbox_v1() to authenticated;
grant execute on function public.get_my_conversation_v1(uuid) to authenticated;
grant execute on function public.submit_content_report_v1(text,uuid,text,text) to authenticated;

insert into private.app_migrations (version, name, details)
values (
  '024',
  'community_messaging',
  jsonb_build_object(
    'community_comments_and_likes', true,
    'owner_resolution_and_expiry', true,
    'private_conversation_inbox', true,
    'blocking_and_reporting', true,
    'phone_remains_private', true
  )
);

commit;
