

begin;

select pg_advisory_xact_lock(
  hashtextextended('huellas-bariloche:migration:025', 0)
);

do $$
begin
  if to_regclass('private.app_migrations') is null then
    raise exception 'No existe private.app_migrations.';
  end if;

  if not exists (select 1 from private.app_migrations where version = '024') then
    raise exception 'La migracion 024 debe estar instalada antes de ejecutar 025.';
  end if;

  if exists (select 1 from private.app_migrations where version = '025')
     or to_regprocedure('public.start_sighting_conversation(uuid,uuid)') is not null then
    raise exception 'La migracion 025 ya fue aplicada o existe parcialmente.';
  end if;

  if to_regprocedure('public.start_conversation(uuid)') is null then
    raise exception 'Falta start_conversation de la migracion 008.';
  end if;
end;
$$;

create or replace function public.get_my_pet_sighting_alerts_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when (select auth.uid()) is null then '[]'::jsonb
    else coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', sighting.id,
          'pet_post_id', post.id,
          'pet_name', post.name,
          'cover_image_url', case when cardinality(post.photo_paths) > 0 then post.photo_paths[1] else null end,
          'alert_kind', sighting.alert_kind,
          'location_text', sighting.location_text,
          'latitude', sighting.latitude,
          'longitude', sighting.longitude,
          'message', sighting.message,
          'contact_phone', sighting.contact_phone,
          'contact_social', sighting.contact_social,
          'reporter_name', reporter.display_name,
          'reporter_user_id', sighting.reporter_user_id,
          'status', sighting.status,
          'created_at', sighting.created_at
        ) order by sighting.created_at desc
      )
      from public.pet_sighting_alerts_020 sighting
join public.pet_posts post on post.id = sighting.pet_post_id
left join public.profiles reporter on reporter.id = sighting.reporter_user_id
where (
  sighting.owner_user_id = (select auth.uid())
  or private.is_admin()
)
and sighting.status <> 'dismissed'
    ), '[]'::jsonb)
  end;
$function$;

create function public.start_sighting_conversation(
  target_post uuid,
  target_user uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := auth.uid();
  post_owner uuid;
  conversation_id uuid;
  existing_conversation uuid;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion para contactar a la persona.' using errcode = '42501';
  end if;

  if target_post is null or target_user is null then
    raise exception 'No se pudo identificar la conversacion.';
  end if;

  if actor = target_user then
    raise exception 'No podes iniciar una conversacion contigo mismo.';
  end if;

  select post.owner_id into post_owner
  from public.pet_posts post
  where post.id = target_post;

  if post_owner is null then
    raise exception 'La publicacion no existe.';
  end if;

  if post_owner <> actor and not private.is_admin() then
    raise exception 'Solo el dueno del caso puede contactar desde un aviso.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.pet_sighting_alerts_020 sighting
    where sighting.pet_post_id = target_post
      and sighting.owner_user_id = post_owner
      and sighting.reporter_user_id = target_user
      and sighting.status not in ('dismissed')
  ) then
    raise exception 'No hay un aviso activo de esa persona para este caso.' using errcode = '42501';
  end if;

  select conversation.id into existing_conversation
  from public.conversations conversation
  where conversation.pet_post_id = target_post
    and conversation.owner_id = post_owner
    and conversation.participant_id = target_user
  limit 1;

  if existing_conversation is not null then
    conversation_id := existing_conversation;

    update public.conversation_members member
    set archived_at = null
    where member.conversation_id = conversation_id
      and member.user_id in (post_owner, target_user);
  else
    insert into public.conversations (
      pet_post_id, owner_id, participant_id, last_message_at
    ) values (
      target_post, post_owner, target_user, now()
    )
    returning id into conversation_id;

    if not exists (
      select 1 from public.conversation_members member
      where member.conversation_id = conversation_id and member.user_id = post_owner
    ) then
      insert into public.conversation_members (conversation_id, user_id)
      values (conversation_id, post_owner);
    end if;

    if not exists (
      select 1 from public.conversation_members member
      where member.conversation_id = conversation_id and member.user_id = target_user
    ) then
      insert into public.conversation_members (conversation_id, user_id)
      values (conversation_id, target_user);
    end if;
  end if;

  update public.pet_sighting_alerts_020 sighting
  set status = 'contacted', updated_at = now()
  where sighting.pet_post_id = target_post
    and sighting.owner_user_id = post_owner
    and sighting.reporter_user_id = target_user
    and sighting.status = 'new';

  return conversation_id;
end;
$function$;

revoke all on function public.start_sighting_conversation(uuid,uuid) from public, anon;
grant execute on function public.start_sighting_conversation(uuid,uuid) to authenticated;

insert into private.app_migrations (version, name, details)
values (
  '025',
  'sighting_conversations',
  jsonb_build_object(
    'reporter_user_id_in_dashboard', true,
    'start_sighting_conversation', true
  )
);

notify pgrst, 'reload schema';

commit;
