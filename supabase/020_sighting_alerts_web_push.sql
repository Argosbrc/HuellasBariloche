-- Huellas Bariloche
-- Migracion 020: avisos privados de avistamiento/resguardo y Web Push opt-in.
-- Requiere 001 a 019. Es transaccional y no expone contactos ni coordenadas.

begin;

select pg_advisory_xact_lock(
  hashtextextended('huellas-bariloche:migration:020', 0)
);

do $$
declare
  missing_migrations text;
begin
  if to_regclass('private.app_migrations') is null then
    raise exception 'No existe private.app_migrations. Primero deben aplicarse las migraciones anteriores.';
  end if;

  select string_agg(required.version, ', ' order by required.version)
  into missing_migrations
  from unnest(array[
    '001','002','003','004','005','006','007','008','009','010',
    '011','012','013','014','015','016','017','018','019'
  ]::text[]) required(version)
  where not exists (
    select 1 from private.app_migrations migration
    where migration.version = required.version
  );

  if missing_migrations is not null then
    raise exception 'Faltan migraciones requeridas: %', missing_migrations;
  end if;

  if exists (select 1 from private.app_migrations where version = '020')
     or to_regclass('public.pet_sighting_alerts_020') is not null
     or to_regclass('public.web_push_subscriptions_020') is not null
     or to_regprocedure('public.submit_pet_sighting_alert_v1(uuid,text,text,double precision,double precision,text,text,text,text)') is not null
     or to_regprocedure('public.claim_pet_sighting_push_delivery_v1(uuid,uuid)') is not null
     or to_regprocedure('public.get_my_pet_sighting_alerts_v1()') is not null
     or to_regprocedure('public.upsert_my_web_push_subscription_v1(text,text,text,text)') is not null
     or to_regprocedure('public.deactivate_my_web_push_subscription_v1(text)') is not null then
    raise exception 'La migracion 020 ya fue aplicada o existe parcialmente. No debe ejecutarse nuevamente.';
  end if;

  if to_regclass('public.pet_posts') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.notifications') is null
     or to_regclass('public.audit_log') is null then
    raise exception 'Faltan tablas requeridas para los avisos de mascotas.';
  end if;

  if to_regprocedure('private.is_active_user()') is null
     or to_regprocedure('private.is_admin()') is null
     or to_regprocedure('private.set_updated_at()') is null then
    raise exception 'Faltan funciones de seguridad requeridas.';
  end if;
end;
$$;

create table public.pet_sighting_alerts_020 (
  id uuid primary key default gen_random_uuid(),
  pet_post_id uuid not null references public.pet_posts(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  reporter_user_id uuid references public.profiles(id) on delete set null,
  alert_kind text not null,
  location_text text,
  latitude double precision,
  longitude double precision,
  message text not null,
  contact_phone text,
  contact_social text,
  reporter_key text not null,
  status text not null default 'new',
  dispatch_token uuid not null default gen_random_uuid(),
  dispatch_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pet_sighting_alert_kind_020
    check (alert_kind in ('sighting', 'sheltered')),
  constraint pet_sighting_alert_location_length_020
    check (location_text is null or char_length(btrim(location_text)) between 3 and 180),
  constraint pet_sighting_alert_coordinates_pair_020
    check ((latitude is null and longitude is null) or (latitude is not null and longitude is not null)),
  constraint pet_sighting_alert_latitude_020
    check (latitude is null or latitude between -90 and 90),
  constraint pet_sighting_alert_longitude_020
    check (longitude is null or longitude between -180 and 180),
  constraint pet_sighting_alert_message_length_020
    check (char_length(btrim(message)) between 8 and 1200),
  constraint pet_sighting_alert_phone_length_020
    check (contact_phone is null or char_length(btrim(contact_phone)) between 7 and 30),
  constraint pet_sighting_alert_phone_format_020
    check (contact_phone is null or contact_phone ~ '^[0-9+() .-]{7,30}$'),
  constraint pet_sighting_alert_social_length_020
    check (contact_social is null or char_length(btrim(contact_social)) between 2 and 180),
  constraint pet_sighting_alert_sheltered_contact_020
    check (alert_kind <> 'sheltered' or contact_phone is not null or contact_social is not null),
  constraint pet_sighting_alert_reporter_key_020
    check (reporter_key ~ '^[0-9a-f]{64}$'),
  constraint pet_sighting_alert_status_020
    check (status in ('new', 'contacted', 'resolved', 'dismissed'))
);

create index pet_sighting_alert_owner_created_idx_020
  on public.pet_sighting_alerts_020 (owner_user_id, created_at desc);
create index pet_sighting_alert_post_created_idx_020
  on public.pet_sighting_alerts_020 (pet_post_id, created_at desc);
create index pet_sighting_alert_rate_idx_020
  on public.pet_sighting_alerts_020 (reporter_key, created_at desc);

comment on table public.pet_sighting_alerts_020 is
  'Avisos privados sobre mascotas perdidas. Contactos y coordenadas solo se entregan al dueño del caso o a administracion mediante funcion controlada.';

create trigger pet_sighting_alerts_set_updated_at_020
before update on public.pet_sighting_alerts_020
for each row execute function private.set_updated_at();

alter table public.pet_sighting_alerts_020 enable row level security;
revoke all on table public.pet_sighting_alerts_020 from public, anon, authenticated;
grant select, insert, update, delete on table public.pet_sighting_alerts_020 to service_role;

create table public.web_push_subscriptions_020 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_push_endpoint_length_020
    check (char_length(endpoint) between 20 and 2048),
  constraint web_push_p256dh_length_020
    check (char_length(p256dh) between 40 and 300),
  constraint web_push_auth_length_020
    check (char_length(auth) between 8 and 200),
  constraint web_push_user_agent_length_020
    check (user_agent is null or char_length(user_agent) <= 500)
);

