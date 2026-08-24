-- Huellas Bariloche - Migracion 014
-- ImageKit como proveedor de imagenes publicas y contratos de perfil editables.
-- Requiere migraciones 001 a 013 aprobadas.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(
  hashtextextended('huellas-bariloche:migration:014', 0)
);

do $preflight$
declare
  missing_migrations text;
begin
  if to_regclass('private.app_migrations') is null then
    raise exception 'Falta private.app_migrations. Se cancela 014.';
  end if;

  select string_agg(expected.version, ', ' order by expected.version)
  into missing_migrations
  from (
    select lpad(value::text, 3, '0') as version
    from generate_series(1, 13) value
  ) expected
  where not exists (
    select 1 from private.app_migrations applied
    where applied.version = expected.version
  );

  if missing_migrations is not null then
    raise exception 'Faltan migraciones registradas: %. Se cancela 014.', missing_migrations;
  end if;

  if exists (select 1 from private.app_migrations where version = '014') then
    raise exception 'La migracion 014 ya esta registrada. No debe repetirse.';
  end if;

  if to_regclass('public.external_media') is not null
     or to_regclass('private.media_provider_config') is not null
     or to_regprocedure('public.register_imagekit_upload(text,text,text,text,bigint,integer,integer,text)') is not null
     or to_regprocedure('public.set_my_avatar(uuid)') is not null then
    raise exception 'Se detectaron objetos parciales o externos reservados para 014.';
  end if;

  if to_regclass('public.profiles') is null
     or to_regclass('public.profile_contacts') is null
     or to_regclass('public.pet_posts') is null
     or to_regclass('public.sightings') is null
     or to_regclass('public.community_media') is null
     or to_regclass('public.service_media') is null
     or to_regclass('public.pet_media') is null
     or to_regclass('public.rescuer_campaigns') is null then
    raise exception 'Faltan tablas requeridas. Se cancela 014.';
  end if;

  -- El cambio se realiza antes de habilitar publicaciones reales. Si ya hubiera
  -- imagenes, deben migrarse de forma asistida para no dejar referencias rotas.
  if exists (select 1 from public.pet_posts where cardinality(photo_paths) > 0)
     or exists (select 1 from public.sightings where cardinality(photo_paths) > 0)
     or exists (select 1 from public.community_media)
     or exists (select 1 from public.service_media)
     or exists (select 1 from public.pet_media)
     or exists (select 1 from public.rescuer_campaigns where cover_image_path is not null) then
    raise exception 'Ya existen imagenes publicas. Se requiere migracion asistida antes de aplicar 014.';
  end if;
end
$preflight$;

create table private.media_provider_config (
  singleton boolean primary key default true check (singleton),
  provider text not null default 'imagekit' check (provider = 'imagekit'),
  url_endpoint text,
  enabled boolean not null default false,
  configured_by uuid references public.profiles(id) on delete set null,
  configured_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint media_provider_endpoint_consistency check (
    (enabled and url_endpoint is not null and configured_at is not null)
    or (not enabled)
  ),
  constraint media_provider_endpoint_https check (
    url_endpoint is null
    or url_endpoint ~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9_-]+)?$'
  )
);

insert into private.media_provider_config (singleton) values (true);
revoke all on table private.media_provider_config from public, anon, authenticated;
grant select, insert, update, delete on table private.media_provider_config to service_role;

