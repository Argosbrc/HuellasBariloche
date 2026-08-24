-- Huellas Bariloche
-- Migracion 023: medallero, reencuentros y alertas voluntarias por cercania.
-- Requiere 001 a 022. Es transaccional y no expone ubicaciones exactas.

begin;

select pg_advisory_xact_lock(
  hashtextextended('huellas-bariloche:migration:023', 0)
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
    '001','002','003','004','005','006','007','008','009',
    '010','011','012','013','014','015','016','017','018',
    '019','020','021','022'
  ]::text[]) required(version)
  where not exists (
    select 1 from private.app_migrations migration
    where migration.version = required.version
  );

  if missing_migrations is not null then
    raise exception 'Faltan migraciones requeridas: %', missing_migrations;
  end if;

  if exists (select 1 from private.app_migrations where version = '023')
     or to_regclass('public.nearby_alert_settings_023') is not null
     or to_regprocedure('public.get_community_medal_board_v1()') is not null then
    raise exception 'La migracion 023 ya fue aplicada o existe parcialmente. No debe ejecutarse nuevamente.';
  end if;

  if to_regclass('public.profiles') is null
     or to_regclass('public.badges') is null
     or to_regclass('public.user_badges') is null
     or to_regclass('public.account_moderation') is null
     or to_regclass('public.profile_contacts') is null
     or to_regclass('public.pet_posts') is null
     or to_regclass('public.pet_locations_private') is null
     or to_regclass('public.sightings') is null
     or to_regclass('public.notifications') is null
     or to_regclass('public.audit_log') is null
     or to_regclass('public.post_status_history') is null
     or to_regclass('public.web_push_subscriptions_020') is null
     or to_regclass('public.pet_sighting_alerts_020') is null
     or to_regclass('public.adoption_requests') is null then
    raise exception 'Faltan tablas requeridas para medallas, reencuentros o alertas cercanas.';
  end if;

  if to_regprocedure('private.is_active_user()') is null
     or to_regprocedure('private.is_admin()') is null
     or to_regprocedure('private.set_updated_at()') is null then
    raise exception 'Faltan funciones de seguridad requeridas.';
  end if;
end;
$$;

-- No hay niveles: cada reconocimiento es una medalla independiente.
-- is_active=false evita que el motor historico basado solo en puntos las entregue;
-- badge_rules_023 es la unica fuente de verdad para estas nueve medallas.
insert into public.badges (id, name, description, icon, points_required, is_active, sort_order)
values
  ('hb-first-sighting', 'Primera huella', 'Tu primer avistamiento fue confirmado por la familia.', 'paw-print', 0, false, 10),
  ('hb-ten-sightings', 'Ojos del barrio', 'Diez avistamientos confirmados ayudaron a orientar búsquedas.', 'binoculars', 0, false, 20),
  ('hb-first-found-pet', 'Rescate en marcha', 'Publicaste por primera vez una mascota encontrada.', 'shield-heart', 0, false, 30),
  ('hb-first-reunion', 'Puente a casa', 'Tu aporte ayudó en un primer reencuentro.', 'house-heart', 0, false, 40),
  ('hb-ten-reunions', 'Guardián de reencuentros', 'Tu colaboración estuvo presente en diez reencuentros.', 'trophy', 0, false, 50),
  ('hb-first-comment', 'Voz solidaria', 'Dejaste tu primer comentario para acompañar a la comunidad.', 'message-heart', 0, false, 60),
  ('hb-hundred-posts', 'Comunidad incansable', 'Alcanzaste cien publicaciones comunitarias.', 'sparkles', 0, false, 70),
  ('hb-complete-profile', 'Identidad solidaria', 'Completaste tu perfil para colaborar con confianza.', 'circle-user-round', 0, false, 80),
  ('hb-adoption-helper', 'Corazón adoptante', 'Ayudaste a concretar una adopción responsable.', 'heart-handshake', 0, false, 90)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    icon = excluded.icon,
    points_required = excluded.points_required,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

