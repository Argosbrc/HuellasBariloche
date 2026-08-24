-- Huellas Bariloche - Migracion 015
-- Publicacion transaccional de casos con ImageKit y ubicacion privada.
-- Requiere migraciones 001 a 014 aprobadas.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(
  hashtextextended('huellas-bariloche:migration:015', 0)
);

do $preflight$
declare
  missing_migrations text;
  required_column record;
begin
  if to_regclass('private.app_migrations') is null then
    raise exception 'Falta private.app_migrations. Se cancela 015.';
  end if;

  select string_agg(expected.version, ', ' order by expected.version)
  into missing_migrations
  from (
    select lpad(value::text, 3, '0') as version
    from generate_series(1, 14) value
  ) expected
  where not exists (
    select 1
    from private.app_migrations applied
    where applied.version = expected.version
  );

  if missing_migrations is not null then
    raise exception 'Faltan migraciones registradas: %. Se cancela 015.', missing_migrations;
  end if;

  if exists (select 1 from private.app_migrations where version = '015') then
    raise exception 'La migracion 015 ya esta registrada. No debe repetirse.';
  end if;

  if to_regclass('private.pet_post_requests') is not null
     or to_regprocedure(
       'public.create_pet_post_v1(uuid,text,text,text,text,text,text,text,text[],text,text,text,text,text[],text,double precision,double precision,text,boolean,timestamp with time zone)'
     ) is not null then
    raise exception 'Se detectaron objetos parciales o externos reservados para 015.';
  end if;

  if to_regclass('public.pet_posts') is null
     or to_regclass('public.pet_locations_private') is null
     or to_regclass('public.external_media') is null
     or to_regclass('public.rescuer_profiles') is null
     or to_regclass('public.profile_contacts') is null
     or to_regclass('public.audit_log') is null then
    raise exception 'Faltan tablas requeridas. Se cancela 015.';
  end if;

  if to_regprocedure('private.is_active_user()') is null
     or to_regprocedure('private.is_admin()') is null
     or to_regprocedure('private.validate_pet_photo_paths_013()') is null then
    raise exception 'Faltan funciones de seguridad o multimedia requeridas.';
  end if;

  for required_column in
    select *
    from (values
      ('pet_posts', 'owner_id'),
      ('pet_posts', 'rescuer_profile_id'),
      ('pet_posts', 'post_type'),
      ('pet_posts', 'post_state'),
      ('pet_posts', 'photo_paths'),
      ('pet_posts', 'zone_name'),
      ('pet_posts', 'public_latitude'),
      ('pet_posts', 'public_longitude'),
      ('pet_posts', 'location_precision'),
      ('pet_locations_private', 'pet_post_id'),
      ('pet_locations_private', 'exact_latitude'),
      ('pet_locations_private', 'exact_longitude'),
      ('external_media', 'public_url'),
      ('external_media', 'purpose'),
      ('external_media', 'status')
    ) expected(table_name, column_name)
  loop
    if not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = required_column.table_name
        and c.column_name = required_column.column_name
    ) then
      raise exception 'Falta public.%.%. Se cancela 015.',
        required_column.table_name, required_column.column_name;
    end if;
  end loop;
end
$preflight$;

-- Una clave generada por el navegador identifica cada intento logico. Si una
-- respuesta se pierde y el cliente reintenta, la funcion devuelve el mismo caso.
create table private.pet_post_requests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  pet_post_id uuid not null unique references public.pet_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

revoke all on table private.pet_post_requests from public, anon, authenticated;
grant select, insert, update, delete on table private.pet_post_requests to service_role;

create index pet_post_requests_created_idx
  on private.pet_post_requests (created_at desc);

-- Desde 015 el alta pasa exclusivamente por la funcion transaccional. Las
-- politicas RLS se conservan como defensa adicional, pero el navegador ya no
-- puede saltear idempotencia, cuota, privacidad ni validaciones de ImageKit.
revoke insert (
  rescuer_profile_id,
  post_type,
  name,
  species,
  breed,
  sex,
  age_label,
  size_label,
  colors,
  distinctive_features,
  description,
  health_status,
  adoption_requirements,
  photo_paths,
  zone_name,
  public_latitude,
  public_longitude,
  location_precision,
  show_whatsapp,
  event_at,
  pet_id
) on table public.pet_posts from authenticated;

revoke insert (
  pet_post_id,
  exact_latitude,
  exact_longitude,
  address_notes
) on table public.pet_locations_private from authenticated;