create table public.external_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'imagekit',
  provider_file_id text not null unique,
  file_path text not null unique,
  public_url text not null unique,
  purpose text not null,
  mime_type text not null,
  byte_size bigint not null,
  width integer not null,
  height integer not null,
  status text not null default 'uploaded',
  attached_entity_type text,
  attached_entity_id uuid,
  attached_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_media_provider_imagekit check (provider = 'imagekit'),
  constraint external_media_file_id_safe check (
    char_length(provider_file_id) between 6 and 200
    and provider_file_id ~ '^[A-Za-z0-9_-]+$'
  ),
  constraint external_media_path_safe check (
    file_path = btrim(file_path)
    and left(file_path, 1) = '/'
    and position('..' in file_path) = 0
    and lower(file_path) ~ '\.webp$'
    and char_length(file_path) between 40 and 500
  ),
  constraint external_media_url_safe check (
    public_url = btrim(public_url)
    and public_url ~ '^https://'
    and position('..' in public_url) = 0
    and lower(public_url) ~ '\.webp$'
    and char_length(public_url) between 50 and 1000
  ),
  constraint external_media_purpose_allowed check (
    purpose in ('avatar', 'pet_post', 'sighting', 'community', 'service', 'campaign')
  ),
  constraint external_media_webp_only check (mime_type = 'image/webp'),
  constraint external_media_size_limit check (byte_size between 1 and 1048576),
  constraint external_media_dimensions check (
    width between 1 and 1600 and height between 1 and 1600
  ),
  constraint external_media_status_allowed check (
    status in ('uploaded', 'attached', 'orphaned', 'deleted')
  ),
  constraint external_media_attachment_consistency check (
    (status = 'attached' and attached_entity_type is not null and attached_entity_id is not null and attached_at is not null)
    or (status <> 'attached')
  ),
  constraint external_media_entity_type_allowed check (
    attached_entity_type is null
    or attached_entity_type in ('profile', 'pet_posts', 'sightings', 'community_posts', 'services', 'rescuer_campaigns')
  )
);

create index external_media_owner_created_idx
  on public.external_media (owner_id, created_at desc);
create index external_media_pending_idx
  on public.external_media (owner_id, status, created_at)
  where status in ('uploaded', 'orphaned');
create index external_media_entity_idx
  on public.external_media (attached_entity_type, attached_entity_id)
  where attached_entity_id is not null;

create trigger external_media_set_updated_at
before update on public.external_media
for each row execute procedure private.set_updated_at();

alter table public.external_media enable row level security;
revoke all on table public.external_media from anon, authenticated;
grant select on table public.external_media to authenticated;
grant select, insert, update, delete on table public.external_media to service_role;

create policy "Multimedia externa propia o administrativa"
on public.external_media for select
to authenticated
using (owner_id = (select auth.uid()) or private.is_admin());

create function public.get_media_provider_configuration()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'provider', 'imagekit',
    'configured', c.enabled and c.url_endpoint is not null,
    'url_endpoint', c.url_endpoint
  )
  from private.media_provider_config c
  where c.singleton;
$function$;

revoke all on function public.get_media_provider_configuration() from public;
grant execute on function public.get_media_provider_configuration()
  to anon, authenticated, service_role;

create function public.admin_configure_imagekit(p_url_endpoint text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  clean_endpoint text := regexp_replace(btrim(coalesce(p_url_endpoint, '')), '/+$', '');
begin
  if not private.is_admin() then
    raise exception 'Solo administracion puede configurar ImageKit.' using errcode = '42501';
  end if;

  if clean_endpoint !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9_-]+)?$' then
    raise exception 'El URL endpoint de ImageKit no es valido.';
  end if;

  update private.media_provider_config
  set url_endpoint = clean_endpoint,
      enabled = true,
      configured_by = actor,
      configured_at = now(),
      updated_at = now()
  where singleton;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    'media_provider.configured',
    'media_provider',
    'imagekit',
    jsonb_build_object('url_endpoint', clean_endpoint)
  );

  return jsonb_build_object('provider', 'imagekit', 'configured', true, 'url_endpoint', clean_endpoint);
end
$function$;

revoke all on function public.admin_configure_imagekit(text) from public, anon;
grant execute on function public.admin_configure_imagekit(text) to authenticated;