create table public.badge_rules_023 (
  badge_id text primary key references public.badges(id) on delete cascade,
  rule_key text not null unique,
  threshold integer not null check (threshold > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.badge_rules_023 (badge_id, rule_key, threshold, sort_order)
values
  ('hb-first-sighting', 'confirmed_sightings', 1, 10),
  ('hb-ten-sightings', 'confirmed_sightings', 10, 20),
  ('hb-first-found-pet', 'found_pet_posts', 1, 30),
  ('hb-first-reunion', 'contributed_reunions', 1, 40),
  ('hb-ten-reunions', 'contributed_reunions', 10, 50),
  ('hb-first-comment', 'community_comments', 1, 60),
  ('hb-hundred-posts', 'publications', 100, 70),
  ('hb-complete-profile', 'complete_profile', 1, 80),
  ('hb-adoption-helper', 'completed_adoptions', 1, 90);

create trigger badge_rules_set_updated_at_023
before update on public.badge_rules_023
for each row execute function private.set_updated_at();

alter table public.badge_rules_023 enable row level security;
revoke all on table public.badge_rules_023 from public, anon, authenticated;
grant select, insert, update, delete on table public.badge_rules_023 to service_role;

create table public.reunion_contributors_023 (
  pet_post_id uuid not null references public.pet_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  contribution_type text not null check (contribution_type in ('confirmed_sighting', 'sighting_alert')),
  created_at timestamptz not null default now(),
  primary key (pet_post_id, profile_id)
);

create index reunion_contributors_profile_idx_023
  on public.reunion_contributors_023 (profile_id, created_at desc);

alter table public.reunion_contributors_023 enable row level security;
revoke all on table public.reunion_contributors_023 from public, anon, authenticated;
grant select, insert, update, delete on table public.reunion_contributors_023 to service_role;

create table public.nearby_alert_settings_023 (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default false,
  radius_km integer not null default 3 check (radius_km in (3, 5)),
  exact_latitude double precision,
  exact_longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nearby_alert_coordinates_pair_023 check (
    (exact_latitude is null and exact_longitude is null)
    or (exact_latitude is not null and exact_longitude is not null)
  ),
  constraint nearby_alert_enabled_location_023 check (
    not enabled or (exact_latitude is not null and exact_longitude is not null)
  ),
  constraint nearby_alert_latitude_023 check (exact_latitude is null or exact_latitude between -90 and 90),
  constraint nearby_alert_longitude_023 check (exact_longitude is null or exact_longitude between -180 and 180)
);

create index nearby_alert_enabled_idx_023
  on public.nearby_alert_settings_023 (enabled, radius_km)
  where enabled;

create trigger nearby_alert_settings_set_updated_at_023
before update on public.nearby_alert_settings_023
for each row execute function private.set_updated_at();

alter table public.nearby_alert_settings_023 enable row level security;
revoke all on table public.nearby_alert_settings_023 from public, anon, authenticated;
grant select, insert, update, delete on table public.nearby_alert_settings_023 to service_role;

create table public.nearby_case_deliveries_023 (
  pet_post_id uuid not null references public.pet_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  distance_m integer not null check (distance_m >= 0),
  push_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (pet_post_id, user_id)
);

create index nearby_case_deliveries_push_idx_023
  on public.nearby_case_deliveries_023 (pet_post_id, push_claimed_at);

alter table public.nearby_case_deliveries_023 enable row level security;
revoke all on table public.nearby_case_deliveries_023 from public, anon, authenticated;
grant select, insert, update, delete on table public.nearby_case_deliveries_023 to service_role;

create function private.distance_meters_023(
  p_latitude_a double precision,
  p_longitude_a double precision,
  p_latitude_b double precision,
  p_longitude_b double precision
)
returns double precision
language sql
immutable
strict
set search_path = ''
as $function$
  select 6371000::double precision * 2 * asin(
    sqrt(
      least(
        1::double precision,
        power(sin(radians(p_latitude_b - p_latitude_a) / 2), 2)
        + cos(radians(p_latitude_a)) * cos(radians(p_latitude_b))
        * power(sin(radians(p_longitude_b - p_longitude_a) / 2), 2)
      )
    )
  );
$function$;

create function private.award_community_badge_023(
  p_profile_id uuid,
  p_badge_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  badge_name text;
  inserted_badge text;
begin
  if p_profile_id is null then
    return false;
  end if;

  select badge.name into badge_name
  from public.badges badge
  join public.badge_rules_023 rule on rule.badge_id = badge.id and rule.is_active
  where badge.id = p_badge_id;

  if badge_name is null then
    return false;
  end if;

  insert into public.user_badges (profile_id, badge_id, awarded_at)
  values (p_profile_id, p_badge_id, now())
  on conflict (profile_id, badge_id) do nothing
  returning badge_id into inserted_badge;

  if inserted_badge is null then
    return false;
  end if;

  insert into public.notifications (
    user_id, event_type, title, body, link, payload, dedupe_key
  )
  values (
    p_profile_id,
    'community_badge_awarded',
    '¡Nueva medalla!',
    'Ganaste la medalla “' || badge_name || '”. Tu ayuda deja huella.',
    '/medallas',
    jsonb_build_object('badge_id', p_badge_id, 'badge_name', badge_name),
    'community_badge_023_' || p_badge_id
  )
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  return true;
end;
$function$;

create function private.refresh_community_badges_023(p_profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  confirmed_sightings integer := 0;
  found_posts integer := 0;
  contributed_reunions integer := 0;
  publications_count integer := 0;
  community_posts_count integer := 0;
  community_comments_count integer := 0;
  completed_adoptions integer := 0;
  profile_complete boolean := false;
  author_column text;
  awarded integer := 0;
begin
  if p_profile_id is null or not exists (
    select 1 from public.profiles profile where profile.id = p_profile_id
  ) then
    return 0;
  end if;

  select count(*)::integer into confirmed_sightings
  from public.sightings sighting
  where sighting.reporter_id = p_profile_id
    and sighting.status::text = 'confirmed';

  select count(*)::integer into found_posts
  from public.pet_posts post
  where post.owner_id = p_profile_id
    and post.post_type::text = 'found'
    and post.moderation_status::text = 'visible';

  select count(*)::integer into publications_count
  from public.pet_posts post
  where post.owner_id = p_profile_id
    and post.moderation_status::text = 'visible';

  select count(distinct contribution.pet_post_id)::integer into contributed_reunions
  from public.reunion_contributors_023 contribution
  where contribution.profile_id = p_profile_id;

  if to_regclass('public.community_posts') is not null then
    select column_name into author_column
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'community_posts'
      and column_name in ('author_id', 'user_id', 'profile_id')
    order by case column_name when 'author_id' then 1 when 'user_id' then 2 else 3 end
    limit 1;
    if author_column is not null then
      execute format('select count(*)::integer from public.community_posts where %I = $1', author_column)
      into community_posts_count using p_profile_id;
      publications_count := publications_count + community_posts_count;
    end if;
  end if;

  author_column := null;
  if to_regclass('public.community_comments') is not null then
    select column_name into author_column
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'community_comments'
      and column_name in ('author_id', 'user_id', 'profile_id')
    order by case column_name when 'author_id' then 1 when 'user_id' then 2 else 3 end
    limit 1;
    if author_column is not null then
      execute format('select count(*)::integer from public.community_comments where %I = $1', author_column)
      into community_comments_count using p_profile_id;
    end if;
  elsif to_regclass('public.comments') is not null then
    select column_name into author_column
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'comments'
      and column_name in ('author_id', 'user_id', 'profile_id')
    order by case column_name when 'author_id' then 1 when 'user_id' then 2 else 3 end
    limit 1;
    if author_column is not null then
      execute format('select count(*)::integer from public.comments where %I = $1', author_column)
      into community_comments_count using p_profile_id;
    end if;
  end if;

  select count(distinct post.id)::integer into completed_adoptions
  from public.pet_posts post
  left join public.adoption_requests request
    on request.pet_post_id = post.id and request.status::text = 'accepted'
  where post.post_state::text = 'adopted'
    and (post.owner_id = p_profile_id or request.requester_id = p_profile_id);

  select (
    nullif(btrim(profile.display_name), '') is not null
    and nullif(btrim(coalesce(profile.bio, '')), '') is not null
    and nullif(btrim(coalesce(profile.avatar_url, '')), '') is not null
    and (
      nullif(btrim(coalesce(contact.whatsapp, '')), '') is not null
      or nullif(btrim(coalesce(contact.public_email, '')), '') is not null
    )
  ) into profile_complete
  from public.profiles profile
  left join public.profile_contacts contact on contact.user_id = profile.id
  where profile.id = p_profile_id;

  if confirmed_sightings >= 1 and private.award_community_badge_023(p_profile_id, 'hb-first-sighting') then awarded := awarded + 1; end if;
  if confirmed_sightings >= 10 and private.award_community_badge_023(p_profile_id, 'hb-ten-sightings') then awarded := awarded + 1; end if;
  if found_posts >= 1 and private.award_community_badge_023(p_profile_id, 'hb-first-found-pet') then awarded := awarded + 1; end if;
  if contributed_reunions >= 1 and private.award_community_badge_023(p_profile_id, 'hb-first-reunion') then awarded := awarded + 1; end if;
  if contributed_reunions >= 10 and private.award_community_badge_023(p_profile_id, 'hb-ten-reunions') then awarded := awarded + 1; end if;
  if community_comments_count >= 1 and private.award_community_badge_023(p_profile_id, 'hb-first-comment') then awarded := awarded + 1; end if;
  if publications_count >= 100 and private.award_community_badge_023(p_profile_id, 'hb-hundred-posts') then awarded := awarded + 1; end if;
  if profile_complete and private.award_community_badge_023(p_profile_id, 'hb-complete-profile') then awarded := awarded + 1; end if;
  if completed_adoptions >= 1 and private.award_community_badge_023(p_profile_id, 'hb-adoption-helper') then awarded := awarded + 1; end if;

  return awarded;
end;
$function$;

create function private.capture_reunion_contributors_023(p_pet_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  pet_name text;
  owner_id uuid;
  contribution record;
  contributor_count integer := 0;
begin
  select post.name, post.owner_id into pet_name, owner_id
  from public.pet_posts post
  where post.id = p_pet_post_id and post.post_state::text = 'reunited';

  if owner_id is null then
    return 0;
  end if;

  insert into public.reunion_contributors_023 (pet_post_id, profile_id, contribution_type)
  select p_pet_post_id, source.profile_id, min(source.contribution_type)
  from (
    select sighting.reporter_id as profile_id, 'confirmed_sighting'::text as contribution_type
    from public.sightings sighting
    where sighting.pet_post_id = p_pet_post_id
      and sighting.reporter_id is not null
      and sighting.status::text = 'confirmed'
    union all
    select alert.reporter_user_id, 'sighting_alert'::text
    from public.pet_sighting_alerts_020 alert
    where alert.pet_post_id = p_pet_post_id
      and alert.reporter_user_id is not null
      and alert.status <> 'dismissed'
  ) source
  where source.profile_id <> owner_id
  group by source.profile_id
  on conflict (pet_post_id, profile_id) do nothing;

  for contribution in
    select item.profile_id
    from public.reunion_contributors_023 item
    where item.pet_post_id = p_pet_post_id
  loop
    insert into public.notifications (
      user_id, event_type, title, body, link, payload, dedupe_key
    )
    values (
      contribution.profile_id,
      'reunion_thanks',
      '¡Volvió con su familia!',
      coalesce(nullif(btrim(pet_name), ''), 'Esta mascota') || ' pudo reencontrarse con su familia gracias a vos y a la comunidad.',
      '/encuentros#encuentro-' || p_pet_post_id::text,
      jsonb_build_object('pet_post_id', p_pet_post_id),
      'reunion_thanks_023_' || p_pet_post_id::text
    )
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

    perform private.refresh_community_badges_023(contribution.profile_id);
    contributor_count := contributor_count + 1;
  end loop;

  return contributor_count;
end;
$function$;

create function private.enqueue_nearby_lost_case_023(p_pet_post_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  post_record record;
  queued_count integer := 0;
begin
  select post.id, post.owner_id, post.name, post.zone_name,
         location.exact_latitude, location.exact_longitude
  into post_record
  from public.pet_posts post
  join public.pet_locations_private location on location.pet_post_id = post.id
  where post.id = p_pet_post_id
    and post.post_type::text = 'lost'
    and post.post_state::text in ('lost', 'sighted')
    and post.status::text = 'active'
    and post.moderation_status::text = 'visible';

  if post_record.id is null then
    return 0;
  end if;

  with candidates as (
    select setting.user_id,
           round(private.distance_meters_023(
             setting.exact_latitude, setting.exact_longitude,
             post_record.exact_latitude, post_record.exact_longitude
           ))::integer as distance_m
    from public.nearby_alert_settings_023 setting
    where setting.enabled
      and setting.user_id <> post_record.owner_id
      and private.distance_meters_023(
        setting.exact_latitude, setting.exact_longitude,
        post_record.exact_latitude, post_record.exact_longitude
      ) <= setting.radius_km * 1000
  ), queued as (
    insert into public.nearby_case_deliveries_023 (pet_post_id, user_id, distance_m)
    select p_pet_post_id, candidate.user_id, candidate.distance_m
    from candidates candidate
    on conflict (pet_post_id, user_id) do nothing
    returning user_id, distance_m
  ), notified as (
    insert into public.notifications (
      user_id, event_type, title, body, link, payload, dedupe_key
    )
    select
      queued.user_id,
      'nearby_lost_pet',
      'Mascota perdida cerca tuyo',
      coalesce(nullif(btrim(post_record.name), ''), 'Una mascota') ||
        ' se perdió en ' || coalesce(nullif(btrim(post_record.zone_name), ''), 'tu zona') ||
        '. Si la ves, podés avisar desde su ficha.',
      '/casos/' || p_pet_post_id::text,
      jsonb_build_object(
        'pet_post_id', p_pet_post_id,
        'distance_m', queued.distance_m,
        'zone_name', post_record.zone_name
      ),
      'nearby_lost_023_' || p_pet_post_id::text
    from queued
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
    returning user_id
  )
  select count(*)::integer into queued_count from notified;

  return queued_count;
end;
$function$;

create function private.pet_location_nearby_alert_trigger_023()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform private.enqueue_nearby_lost_case_023(new.pet_post_id);
  return new;
end;
$function$;

create trigger pet_location_nearby_alert_023
after insert or update of exact_latitude, exact_longitude on public.pet_locations_private
for each row execute function private.pet_location_nearby_alert_trigger_023();

create function private.community_activity_badge_trigger_023()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid;
begin
  actor := coalesce(
    nullif(to_jsonb(new)->>'reporter_id', '')::uuid,
    nullif(to_jsonb(new)->>'author_id', '')::uuid,
    nullif(to_jsonb(new)->>'user_id', '')::uuid,
    nullif(to_jsonb(new)->>'profile_id', '')::uuid,
    nullif(to_jsonb(new)->>'owner_id', '')::uuid,
    nullif(to_jsonb(new)->>'id', '')::uuid
  );
  if actor is not null then
    perform private.refresh_community_badges_023(actor);
  end if;
  return new;
end;
$function$;

create trigger sightings_badges_023
after insert or update of status on public.sightings
for each row execute function private.community_activity_badge_trigger_023();

create trigger pet_posts_badges_023
after insert on public.pet_posts
for each row execute function private.community_activity_badge_trigger_023();

create trigger profiles_badges_023
after insert or update of display_name, avatar_url, bio on public.profiles
for each row execute function private.community_activity_badge_trigger_023();

create trigger profile_contacts_badges_023
after insert or update of whatsapp, public_email on public.profile_contacts
for each row execute function private.community_activity_badge_trigger_023();

do $$
begin
  if to_regclass('public.community_posts') is not null then
    execute 'create trigger community_posts_badges_023 after insert on public.community_posts for each row execute function private.community_activity_badge_trigger_023()';
  end if;
  if to_regclass('public.community_comments') is not null then
    execute 'create trigger community_comments_badges_023 after insert on public.community_comments for each row execute function private.community_activity_badge_trigger_023()';
  elsif to_regclass('public.comments') is not null then
    execute 'create trigger comments_badges_023 after insert on public.comments for each row execute function private.community_activity_badge_trigger_023()';
  end if;
end;
$$;

create function private.pet_post_resolution_trigger_023()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requester record;
begin
  if new.post_state::text = 'reunited'
     and old.post_state::text is distinct from 'reunited' then
    perform private.capture_reunion_contributors_023(new.id);
  end if;

  if new.post_state::text = 'adopted'
     and old.post_state::text is distinct from 'adopted' then
    for requester in
      select request.requester_id
      from public.adoption_requests request
      where request.pet_post_id = new.id
        and request.status::text = 'accepted'
    loop
      perform private.refresh_community_badges_023(requester.requester_id);
    end loop;
  end if;
  return new;
end;
$function$;

create trigger pet_post_resolution_023
after update of post_state on public.pet_posts
for each row execute function private.pet_post_resolution_trigger_023();

create function public.set_my_nearby_alert_preferences_v1(
  p_enabled boolean,
  p_radius_km integer,
  p_exact_latitude double precision default null,
  p_exact_longitude double precision default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  nearby_post record;
  result jsonb;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada.' using errcode = '42501';
  end if;
  if p_radius_km not in (3, 5) then
    raise exception 'El radio debe ser de 3 o 5 km.';
  end if;
  if p_enabled and (p_exact_latitude is null or p_exact_longitude is null) then
    raise exception 'Para activar alertas debes compartir un punto de referencia.';
  end if;
  if p_exact_latitude is not null and (
    p_exact_latitude not between -90 and 90
    or p_exact_longitude not between -180 and 180
  ) then
    raise exception 'La ubicacion no es valida.';
  end if;

  insert into public.nearby_alert_settings_023 (
    user_id, enabled, radius_km, exact_latitude, exact_longitude
  ) values (
    actor,
    p_enabled,
    p_radius_km,
    case when p_enabled then p_exact_latitude else null end,
    case when p_enabled then p_exact_longitude else null end
  )
  on conflict (user_id) do update
  set enabled = excluded.enabled,
      radius_km = excluded.radius_km,
      exact_latitude = excluded.exact_latitude,
      exact_longitude = excluded.exact_longitude,
      updated_at = now();

  if p_enabled then
    for nearby_post in
      select post.id
      from public.pet_posts post
      join public.pet_locations_private location on location.pet_post_id = post.id
      where post.owner_id <> actor
        and post.post_type::text = 'lost'
        and post.post_state::text in ('lost', 'sighted')
        and post.status::text = 'active'
        and post.moderation_status::text = 'visible'
        and private.distance_meters_023(
          p_exact_latitude, p_exact_longitude,
          location.exact_latitude, location.exact_longitude
        ) <= p_radius_km * 1000
    loop
      perform private.enqueue_nearby_lost_case_023(nearby_post.id);
    end loop;
  end if;

  select jsonb_build_object(
    'enabled', setting.enabled,
    'radius_km', setting.radius_km,
    'has_location', setting.exact_latitude is not null,
    'updated_at', setting.updated_at
  ) into result
  from public.nearby_alert_settings_023 setting
  where setting.user_id = actor;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    case when p_enabled then 'nearby_alerts.enabled' else 'nearby_alerts.disabled' end,
    'profile',
    actor::text,
    jsonb_build_object('radius_km', p_radius_km, 'location_history', false)
  );

  return result;
end;
$function$;

create function public.get_my_nearby_alert_preferences_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  result jsonb;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'enabled', coalesce(setting.enabled, false),
    'radius_km', coalesce(setting.radius_km, 3),
    'has_location', setting.exact_latitude is not null,
    'nearby_cases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', post.id,
        'name', post.name,
        'zone_name', post.zone_name,
        'photo_url', post.photo_paths[1],
        'distance_m', round(private.distance_meters_023(
          setting.exact_latitude, setting.exact_longitude,
          location.exact_latitude, location.exact_longitude
        ))::integer,
        'created_at', post.created_at
      ) order by private.distance_meters_023(
        setting.exact_latitude, setting.exact_longitude,
        location.exact_latitude, location.exact_longitude
      ))
      from public.pet_posts post
      join public.pet_locations_private location on location.pet_post_id = post.id
      where setting.enabled
        and post.owner_id <> actor
        and post.post_type::text = 'lost'
        and post.post_state::text in ('lost', 'sighted')
        and post.status::text = 'active'
        and post.moderation_status::text = 'visible'
        and private.distance_meters_023(
          setting.exact_latitude, setting.exact_longitude,
          location.exact_latitude, location.exact_longitude
        ) <= setting.radius_km * 1000
    ), '[]'::jsonb)
  ) into result
  from (select actor as user_id) current_user
  left join public.nearby_alert_settings_023 setting on setting.user_id = current_user.user_id;

  return result;
end;
$function$;

create function public.claim_nearby_lost_case_push_delivery_v1(p_pet_post_id uuid)
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
begin
  if coalesce((select auth.role()), '') <> 'service_role' then
    raise exception 'Funcion exclusiva del backend.' using errcode = '42501';
  end if;

  return query
  with claimed as (
    update public.nearby_case_deliveries_023 delivery
    set push_claimed_at = now()
    where delivery.pet_post_id = p_pet_post_id
      and delivery.push_claimed_at is null
      and delivery.created_at > now() - interval '24 hours'
    returning delivery.user_id
  )
  select
    subscription.endpoint,
    subscription.p256dh,
    subscription.auth,
    'Mascota perdida cerca tuyo'::text,
    (coalesce(nullif(btrim(post.name), ''), 'Una mascota') ||
      ' se perdió en ' || coalesce(nullif(btrim(post.zone_name), ''), 'tu zona') || '.')::text,
    ('/casos/' || post.id::text)::text
  from claimed
  join public.web_push_subscriptions_020 subscription
    on subscription.user_id = claimed.user_id and subscription.active
  join public.pet_posts post on post.id = p_pet_post_id;
end;
$function$;

create function public.get_community_medal_board_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', badge.id,
        'name', badge.name,
        'description', badge.description,
        'icon', badge.icon,
        'points_required', badge.points_required,
        'rule_key', rule.rule_key,
        'threshold', rule.threshold,
        'sort_order', coalesce(rule.sort_order, 1000)
      ) order by coalesce(rule.sort_order, 1000), badge.points_required, badge.name)
      from public.badges badge
      join public.badge_rules_023 rule on rule.badge_id = badge.id and rule.is_active
    ), '[]'::jsonb),
    'ranking', coalesce((
      select jsonb_agg(ranked.item order by ranked.points desc, ranked.display_name)
      from (
        select profile.points, profile.display_name,
          jsonb_build_object(
            'profile_id', profile.id,
            'display_name', profile.display_name,
            'avatar_url', profile.avatar_url,
            'points', profile.points,
            'badge_count', count(rule.badge_id)
          ) as item
        from public.profiles profile
        left join public.account_moderation moderation on moderation.user_id = profile.id
        left join public.user_badges user_badge on user_badge.profile_id = profile.id
        left join public.badge_rules_023 rule on rule.badge_id = user_badge.badge_id and rule.is_active
        where coalesce(moderation.status::text, 'active') = 'active'
        group by profile.id, profile.display_name, profile.avatar_url, profile.points, profile.created_at
        order by profile.points desc, profile.created_at
        limit 25
      ) ranked
    ), '[]'::jsonb),
    'recent_awards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profile_id', profile.id,
        'display_name', profile.display_name,
        'avatar_url', profile.avatar_url,
        'badge_id', badge.id,
        'badge_name', badge.name,
        'badge_icon', badge.icon,
        'awarded_at', user_badge.awarded_at
      ) order by user_badge.awarded_at desc)
      from (
        select * from public.user_badges order by awarded_at desc limit 20
      ) user_badge
      join public.profiles profile on profile.id = user_badge.profile_id
      join public.badges badge on badge.id = user_badge.badge_id
      join public.badge_rules_023 rule on rule.badge_id = badge.id and rule.is_active
      left join public.account_moderation moderation on moderation.user_id = profile.id
      where coalesce(moderation.status::text, 'active') = 'active'
    ), '[]'::jsonb),
    'my_profile_id', (select auth.uid()),
    'my_badge_ids', coalesce((
      select jsonb_agg(user_badge.badge_id order by user_badge.awarded_at)
      from public.user_badges user_badge
      join public.badge_rules_023 rule on rule.badge_id = user_badge.badge_id and rule.is_active
      where user_badge.profile_id = (select auth.uid())
    ), '[]'::jsonb)
  );