create index web_push_user_active_idx_020
  on public.web_push_subscriptions_020 (user_id, active);

comment on table public.web_push_subscriptions_020 is
  'Suscripciones privadas Web Push habilitadas voluntariamente por cada usuario y dispositivo.';

create trigger web_push_subscriptions_set_updated_at_020
before update on public.web_push_subscriptions_020
for each row execute function private.set_updated_at();

alter table public.web_push_subscriptions_020 enable row level security;
revoke all on table public.web_push_subscriptions_020 from public, anon, authenticated;
grant select, insert, update, delete on table public.web_push_subscriptions_020 to service_role;

create function public.submit_pet_sighting_alert_v1(
  p_pet_post_id uuid,
  p_alert_kind text,
  p_location_text text,
  p_latitude double precision,
  p_longitude double precision,
  p_message text,
  p_contact_phone text,
  p_contact_social text,
  p_reporter_key text
)
returns table (alert_id uuid, dispatch_token uuid)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  target_owner uuid;
  target_pet_name text;
  clean_kind text := lower(btrim(coalesce(p_alert_kind, '')));
  clean_location text := nullif(btrim(coalesce(p_location_text, '')), '');
  clean_message text := btrim(coalesce(p_message, ''));
  clean_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  clean_social text := nullif(btrim(coalesce(p_contact_social, '')), '');
  clean_reporter_key text := lower(btrim(coalesce(p_reporter_key, '')));
  created_alert_id uuid;
  created_dispatch_token uuid := gen_random_uuid();
  notification_title text;
  notification_body text;