create function public.create_pet_post_v1(
  p_request_id uuid,
  p_post_type text,
  p_name text,
  p_species text,
  p_breed text,
  p_sex text,
  p_age_label text,
  p_size_label text,
  p_colors text[],
  p_distinctive_features text,
  p_description text,
  p_health_status text,
  p_adoption_requirements text,
  p_photo_urls text[],
  p_zone_name text,
  p_exact_latitude double precision default null,
  p_exact_longitude double precision default null,
  p_address_notes text default null,
  p_show_whatsapp boolean default false,
  p_event_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  clean_type text := lower(btrim(coalesce(p_post_type, '')));
  clean_name text := nullif(btrim(coalesce(p_name, '')), '');
  clean_species text := btrim(coalesce(p_species, ''));
  clean_breed text := nullif(btrim(coalesce(p_breed, '')), '');
  clean_sex text := nullif(lower(btrim(coalesce(p_sex, ''))), '');
  clean_age text := nullif(btrim(coalesce(p_age_label, '')), '');
  clean_size text := nullif(btrim(coalesce(p_size_label, '')), '');
  clean_features text := nullif(btrim(coalesce(p_distinctive_features, '')), '');
  clean_description text := nullif(btrim(coalesce(p_description, '')), '');
  clean_health text := nullif(btrim(coalesce(p_health_status, '')), '');
  clean_requirements text := nullif(btrim(coalesce(p_adoption_requirements, '')), '');
  clean_zone text := btrim(coalesce(p_zone_name, ''));
  clean_address text := nullif(btrim(coalesce(p_address_notes, '')), '');
  clean_colors text[];
  clean_photos text[] := coalesce(p_photo_urls, '{}'::text[]);
  target_rescuer uuid;
  target_post uuid;
  prior_post uuid;
  public_lat double precision;
  public_lon double precision;
  effective_event_at timestamptz := coalesce(p_event_at, now());
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada.' using errcode = '42501';
  end if;

  if p_request_id is null then
    raise exception 'Falta el identificador seguro de la publicacion.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(actor::text || ':' || p_request_id::text, 0)
  );

  select r.pet_post_id into prior_post
  from private.pet_post_requests r
  where r.user_id = actor and r.request_id = p_request_id;

  if prior_post is not null then
    return prior_post;
  end if;

  if clean_type not in ('lost', 'found', 'adoption') then
    raise exception 'El tipo de publicacion no es valido.';
  end if;

  if clean_type in ('lost', 'adoption')
     and (clean_name is null or char_length(clean_name) not between 1 and 80) then
    raise exception 'El nombre es obligatorio para una mascota perdida o en adopcion.';
  end if;
  if clean_name is not null and char_length(clean_name) > 80 then
    raise exception 'El nombre no puede superar 80 caracteres.';
  end if;
  if char_length(clean_species) not between 2 and 40 then
    raise exception 'La especie debe tener entre 2 y 40 caracteres.';
  end if;
  if clean_breed is not null and char_length(clean_breed) > 80 then
    raise exception 'La raza no puede superar 80 caracteres.';
  end if;
  if clean_sex is not null and clean_sex not in ('male', 'female', 'unknown') then
    raise exception 'El sexo indicado no es valido.';
  end if;
  if clean_age is not null and char_length(clean_age) > 60 then
    raise exception 'La edad aproximada no puede superar 60 caracteres.';
  end if;
  if clean_size is not null and char_length(clean_size) > 40 then
    raise exception 'El tamano no puede superar 40 caracteres.';
  end if;
  if clean_features is not null and char_length(clean_features) not between 3 and 1200 then
    raise exception 'Las senas particulares deben tener entre 3 y 1200 caracteres.';
  end if;
  if clean_description is null or char_length(clean_description) not between 10 and 3000 then
    raise exception 'La descripcion debe tener entre 10 y 3000 caracteres.';
  end if;
  if clean_health is not null and char_length(clean_health) not between 2 and 1000 then
    raise exception 'El estado de salud debe tener entre 2 y 1000 caracteres.';
  end if;
  if char_length(clean_zone) not between 2 and 120 then
    raise exception 'La zona o barrio debe tener entre 2 y 120 caracteres.';
  end if;
  if clean_address is not null and char_length(clean_address) > 500 then
    raise exception 'La referencia privada no puede superar 500 caracteres.';
  end if;

  select coalesce(array_agg(color order by first_position), '{}'::text[])
  into clean_colors
  from (
    select min(item_position) as first_position, min(clean_color) as color
    from (
      select item_position, btrim(item) as clean_color
      from unnest(coalesce(p_colors, '{}'::text[]))
        with ordinality as source(item, item_position)
      where nullif(btrim(item), '') is not null
    ) normalized
    group by lower(clean_color)
  ) distinct_colors;

  if cardinality(clean_colors) > 12 then
    raise exception 'Se permiten hasta 12 colores o marcas.';
  end if;
  if exists (select 1 from unnest(clean_colors) color where char_length(color) > 40) then
    raise exception 'Cada color o marca puede tener hasta 40 caracteres.';
  end if;

  if cardinality(clean_photos) not between 1 and 4 then
    raise exception 'La publicacion requiere entre una y cuatro fotografias.';
  end if;
  if (select count(*) <> count(distinct photo) from unnest(clean_photos) photo) then
    raise exception 'No se permiten fotografias duplicadas.';
  end if;
  if exists (
    select 1
    from unnest(clean_photos) photo
    where not exists (
      select 1
      from public.external_media media
      where media.owner_id = actor
        and media.public_url = photo
        and media.purpose = 'pet_post'
        and media.status in ('uploaded', 'orphaned')
        and media.attached_entity_id is null
    )
  ) then
    raise exception 'Una fotografia no pertenece a tu cuenta o ya esta en uso.';
  end if;

  if (p_exact_latitude is null) <> (p_exact_longitude is null) then
    raise exception 'La latitud y la longitud deben enviarse juntas.';
  end if;
  if p_exact_latitude is not null then
    if p_exact_latitude not between -90 and 90
       or p_exact_longitude not between -180 and 180 then
      raise exception 'Las coordenadas no son validas.';
    end if;
    public_lat := round(p_exact_latitude::numeric, 3)::double precision;
    public_lon := round(p_exact_longitude::numeric, 3)::double precision;
  end if;

  if effective_event_at < '2010-01-01 00:00:00+00'::timestamptz
     or effective_event_at > now() + interval '10 minutes' then
    raise exception 'La fecha del hecho no es valida.';
  end if;

  if p_show_whatsapp and not exists (
    select 1
    from public.profile_contacts contacts
    where contacts.user_id = actor
      and nullif(btrim(contacts.whatsapp), '') is not null
  ) then
    raise exception 'Agrega un WhatsApp en tu perfil antes de mostrarlo en la publicacion.';
  end if;

  if not private.is_admin() and (
    select count(*)
    from public.pet_posts post
    where post.owner_id = actor
      and post.created_at >= now() - interval '24 hours'
  ) >= 10 then
    raise exception 'Alcanzaste el limite de 10 publicaciones en 24 horas.' using errcode = '54000';
  end if;

  if clean_type = 'adoption' then
    select rescuer.id into target_rescuer
    from public.rescuer_profiles rescuer
    where rescuer.user_id = actor
      and rescuer.verification_status = 'verified';

    if target_rescuer is null then
      raise exception 'Solo un rescatista verificado puede publicar adopciones.' using errcode = '42501';
    end if;
    if clean_requirements is null or char_length(clean_requirements) not between 10 and 2000 then
      raise exception 'La adopcion requiere condiciones de hogar de entre 10 y 2000 caracteres.';
    end if;
  else
    clean_requirements := null;
  end if;

  perform set_config('huellas.workflow_reason', 'Publicacion creada por su titular', true);

  insert into public.pet_posts (
    owner_id,
    rescuer_profile_id,
    post_type,
    name,
    species,
    breed,
    sex,
    age_label,
    size_label,
    colors,
    distinctive_features,
    description,
    health_status,
    adoption_requirements,
    photo_paths,
    zone_name,
    public_latitude,
    public_longitude,
    location_precision,
    show_whatsapp,
    event_at
  ) values (
    actor,
    target_rescuer,
    clean_type::public.pet_post_type,
    clean_name,
    clean_species,
    clean_breed,
    clean_sex,
    clean_age,
    clean_size,
    clean_colors,
    clean_features,
    clean_description,
    clean_health,
    clean_requirements,
    clean_photos,
    clean_zone,
    public_lat,
    public_lon,
    'approximate',
    coalesce(p_show_whatsapp, false),
    effective_event_at
  )
  returning id into target_post;

  if p_exact_latitude is not null then
    insert into public.pet_locations_private (
      pet_post_id,
      exact_latitude,
      exact_longitude,
      address_notes
    ) values (
      target_post,
      p_exact_latitude,
      p_exact_longitude,
      clean_address
    );
  end if;

  insert into private.pet_post_requests (user_id, request_id, pet_post_id)
  values (actor, p_request_id, target_post);

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    'pet_post.created',
    'pet_post',
    target_post::text,
    jsonb_build_object(
      'post_type', clean_type,
      'image_count', cardinality(clean_photos),
      'has_private_location', p_exact_latitude is not null,
      'show_whatsapp', coalesce(p_show_whatsapp, false)
    )
  );

  return target_post;
end
$function$;

revoke all on function public.create_pet_post_v1(
  uuid, text, text, text, text, text, text, text, text[], text,
  text, text, text, text[], text, double precision, double precision,
  text, boolean, timestamptz
) from public, anon;

grant execute on function public.create_pet_post_v1(
  uuid, text, text, text, text, text, text, text, text[], text,
  text, text, text, text[], text, double precision, double precision,
  text, boolean, timestamptz
) to authenticated;

comment on function public.create_pet_post_v1(
  uuid, text, text, text, text, text, text, text, text[], text,
  text, text, text, text[], text, double precision, double precision,
  text, boolean, timestamptz
) is 'Crea un caso idempotente, adjunta imagenes ImageKit propias y mantiene la ubicacion exacta fuera de las vistas publicas.';

insert into private.app_migrations (version, name, details)
values (
  '015',
  'pet_post_publishing',
  jsonb_build_object(
    'rpc', 'create_pet_post_v1',
    'idempotent_requests', true,
    'image_provider', 'imagekit',
    'images_required_min', 1,
    'images_allowed_max', 4,
    'exact_location_private', true,
    'public_location_precision_decimals', 3,
    'daily_post_limit', 10
  )
);

commit;