$function$;

create function public.get_public_community_profile_v1(p_profile_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id', profile.id,
    'display_name', profile.display_name,
    'avatar_url', profile.avatar_url,
    'bio', profile.bio,
    'role', profile.role,
    'points', profile.points,
    'created_at', profile.created_at,
    'badge_count', count(rule.badge_id),
    'badges', coalesce(jsonb_agg(jsonb_build_object(
      'id', badge.id,
      'name', badge.name,
      'description', badge.description,
      'icon', badge.icon,
      'awarded_at', user_badge.awarded_at
    ) order by user_badge.awarded_at desc) filter (where rule.badge_id is not null), '[]'::jsonb),
    'confirmed_sightings', (
      select count(*) from public.sightings sighting
      where sighting.reporter_id = profile.id and sighting.status::text = 'confirmed'
    ),
    'reunions_helped', (
      select count(distinct contribution.pet_post_id)
      from public.reunion_contributors_023 contribution
      where contribution.profile_id = profile.id
    )
  )
  from public.profiles profile
  left join public.account_moderation moderation on moderation.user_id = profile.id
  left join public.user_badges user_badge on user_badge.profile_id = profile.id
  left join public.badges badge on badge.id = user_badge.badge_id
  left join public.badge_rules_023 rule on rule.badge_id = badge.id and rule.is_active
  where profile.id = p_profile_id
    and coalesce(moderation.status::text, 'active') = 'active'
  group by profile.id, profile.display_name, profile.avatar_url, profile.bio,
           profile.role, profile.points, profile.created_at;