begin
  if actor is not null and not private.is_active_user() then
    raise exception 'Tu cuenta no esta habilitada para enviar avisos.' using errcode = '42501';
  end if;
  if clean_kind not in ('sighting', 'sheltered') then
    raise exception 'Selecciona si fue un avistamiento o si esta a resguardo.';
  end if;
  if clean_location is null or char_length(clean_location) not between 3 and 180 then
    raise exception 'Indica el lugar con una referencia de entre 3 y 180 caracteres.';
  end if;
  if char_length(clean_message) not between 8 and 1200 then
    raise exception 'El detalle debe tener entre 8 y 1200 caracteres.';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'La ubicacion debe incluir latitud y longitud.';
  end if;
  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90) then
    raise exception 'La latitud no es valida.';
  end if;
  if p_longitude is not null and (p_longitude < -180 or p_longitude > 180) then
    raise exception 'La longitud no es valida.';
  end if;
  if clean_phone is not null and (char_length(clean_phone) not between 7 and 30 or clean_phone !~ '^[0-9+() .-]{7,30}$') then
    raise exception 'El telefono no tiene un formato valido.';
  end if;
  if clean_social is not null and char_length(clean_social) not between 2 and 180 then
    raise exception 'La red social debe tener entre 2 y 180 caracteres.';
  end if;
  if clean_kind = 'sheltered' and clean_phone is null and clean_social is null then
    raise exception 'Si lo tenes a resguardo, deja un telefono o una red social para coordinar.';
  end if;
  if clean_reporter_key !~ '^[0-9a-f]{64}$' then
    raise exception 'No se pudo validar el origen del aviso.';
  end if;

  select post.owner_id, coalesce(nullif(btrim(post.name), ''), 'la mascota')
  into target_owner, target_pet_name
  from public.pet_posts post
  where post.id = p_pet_post_id
    and post.post_type::text = 'lost'
    and post.post_state::text in ('lost', 'sighted')
    and post.moderation_status::text = 'visible'
  for share of post;

  if target_owner is null then
    raise exception 'El caso ya no esta disponible para recibir avisos.';
  end if;

  if (
    select count(*)
    from public.pet_sighting_alerts_020 recent
    where recent.reporter_key = clean_reporter_key
      and recent.created_at > now() - interval '1 hour'
  ) >= 4 then
    raise exception 'Ya enviaste varios avisos recientemente. Intenta nuevamente mas tarde.';
  end if;

  insert into public.pet_sighting_alerts_020 (
    pet_post_id, owner_user_id, reporter_user_id, alert_kind,
    location_text, latitude, longitude, message, contact_phone,
    contact_social, reporter_key, dispatch_token
  ) values (
    p_pet_post_id, target_owner, actor, clean_kind,
    clean_location, p_latitude, p_longitude, clean_message, clean_phone,
    clean_social, clean_reporter_key, created_dispatch_token
  ) returning id into created_alert_id;

  notification_title := case
    when clean_kind = 'sheltered' then '🚨 ' || upper(target_pet_name) || ' ESTA A RESGUARDO'
    else '🚨 AVISTARON A ' || upper(target_pet_name)
  end;
  notification_body := left(
    case when clean_kind = 'sheltered'
      then 'Una persona informo que tiene a ' || target_pet_name || ' en un lugar seguro.'
      else 'Una persona informo que vio a ' || target_pet_name || '.'
    end || ' Lugar: ' || clean_location || '. Revisa los datos privados en tu panel.',
    500
  );

  insert into public.notifications (
    user_id, event_type, title, body, link, payload, dedupe_key
  ) values (
    target_owner,
    case when clean_kind = 'sheltered' then 'lost_pet_sheltered' else 'lost_pet_sighting' end,
    notification_title,
    notification_body,
    '/panel#avisos-casos',
    jsonb_build_object(
      'sighting_alert_id', created_alert_id,
      'pet_post_id', p_pet_post_id,
      'alert_kind', clean_kind
    ),
    'pet_sighting_alert_' || created_alert_id::text
  ) on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  if actor is not null then
    insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
    values (
      actor,
      'pet_sighting_alert.created',
      'pet_sighting_alert',
      created_alert_id::text,
      jsonb_build_object('pet_post_id', p_pet_post_id, 'alert_kind', clean_kind)
    );
  end if;

  return query select created_alert_id, created_dispatch_token;
end;
$function$;