create function public.authorize_imagekit_upload(p_purpose text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  clean_purpose text := lower(btrim(coalesce(p_purpose, '')));
  config private.media_provider_config%rowtype;
  pending_count integer;
  daily_count integer;
begin
  if current_user_id is null or not private.is_active_user() then
    return jsonb_build_object('allowed', false, 'reason', 'Debes iniciar sesion con una cuenta habilitada.');
  end if;

  if clean_purpose not in ('avatar', 'pet_post', 'sighting', 'community', 'service', 'campaign') then
    return jsonb_build_object('allowed', false, 'reason', 'Destino multimedia no permitido.');
  end if;

  if clean_purpose = 'service' and not private.is_admin() then
    return jsonb_build_object('allowed', false, 'reason', 'Solo administracion puede cargar imagenes de la guia.');
  end if;

  select * into config from private.media_provider_config where singleton;
  if not config.enabled or config.url_endpoint is null then
    return jsonb_build_object('allowed', false, 'reason', 'ImageKit todavia no esta configurado.');
  end if;

  select count(*) into pending_count
  from public.external_media e
  where e.owner_id = current_user_id
    and e.status in ('uploaded', 'orphaned');

  select count(*) into daily_count
  from public.external_media e
  where e.owner_id = current_user_id
    and e.created_at >= now() - interval '24 hours';

  if pending_count >= 20 then
    return jsonb_build_object('allowed', false, 'reason', 'Hay demasiadas imagenes sin adjuntar.');
  end if;

  if daily_count >= 40 then
    return jsonb_build_object('allowed', false, 'reason', 'Se alcanzo el limite diario de imagenes.');
  end if;

  return jsonb_build_object(
    'allowed', true,
    'provider', 'imagekit',
    'url_endpoint', config.url_endpoint,
    'max_image_bytes', 1048576,
    'max_dimension_px', 1600,
    'remaining_today', 40 - daily_count
  );
end
$function$;

revoke all on function public.authorize_imagekit_upload(text) from public, anon;
grant execute on function public.authorize_imagekit_upload(text) to authenticated;

create function public.register_imagekit_upload(
  p_provider_file_id text,
  p_file_path text,
  p_public_url text,
  p_purpose text,
  p_byte_size bigint,
  p_width integer,
  p_height integer,
  p_mime_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  clean_file_id text := btrim(coalesce(p_provider_file_id, ''));
  clean_path text := btrim(coalesce(p_file_path, ''));
  clean_url text := btrim(coalesce(p_public_url, ''));
  clean_purpose text := lower(btrim(coalesce(p_purpose, '')));
  clean_mime text := lower(btrim(coalesce(p_mime_type, '')));
  config jsonb;
  media_id uuid;
begin
  config := public.authorize_imagekit_upload(clean_purpose);
  if not coalesce((config ->> 'allowed')::boolean, false) then
    raise exception '%', coalesce(config ->> 'reason', 'Carga no autorizada');
  end if;

  if clean_file_id !~ '^[A-Za-z0-9_-]{6,200}$' then
    raise exception 'El identificador de ImageKit no es valido.';
  end if;

  if clean_path !~ (
    '^/huellas/' || current_user_id::text || '/' || clean_purpose ||
    '/[A-Za-z0-9._-]+\.webp$'
  ) then
    raise exception 'La ruta de ImageKit no corresponde al usuario y destino autenticados.';
  end if;

  if clean_url not like ((config ->> 'url_endpoint') || '/%')
     or clean_url !~ '\.webp$'
     or position('?' in clean_url) > 0
     or position('#' in clean_url) > 0 then
    raise exception 'La URL publica no pertenece al endpoint configurado.';
  end if;

  if clean_mime <> 'image/webp'
     or p_byte_size not between 1 and 1048576
     or p_width not between 1 and 1600
     or p_height not between 1 and 1600 then
    raise exception 'La imagen no cumple la politica multimedia 014.';
  end if;

  insert into public.external_media (
    owner_id, provider_file_id, file_path, public_url, purpose,
    mime_type, byte_size, width, height
  ) values (
    current_user_id, clean_file_id, clean_path, clean_url, clean_purpose,
    clean_mime, p_byte_size, p_width, p_height
  )
  returning id into media_id;

  return media_id;
end
$function$;

revoke all on function public.register_imagekit_upload(text,text,text,text,bigint,integer,integer,text)
  from public, anon;
grant execute on function public.register_imagekit_upload(text,text,text,text,bigint,integer,integer,text)
  to authenticated;

create function public.set_my_avatar(p_media_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  media public.external_media%rowtype;
begin
  if current_user_id is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada.';
  end if;

  select * into media
  from public.external_media e
  where e.id = p_media_id
    and e.owner_id = current_user_id
    and e.purpose = 'avatar'
    and e.status in ('uploaded', 'orphaned')
  for update;

  if not found then
    raise exception 'La imagen de perfil no existe o ya esta en uso.';
  end if;

  update public.external_media
  set status = 'orphaned',
      attached_entity_type = null,
      attached_entity_id = null,
      attached_at = null
  where owner_id = current_user_id
    and purpose = 'avatar'
    and status = 'attached'
    and id <> media.id;

  update public.profiles
  set avatar_url = media.public_url,
      updated_at = now()
  where id = current_user_id;

  update public.external_media
  set status = 'attached',
      attached_entity_type = 'profile',
      attached_entity_id = current_user_id,
      attached_at = now()
  where id = media.id;

  return media.public_url;
end
$function$;

revoke all on function public.set_my_avatar(uuid) from public, anon;
grant execute on function public.set_my_avatar(uuid) to authenticated;

create function public.discard_imagekit_upload(p_media_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  discarded_file_id text;
begin
  update public.external_media e
  set status = 'deleted',
      attached_entity_type = null,
      attached_entity_id = null,
      attached_at = null
  where e.id = p_media_id
    and (e.owner_id = current_user_id or private.is_admin())
    and e.status in ('uploaded', 'orphaned')
  returning e.provider_file_id into discarded_file_id;

  if discarded_file_id is null then
    raise exception 'La imagen no puede descartarse.';
  end if;
  return discarded_file_id;
end
$function$;

revoke all on function public.discard_imagekit_upload(uuid) from public, anon;
grant execute on function public.discard_imagekit_upload(uuid) to authenticated;

create function public.update_my_profile(
  p_display_name text,
  p_bio text,
  p_city_id uuid,
  p_whatsapp text,
  p_public_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  clean_name text := btrim(coalesce(p_display_name, ''));
  clean_bio text := nullif(btrim(coalesce(p_bio, '')), '');
  clean_whatsapp text := nullif(btrim(coalesce(p_whatsapp, '')), '');
  clean_email text := nullif(lower(btrim(coalesce(p_public_email, ''))), '');
begin
  if current_user_id is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada.';
  end if;

  if char_length(clean_name) not between 2 and 60 then
    raise exception 'El nombre debe tener entre 2 y 60 caracteres.';
  end if;
  if clean_bio is not null and char_length(clean_bio) > 500 then
    raise exception 'La biografia admite hasta 500 caracteres.';
  end if;
  if clean_whatsapp is not null and char_length(clean_whatsapp) not between 7 and 30 then
    raise exception 'El WhatsApp debe tener entre 7 y 30 caracteres.';
  end if;
  if clean_email is not null and (char_length(clean_email) > 254 or clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'El correo publico no es valido.';
  end if;
  if not exists (select 1 from public.cities c where c.id = p_city_id and c.is_active) then
    raise exception 'La ciudad indicada no esta habilitada.';
  end if;

  update public.profiles
  set display_name = clean_name,
      bio = clean_bio,
      city_id = p_city_id,
      updated_at = now()
  where id = current_user_id;

  insert into public.profile_contacts (user_id, whatsapp, public_email)
  values (current_user_id, clean_whatsapp, clean_email)
  on conflict (user_id) do update
  set whatsapp = excluded.whatsapp,
      public_email = excluded.public_email,
      updated_at = now();
end
$function$;

revoke all on function public.update_my_profile(text,text,uuid,text,text) from public, anon;
grant execute on function public.update_my_profile(text,text,uuid,text,text) to authenticated;

-- Las columnas historicas conservan su nombre para no romper las vistas 012,
-- pero desde 014 almacenan exclusivamente URL publicas de ImageKit.
alter table public.pet_media
  drop constraint pet_media_storage_path_only;
alter table public.pet_media
  add constraint pet_media_imagekit_url_014 check (
    storage_path = btrim(storage_path)
    and storage_path ~ '^https://'
    and lower(storage_path) ~ '\.webp$'
    and position('..' in storage_path) = 0
  );

alter table public.community_media
  drop constraint community_media_storage_path_safe;
alter table public.community_media
  add constraint community_media_imagekit_url_014 check (
    storage_path = btrim(storage_path)
    and storage_path ~ '^https://'
    and lower(storage_path) ~ '\.webp$'
    and position('..' in storage_path) = 0
    and char_length(storage_path) between 50 and 1000
  );

alter table public.service_media
  drop constraint service_media_image_path_required;
alter table public.service_media
  add constraint service_media_imagekit_url_014 check (
    object_path = btrim(object_path)
    and object_path ~ '^https://'
    and lower(object_path) ~ '\.webp$'
    and position('..' in object_path) = 0
    and char_length(object_path) between 50 and 1000
  );

alter table public.rescuer_campaigns
  drop constraint rescuer_campaigns_cover_path_safe,
  drop constraint rescuer_campaigns_cover_path_length;
alter table public.rescuer_campaigns
  add constraint rescuer_campaigns_cover_imagekit_014 check (
    cover_image_path is null
    or (
      cover_image_path = btrim(cover_image_path)
      and cover_image_path ~ '^https://'
      and lower(cover_image_path) ~ '\.webp$'
      and position('..' in cover_image_path) = 0
      and char_length(cover_image_path) between 50 and 1000
    )
  );

create or replace function public.create_rescuer_campaign(
  p_campaign_type public.rescuer_campaign_type,
  p_title text,
  p_description text,
  p_zone_name text default null,
  p_cover_image_path text default null,
  p_support_method_id uuid default null,
  p_ends_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  target_rescuer uuid;
  target_city uuid;
  campaign_id uuid;
  clean_cover text := nullif(btrim(coalesce(p_cover_image_path, '')), '');
begin
  if current_user_id is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 5 and 120
     or char_length(btrim(coalesce(p_description, ''))) not between 10 and 3000 then
    raise exception 'El titulo o la descripcion tienen una longitud invalida';
  end if;
  if p_zone_name is not null and char_length(btrim(p_zone_name)) not between 2 and 120 then
    raise exception 'La zona debe tener entre 2 y 120 caracteres';
  end if;
  if p_ends_at is not null and p_ends_at <= now() then
    raise exception 'La fecha de cierre debe ser futura';
  end if;

  select r.id, r.city_id into target_rescuer, target_city
  from public.rescuer_profiles r
  where r.user_id = current_user_id and r.verification_status = 'verified';
  if target_rescuer is null then
    raise exception 'Solo un rescatista verificado puede crear campanas';
  end if;

  if clean_cover is not null and not exists (
    select 1 from public.external_media e
    where e.owner_id = current_user_id
      and e.public_url = clean_cover
      and e.purpose = 'campaign'
      and e.status in ('uploaded', 'orphaned')
  ) then
    raise exception 'La portada no esta registrada en ImageKit para este rescatista';
  end if;

  if p_support_method_id is not null and not exists (
    select 1 from public.rescuer_support_methods s
    where s.id = p_support_method_id
      and s.rescuer_profile_id = target_rescuer
      and s.status = 'verified'
  ) then
    raise exception 'El metodo de apoyo no pertenece al rescatista o no esta verificado';
  end if;
  if p_campaign_type = 'fundraising' and p_support_method_id is null then
    raise exception 'Una campana economica requiere un metodo externo verificado';
  end if;

  perform set_config('huellas.workflow_reason', 'Campana creada por un rescatista verificado', true);
  insert into public.rescuer_campaigns (
    rescuer_profile_id, city_id, campaign_type, title, description,
    zone_name, cover_image_path, support_method_id, ends_at
  ) values (
    target_rescuer, target_city, p_campaign_type, btrim(p_title),
    btrim(p_description), nullif(btrim(p_zone_name), ''), clean_cover,
    p_support_method_id, p_ends_at
  ) returning id into campaign_id;

  if clean_cover is not null then
    update public.external_media
    set status = 'attached', attached_entity_type = 'rescuer_campaigns',
        attached_entity_id = campaign_id, attached_at = now()
    where owner_id = current_user_id and public_url = clean_cover;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    current_user_id, 'rescuer_campaign.created', 'rescuer_campaign',
    campaign_id::text, jsonb_build_object('campaign_type', p_campaign_type)
  );
  return campaign_id;
end
$function$;

create or replace function private.validate_pet_photo_paths_013()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_user uuid;
  target_paths text[];
  expected_purpose text;
  target_path text;
begin
  if tg_table_schema <> 'public' then
    raise exception 'Origen multimedia no permitido.';
  end if;

  if tg_table_name = 'pet_posts' then
    target_user := new.owner_id;
    target_paths := coalesce(new.photo_paths, '{}'::text[]);
    expected_purpose := 'pet_post';
  elsif tg_table_name = 'sightings' then
    target_user := new.reporter_id;
    target_paths := coalesce(new.photo_paths, '{}'::text[]);
    expected_purpose := 'sighting';
  else
    raise exception 'Tabla multimedia no permitida.';
  end if;

  if cardinality(target_paths) > 4 then
    raise exception 'Cada publicacion admite hasta cuatro imagenes.';
  end if;
  if target_user is null and cardinality(target_paths) > 0 then
    raise exception 'Las imagenes requieren una cuenta autenticada.';
  end if;
  if (select count(*) <> count(distinct path) from unnest(target_paths) uploaded(path)) then
    raise exception 'No se permiten imagenes duplicadas.';
  end if;

  foreach target_path in array target_paths loop
    if not exists (
      select 1 from public.external_media e
      where e.public_url = target_path
        and e.owner_id = target_user
        and e.purpose = expected_purpose
        and e.status in ('uploaded', 'attached')
        and (
          e.attached_entity_id is null
          or (e.attached_entity_type = tg_table_name and e.attached_entity_id = new.id)
        )
    ) then
      raise exception 'Una imagen no pertenece al usuario o no esta disponible para esta publicacion.';
    end if;
  end loop;

  update public.external_media e
  set status = 'orphaned', attached_entity_type = null,
      attached_entity_id = null, attached_at = null
  where e.attached_entity_type = tg_table_name
    and e.attached_entity_id = new.id
    and not (e.public_url = any(target_paths));

  update public.external_media e
  set status = 'attached', attached_entity_type = tg_table_name,
      attached_entity_id = new.id, attached_at = now()
  where e.owner_id = target_user
    and e.public_url = any(target_paths);

  return new;
end
$function$;

create or replace function private.validate_community_media_013()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_author uuid;
  excluded_media_id uuid;
begin
  select p.author_id into target_author
  from public.community_posts p
  where p.id = new.post_id
  for update;

  if not found then raise exception 'La publicacion comunitaria no existe.'; end if;
  if tg_op = 'UPDATE' then excluded_media_id := old.id; end if;

  if (select count(*) from public.community_media m
      where m.post_id = new.post_id and (excluded_media_id is null or m.id <> excluded_media_id)) >= 4 then
    raise exception 'Cada publicacion admite hasta cuatro imagenes.';
  end if;

  if not exists (
    select 1 from public.external_media e
    where e.public_url = new.storage_path
      and e.owner_id = target_author
      and e.purpose = 'community'
      and e.status in ('uploaded', 'attached')
      and e.byte_size = new.byte_size
      and e.width = new.width
      and e.height = new.height
      and e.mime_type = new.mime_type
      and (e.attached_entity_id is null or e.attached_entity_id = new.post_id)
  ) then
    raise exception 'La imagen comunitaria no esta registrada en ImageKit.';
  end if;

  update public.external_media e
  set status = 'attached', attached_entity_type = 'community_posts',
      attached_entity_id = new.post_id, attached_at = now()
  where e.public_url = new.storage_path;

  return new;
end
$function$;

create or replace function private.validate_service_media()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  excluded_media_id uuid;
begin
  perform 1 from public.services s where s.id = new.service_id for update;
  if not found then raise exception 'El servicio indicado no existe.'; end if;
  if not private.is_admin() then raise exception 'Solo administracion puede adjuntar imagenes de servicios.'; end if;
  if tg_op = 'UPDATE' then excluded_media_id := old.id; end if;

  if (select count(*) from public.service_media sm
      where sm.service_id = new.service_id and (excluded_media_id is null or sm.id <> excluded_media_id)) >= 4 then
    raise exception 'Cada servicio admite como maximo cuatro imagenes.';
  end if;

  if not exists (
    select 1 from public.external_media e
    where e.public_url = new.object_path
      and e.owner_id = (select auth.uid())
      and e.purpose = 'service'
      and e.status in ('uploaded', 'attached')
      and e.byte_size = new.byte_size
      and e.width = new.width
      and e.height = new.height
      and e.mime_type = new.mime_type
      and (e.attached_entity_id is null or e.attached_entity_id = new.service_id)
  ) then
    raise exception 'La imagen del servicio no esta registrada en ImageKit.';
  end if;

  update public.external_media e
  set status = 'attached', attached_entity_type = 'services',
      attached_entity_id = new.service_id, attached_at = now()
  where e.public_url = new.object_path;

  return new;
end
$function$;

create or replace function public.attach_community_image(
  target_post uuid,
  p_storage_path text,
  p_alt_text text,
  p_width integer,
  p_height integer,
  p_byte_size bigint,
  p_mime_type text,
  p_position smallint default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  target_author uuid;
  target_status text;
  final_position smallint;
  new_media_id uuid;
begin
  if current_user_id is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada';
  end if;

  select p.author_id, p.moderation_status::text into target_author, target_status
  from public.community_posts p where p.id = target_post for update;
  if not found then raise exception 'La publicacion comunitaria no existe'; end if;
  if target_author <> current_user_id then raise exception 'Solo el autor puede adjuntar fotografias'; end if;
  if target_status = 'removed' then raise exception 'No se pueden adjuntar fotografias a una publicacion eliminada'; end if;

  if (select count(*) from public.community_media m where m.post_id = target_post) >= 4 then
    raise exception 'Cada publicacion admite hasta cuatro fotografias';
  end if;

  if p_position is null then
    select coalesce(max(m.position) + 1, 0)::smallint into final_position
    from public.community_media m where m.post_id = target_post;
  else
    final_position := p_position;
  end if;
  if final_position not between 0 and 3 then raise exception 'La posicion debe estar entre 0 y 3'; end if;

  insert into public.community_media (
    post_id, storage_path, mime_type, byte_size, width, height, position, alt_text
  ) values (
    target_post, btrim(p_storage_path), lower(btrim(p_mime_type)), p_byte_size,
    p_width, p_height, final_position, btrim(p_alt_text)
  ) returning id into new_media_id;

  return new_media_id;
end
$function$;

create function private.detach_external_media_014()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  removed_url text;
begin
  if tg_table_name = 'community_media' then removed_url := old.storage_path;
  elsif tg_table_name = 'service_media' then removed_url := old.object_path;
  else return old;
  end if;

  update public.external_media
  set status = 'orphaned', attached_entity_type = null,
      attached_entity_id = null, attached_at = null
  where public_url = removed_url and status = 'attached';
  return old;
end
$function$;

revoke all on function private.detach_external_media_014() from public, anon, authenticated;

create trigger community_media_detach_external_014
after delete on public.community_media
for each row execute function private.detach_external_media_014();

create trigger service_media_detach_external_014
after delete on public.service_media
for each row execute function private.detach_external_media_014();

create or replace function public.get_media_upload_policy()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'version', '014',
    'provider', 'imagekit',
    'provider_configured', c.enabled and c.url_endpoint is not null,
    'url_endpoint', c.url_endpoint,
    'max_image_bytes', 1048576,
    'max_dimension_px', 1600,
    'max_images_per_publication', 4,
    'output_mime_type', 'image/webp',
    'accepted_input_mime_types', jsonb_build_array(
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
    ),
    'claim_evidence_max_bytes', 5242880,
    'claim_evidence_allows_pdf', true
  )
  from private.media_provider_config c where c.singleton;
$function$;

revoke all on function public.get_media_upload_policy() from public;
grant execute on function public.get_media_upload_policy() to anon, authenticated, service_role;

insert into private.app_migrations (version, name, details)
values (
  '014',
  'imagekit_and_role_panels',
  jsonb_build_object(
    'public_image_provider', 'imagekit',
    'provider_requires_admin_configuration', true,
    'image_max_bytes', 1048576,
    'image_max_dimension_px', 1600,
    'images_per_publication', 4,
    'profile_update_rpc', true,
    'claim_evidence_remains_in_supabase', true
  )
);

notify pgrst, 'reload schema';

commit;