$function$;

create function public.get_public_reunions_v1(p_limit integer default 24)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  safe_limit integer := least(greatest(coalesce(p_limit, 24), 1), 50);
  result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', post.id,
    'name', post.name,
    'species', post.species,
    'breed', post.breed,
    'zone_name', post.zone_name,
    'photo_url', post.photo_paths[1],
    'family_name', owner.display_name,
    'reunited_at', coalesce(history.reunited_at, post.updated_at),
    'contributor_count', coalesce(contributors.contributor_count, 0)
  ) order by coalesce(history.reunited_at, post.updated_at) desc), '[]'::jsonb)
  into result
  from (
    select *
    from public.pet_posts
    where post_state::text = 'reunited'
      and moderation_status::text = 'visible'
    order by updated_at desc
    limit safe_limit
  ) post
  join public.profiles owner on owner.id = post.owner_id
  left join lateral (
    select max(status_history.created_at) as reunited_at
    from public.post_status_history status_history
    where status_history.pet_post_id = post.id
      and status_history.to_state::text = 'reunited'
  ) history on true
  left join lateral (
    select count(*)::integer as contributor_count
    from public.reunion_contributors_023 contribution
    where contribution.pet_post_id = post.id
  ) contributors on true;

  return result;
end;
$function$;

-- Recupera colaboraciones y medallas previas sin duplicar reconocimientos.
insert into public.reunion_contributors_023 (pet_post_id, profile_id, contribution_type)
select post.id, source.profile_id, min(source.contribution_type)
from public.pet_posts post
join (
  select sighting.pet_post_id, sighting.reporter_id as profile_id,
         'confirmed_sighting'::text as contribution_type
  from public.sightings sighting
  where sighting.reporter_id is not null and sighting.status::text = 'confirmed'
  union all
  select alert.pet_post_id, alert.reporter_user_id,
         'sighting_alert'::text
  from public.pet_sighting_alerts_020 alert
  where alert.reporter_user_id is not null and alert.status <> 'dismissed'
) source on source.pet_post_id = post.id and source.profile_id <> post.owner_id
where post.post_state::text = 'reunited'
group by post.id, source.profile_id
on conflict (pet_post_id, profile_id) do nothing;