create function public.claim_pet_sighting_push_delivery_v1(
  p_alert_id uuid,
  p_dispatch_token uuid
)
returns table (
  endpoint text,
  p256dh text,
  auth text,
  push_title text,
  push_body text,
  push_link text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_owner uuid;
  target_kind text;
  target_location text;
  target_pet_name text;
begin
  update public.pet_sighting_alerts_020 sighting
  set dispatch_claimed_at = now(), updated_at = now()
  where sighting.id = p_alert_id
    and sighting.dispatch_token = p_dispatch_token
    and sighting.dispatch_claimed_at is null
    and sighting.created_at > now() - interval '10 minutes'
  returning sighting.owner_user_id, sighting.alert_kind, sighting.location_text
  into target_owner, target_kind, target_location;

  if target_owner is null then
    return;
  end if;

  select coalesce(nullif(btrim(post.name), ''), 'tu mascota')
  into target_pet_name
  from public.pet_sighting_alerts_020 sighting
  join public.pet_posts post on post.id = sighting.pet_post_id
  where sighting.id = p_alert_id;

  return query
  select
    subscription.endpoint,
    subscription.p256dh,
    subscription.auth,
    case when target_kind = 'sheltered'
      then '🚨 ' || target_pet_name || ' esta a resguardo'
      else '🚨 Avistaron a ' || target_pet_name
    end,
    case when target_kind = 'sheltered'
      then 'Una persona lo tiene en un lugar seguro. Lugar: ' || target_location
      else 'Recibiste un nuevo avistamiento. Lugar: ' || target_location
    end,
    '/panel#avisos-casos'
  from public.web_push_subscriptions_020 subscription
  where subscription.user_id = target_owner
    and subscription.active;

  update public.web_push_subscriptions_020 subscription
  set last_used_at = now(), updated_at = now()
  where subscription.user_id = target_owner
    and subscription.active;
end;
$function$;

create function public.upsert_my_web_push_subscription_v1(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  clean_endpoint text := btrim(coalesce(p_endpoint, ''));
  clean_p256dh text := btrim(coalesce(p_p256dh, ''));
  clean_auth text := btrim(coalesce(p_auth, ''));
  clean_user_agent text := nullif(left(btrim(coalesce(p_user_agent, '')), 500), '');
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion para activar alertas.' using errcode = '42501';
  end if;
  if char_length(clean_endpoint) not between 20 and 2048
     or char_length(clean_p256dh) not between 40 and 300
     or char_length(clean_auth) not between 8 and 200 then
    raise exception 'La suscripcion del dispositivo no es valida.';
  end if;

  insert into public.web_push_subscriptions_020 (
    user_id, endpoint, p256dh, auth, user_agent, active, updated_at
  ) values (
    actor, clean_endpoint, clean_p256dh, clean_auth, clean_user_agent, true, now()
  )
  on conflict (endpoint) do update
  set user_id = actor,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      active = true,
      updated_at = now();
end;
$function$;

create function public.deactivate_my_web_push_subscription_v1(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion para cambiar alertas.' using errcode = '42501';
  end if;

  update public.web_push_subscriptions_020 subscription
  set active = false, updated_at = now()
  where subscription.user_id = actor
    and subscription.endpoint = btrim(coalesce(p_endpoint, ''));
end;
$function$;

create function public.get_my_pet_sighting_alerts_v1()
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
          'status', sighting.status,
          'created_at', sighting.created_at
        ) order by sighting.created_at desc
      )
      from public.pet_sighting_alerts_020 sighting
      join public.pet_posts post on post.id = sighting.pet_post_id
      left join public.profiles reporter on reporter.id = sighting.reporter_user_id
      where sighting.owner_user_id = (select auth.uid())
        or private.is_admin()
    ), '[]'::jsonb)
  end;
$function$;

revoke all on function public.submit_pet_sighting_alert_v1(
  uuid,text,text,double precision,double precision,text,text,text,text
) from public;
grant execute on function public.submit_pet_sighting_alert_v1(
  uuid,text,text,double precision,double precision,text,text,text,text
) to anon, authenticated;

revoke all on function public.claim_pet_sighting_push_delivery_v1(uuid,uuid) from public;
revoke all on function public.claim_pet_sighting_push_delivery_v1(uuid,uuid) from anon, authenticated;
grant execute on function public.claim_pet_sighting_push_delivery_v1(uuid,uuid) to service_role;

revoke all on function public.upsert_my_web_push_subscription_v1(text,text,text,text) from public, anon;
grant execute on function public.upsert_my_web_push_subscription_v1(text,text,text,text) to authenticated;

revoke all on function public.deactivate_my_web_push_subscription_v1(text) from public, anon;
grant execute on function public.deactivate_my_web_push_subscription_v1(text) to authenticated;

revoke all on function public.get_my_pet_sighting_alerts_v1() from public, anon;
grant execute on function public.get_my_pet_sighting_alerts_v1() to authenticated;

insert into private.app_migrations (version, name, details)
values (
  '020',
  'pet_sighting_alerts_and_web_push',
  jsonb_build_object(
    'private_sighting_and_shelter_reports', true,
    'owner_dashboard_notifications', true,
    'optional_web_push_per_device', true,
    'private_contact_and_coordinates', true,
    'anonymous_rate_limit', true
  )
);

notify pgrst, 'reload schema';

commit;