do $$
declare
  profile_record record;
begin
  for profile_record in select id from public.profiles loop
    perform private.refresh_community_badges_023(profile_record.id);
  end loop;
end;
$$;

revoke all on function private.distance_meters_023(double precision,double precision,double precision,double precision) from public, anon, authenticated;
revoke all on function private.award_community_badge_023(uuid,text) from public, anon, authenticated;
revoke all on function private.refresh_community_badges_023(uuid) from public, anon, authenticated;
revoke all on function private.capture_reunion_contributors_023(uuid) from public, anon, authenticated;
revoke all on function private.enqueue_nearby_lost_case_023(uuid) from public, anon, authenticated;
revoke all on function private.pet_location_nearby_alert_trigger_023() from public, anon, authenticated;
revoke all on function private.community_activity_badge_trigger_023() from public, anon, authenticated;
revoke all on function private.pet_post_resolution_trigger_023() from public, anon, authenticated;

grant execute on function private.distance_meters_023(double precision,double precision,double precision,double precision) to service_role;
grant execute on function private.award_community_badge_023(uuid,text) to service_role;
grant execute on function private.refresh_community_badges_023(uuid) to service_role;
grant execute on function private.capture_reunion_contributors_023(uuid) to service_role;
grant execute on function private.enqueue_nearby_lost_case_023(uuid) to service_role;

revoke all on function public.set_my_nearby_alert_preferences_v1(boolean,integer,double precision,double precision) from public, anon;
grant execute on function public.set_my_nearby_alert_preferences_v1(boolean,integer,double precision,double precision) to authenticated;

revoke all on function public.get_my_nearby_alert_preferences_v1() from public, anon;
grant execute on function public.get_my_nearby_alert_preferences_v1() to authenticated;

revoke all on function public.claim_nearby_lost_case_push_delivery_v1(uuid) from public, anon, authenticated;
grant execute on function public.claim_nearby_lost_case_push_delivery_v1(uuid) to service_role;

revoke all on function public.get_community_medal_board_v1() from public;
grant execute on function public.get_community_medal_board_v1() to anon, authenticated;

revoke all on function public.get_public_community_profile_v1(uuid) from public;
grant execute on function public.get_public_community_profile_v1(uuid) to anon, authenticated;

revoke all on function public.get_public_reunions_v1(integer) from public;
grant execute on function public.get_public_reunions_v1(integer) to anon, authenticated;

insert into private.app_migrations (version, name, details)
values (
  '023',
  'medals_reunions_nearby_alerts',
  jsonb_build_object(
    'levels_exist', false,
    'criteria_badges', true,
    'confirmed_sightings_only', true,
    'public_medal_board', true,
    'public_reunions', true,
    'private_reunion_thanks', true,
    'nearby_radius_km', jsonb_build_array(3, 5),
    'location_history', false,
    'role_aware_single_login', true
  )
);

notify pgrst, 'reload schema';

commit;
