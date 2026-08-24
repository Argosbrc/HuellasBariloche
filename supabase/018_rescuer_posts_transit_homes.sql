-- Huellas Bariloche
-- Migracion 018: publicacion rescatista robusta y hogares de transito.
-- Requiere 001 a 017. Es transaccional: ante un error no deja cambios parciales.

begin;

select pg_advisory_xact_lock(
  hashtextextended('huellas-bariloche:migration:018', 0)
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
    '010','011','012','013','014','015','016','017'
  ]::text[]) required(version)
  where not exists (
    select 1 from private.app_migrations migration
    where migration.version = required.version
  );

  if missing_migrations is not null then
    raise exception 'Faltan migraciones requeridas: %', missing_migrations;
  end if;

  if exists (select 1 from private.app_migrations where version = '018')
     or to_regclass('public.transit_campaign_details_018') is not null
     or to_regclass('public.transit_offer_details_018') is not null
     or to_regclass('public.api_transit_requests_v1') is not null
     or to_regprocedure('public.create_pet_post_v2(uuid,text,text,text,text,text,text,text,text[],text,text,text,text,text[],text,double precision,double precision,text,boolean,timestamp with time zone,boolean,text)') is not null then
    raise exception 'La migracion 018 ya fue aplicada o existe parcialmente. No debe ejecutarse nuevamente.';
  end if;

  if to_regclass('public.pet_posts') is null
     or to_regclass('public.adoption_details') is null
     or to_regclass('public.rescuer_campaigns') is null
     or to_regclass('public.campaign_help_offers') is null
     or to_regclass('public.external_media') is null
     or to_regclass('public.notifications') is null
     or to_regclass('public.profile_contacts') is null
     or to_regclass('public.rescuer_profiles') is null
     or to_regclass('private.pet_post_requests') is null then
    raise exception 'Faltan tablas requeridas para publicaciones y hogares de transito.';
  end if;

  if to_regprocedure('private.is_active_user()') is null
     or to_regprocedure('private.is_admin()') is null
     or to_regprocedure('private.validate_pet_photo_paths_013()') is null then
    raise exception 'Faltan funciones de seguridad requeridas.';
  end if;
end;
$$;

-- Estos campos son opcionales por contrato. Perdidos y encontrados siguen
-- siendo validados como obligatorios dentro de create_pet_post_v2.
alter table public.pet_posts alter column distinctive_features drop not null;
alter table public.pet_posts alter column zone_name drop not null;
alter table public.pet_posts alter column event_at drop not null;

alter table public.adoption_details
  drop constraint if exists adoption_details_requirements_length;
alter table public.adoption_details
  add constraint adoption_details_requirements_length
  check (
    home_requirements is null
    or char_length(trim(home_requirements)) between 3 and 2000
  );

create table public.transit_campaign_details_018 (
  campaign_id uuid primary key
    references public.rescuer_campaigns(id) on delete cascade,
  pet_post_id uuid not null unique
    references public.pet_posts(id) on delete cascade,
  requirements text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transit_campaign_requirements_length_018
    check (char_length(trim(requirements)) between 10 and 1200)
);

comment on table public.transit_campaign_details_018 is
  'Vincula una campaña de tránsito con la publicación de adopción que necesita hogar temporal.';

create table public.transit_offer_details_018 (
  offer_id uuid primary key
    references public.campaign_help_offers(id) on delete cascade,
  home_zone text,
  availability text not null,
  has_dogs boolean,
  has_cats boolean,
  has_children boolean,
  contact_whatsapp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transit_offer_zone_length_018
    check (home_zone is null or char_length(trim(home_zone)) between 2 and 120),
  constraint transit_offer_availability_length_018
    check (char_length(trim(availability)) between 3 and 200),
  constraint transit_offer_whatsapp_length_018
    check (contact_whatsapp is null or char_length(trim(contact_whatsapp)) between 7 and 30)
);

comment on table public.transit_offer_details_018 is
  'Datos privados de una oferta de hogar de tránsito, visibles solo para sus partes mediante funciones controladas.';

alter table public.transit_campaign_details_018 enable row level security;
alter table public.transit_offer_details_018 enable row level security;

revoke all on table public.transit_campaign_details_018 from public, anon, authenticated;
revoke all on table public.transit_offer_details_018 from public, anon, authenticated;
grant select, insert, update, delete on table public.transit_campaign_details_018 to service_role;
grant select, insert, update, delete on table public.transit_offer_details_018 to service_role;

create view public.api_transit_requests_v1
with (security_barrier = true)
as
select
  campaign.id,
  details.pet_post_id,
  campaign.rescuer_profile_id,
  rescuer.organization_name,
  profile.display_name as rescuer_name,
  city.name as city_name,
  campaign.title,
  campaign.description,
  coalesce(campaign.zone_name, post.zone_name) as zone_name,
  details.requirements,
  post.name as pet_name,
  post.species,
  post.breed,
  post.sex,
  post.age_label,
  post.size_label,
  post.photo_paths,
  case
    when cardinality(post.photo_paths) > 0 then post.photo_paths[1]
    else null
  end as cover_image_url,
  campaign.ends_at,
  campaign.created_at,
  (
    select count(*)::integer
    from public.campaign_help_offers offer
    where offer.campaign_id = campaign.id
      and offer.status = 'pending'
  ) as pending_offer_count
from public.rescuer_campaigns campaign
join public.transit_campaign_details_018 details
  on details.campaign_id = campaign.id
join public.pet_posts post on post.id = details.pet_post_id
join public.rescuer_profiles rescuer on rescuer.id = campaign.rescuer_profile_id
join public.profiles profile on profile.id = rescuer.user_id
join public.cities city on city.id = campaign.city_id
where campaign.campaign_type = 'transit'
  and campaign.status = 'active'
  and campaign.moderation_status = 'visible'
  and rescuer.verification_status = 'verified'
  and post.post_type = 'adoption'
  and post.post_state = 'available'
  and post.moderation_status = 'visible';

revoke all on table public.api_transit_requests_v1 from public;
grant select on table public.api_transit_requests_v1 to anon, authenticated;

create function public.create_pet_post_v2(
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
  p_event_at timestamptz default null,
  p_needs_transit boolean default false,
  p_transit_requirements text default null
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
  clean_transit text := nullif(btrim(coalesce(p_transit_requirements, '')), '');
  clean_zone text := nullif(btrim(coalesce(p_zone_name, '')), '');
  clean_address text := nullif(btrim(coalesce(p_address_notes, '')), '');
  clean_colors text[];
  clean_photos text[] := coalesce(p_photo_urls, '{}'::text[]);
  target_rescuer uuid;
  target_city uuid;
  target_post uuid;
  target_campaign uuid;
  prior_post uuid;
  public_lat double precision;
  public_lon double precision;
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

  select request.pet_post_id into prior_post
  from private.pet_post_requests request
  where request.user_id = actor and request.request_id = p_request_id;

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

  if clean_type in ('lost', 'found') then
    if clean_zone is null or char_length(clean_zone) not between 2 and 120 then
      raise exception 'La zona o barrio es obligatoria para animales perdidos o encontrados.';
    end if;
    if p_event_at is null then
      raise exception 'La fecha y hora son obligatorias para animales perdidos o encontrados.';
    end if;
  elsif clean_zone is not null and char_length(clean_zone) not between 2 and 120 then
    raise exception 'La zona debe tener entre 2 y 120 caracteres.';
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

  if p_event_at is not null and (
    p_event_at < '2010-01-01 00:00:00+00'::timestamptz
    or p_event_at > now() + interval '10 minutes'
  ) then
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
    select rescuer.id, rescuer.city_id
    into target_rescuer, target_city
    from public.rescuer_profiles rescuer
    where rescuer.user_id = actor
      and rescuer.verification_status = 'verified';

    if target_rescuer is null then
      raise exception 'Solo un rescatista verificado puede publicar adopciones.' using errcode = '42501';
    end if;
    if clean_requirements is null or char_length(clean_requirements) not between 10 and 2000 then
      raise exception 'La adopcion requiere condiciones de hogar de entre 10 y 2000 caracteres.';
    end if;
    if coalesce(p_needs_transit, false)
       and (clean_transit is null or char_length(clean_transit) not between 10 and 1200) then
      raise exception 'Explica que hogar de transito necesita entre 10 y 1200 caracteres.';
    end if;
  else
    if coalesce(p_needs_transit, false) then
      raise exception 'La busqueda de transito solo puede asociarse a una publicacion de adopcion.';
    end if;
    clean_requirements := null;
    clean_transit := null;
  end if;

  perform set_config('huellas.workflow_reason', 'Publicacion creada por su titular', true);

  insert into public.pet_posts (
    owner_id, rescuer_profile_id, post_type, name, species, breed, sex,
    age_label, size_label, colors, distinctive_features, description,
    health_status, adoption_requirements, photo_paths, zone_name,
    public_latitude, public_longitude, location_precision, show_whatsapp,
    event_at
  ) values (
    actor, target_rescuer, clean_type::public.pet_post_type, clean_name,
    clean_species, clean_breed, clean_sex, clean_age, clean_size, clean_colors,
    clean_features, clean_description, clean_health, clean_requirements,
    clean_photos, clean_zone, public_lat, public_lon, 'approximate',
    coalesce(p_show_whatsapp, false), p_event_at
  )
  returning id into target_post;

  if p_exact_latitude is not null then
    insert into public.pet_locations_private (
      pet_post_id, exact_latitude, exact_longitude, address_notes
    ) values (
      target_post, p_exact_latitude, p_exact_longitude, clean_address
    );
  end if;

  if clean_type = 'adoption' and coalesce(p_needs_transit, false) then
    perform set_config('huellas.workflow_reason', 'Busqueda de hogar de transito creada con la publicacion', true);

    insert into public.rescuer_campaigns (
      rescuer_profile_id, city_id, campaign_type, title, description,
      zone_name, cover_image_path, support_method_id, ends_at
    ) values (
      target_rescuer,
      target_city,
      'transit',
      'Hogar de transito para ' || clean_name,
      clean_transit,
      clean_zone,
      null,
      null,
      null
    )
    returning id into target_campaign;

    insert into public.transit_campaign_details_018 (
      campaign_id, pet_post_id, requirements
    ) values (
      target_campaign, target_post, clean_transit
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
      'show_whatsapp', coalesce(p_show_whatsapp, false),
      'needs_transit', coalesce(p_needs_transit, false),
      'transit_campaign_id', target_campaign
    )
  );

  return target_post;
end
$function$;

create function public.offer_transit_home_v1(
  target_campaign uuid,
  p_home_zone text,
  p_availability text,
  p_has_dogs boolean default null,
  p_has_cats boolean default null,
  p_has_children boolean default null,
  p_message text default null,
  p_share_whatsapp boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  clean_zone text := nullif(btrim(coalesce(p_home_zone, '')), '');
  clean_availability text := nullif(btrim(coalesce(p_availability, '')), '');
  clean_message text := nullif(btrim(coalesce(p_message, '')), '');
  shared_whatsapp text;
  rescuer_user uuid;
  offer_id uuid;
  existing_status public.campaign_help_offer_status;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada.' using errcode = '42501';
  end if;
  if clean_zone is not null and char_length(clean_zone) not between 2 and 120 then
    raise exception 'La zona del hogar debe tener entre 2 y 120 caracteres.';
  end if;
  if clean_availability is null or char_length(clean_availability) not between 3 and 200 then
    raise exception 'Indica durante cuanto tiempo podes ofrecer transito.';
  end if;
  if clean_message is not null and char_length(clean_message) not between 3 and 1000 then
    raise exception 'El mensaje debe tener entre 3 y 1000 caracteres.';
  end if;

  select rescuer.user_id
  into rescuer_user
  from public.rescuer_campaigns campaign
  join public.transit_campaign_details_018 details on details.campaign_id = campaign.id
  join public.rescuer_profiles rescuer on rescuer.id = campaign.rescuer_profile_id
  where campaign.id = target_campaign
    and campaign.campaign_type = 'transit'
    and campaign.status = 'active'
    and campaign.moderation_status = 'visible'
    and rescuer.verification_status = 'verified'
  for share of campaign;

  if rescuer_user is null then
    raise exception 'La busqueda de transito no esta disponible.';
  end if;
  if rescuer_user = actor then
    raise exception 'No podes ofrecerte en tu propia busqueda de transito.';
  end if;

  if coalesce(p_share_whatsapp, false) then
    select nullif(btrim(contact.whatsapp), '') into shared_whatsapp
    from public.profile_contacts contact
    where contact.user_id = actor;
    if shared_whatsapp is null then
      raise exception 'Agrega un WhatsApp en tu perfil antes de compartirlo.';
    end if;
  end if;

  select offer.id, offer.status
  into offer_id, existing_status
  from public.campaign_help_offers offer
  where offer.campaign_id = target_campaign
    and offer.offerer_id = actor
  for update;

  if offer_id is not null and existing_status <> 'pending' then
    raise exception 'Tu ofrecimiento ya fue revisado y no puede modificarse.';
  end if;

  perform set_config('huellas.workflow_reason', 'Hogar de transito ofrecido por un colaborador', true);

  if offer_id is null then
    insert into public.campaign_help_offers (
      campaign_id, item_id, offerer_id, quantity, message
    ) values (
      target_campaign, null, actor, null, clean_message
    ) returning id into offer_id;
  else
    update public.campaign_help_offers
    set message = clean_message,
        updated_at = now()
    where id = offer_id;
  end if;

  insert into public.transit_offer_details_018 (
    offer_id, home_zone, availability, has_dogs, has_cats, has_children,
    contact_whatsapp, updated_at
  ) values (
    offer_id, clean_zone, clean_availability, p_has_dogs, p_has_cats,
    p_has_children, shared_whatsapp, now()
  )
  on conflict (offer_id) do update
  set home_zone = excluded.home_zone,
      availability = excluded.availability,
      has_dogs = excluded.has_dogs,
      has_cats = excluded.has_cats,
      has_children = excluded.has_children,
      contact_whatsapp = excluded.contact_whatsapp,
      updated_at = now();

  insert into public.notifications (
    user_id, event_type, title, body, link, payload
  ) values (
    rescuer_user,
    'transit_offer_received',
    'Nuevo ofrecimiento de transito',
    'Una persona se ofrecio como hogar de transito. Revisalo desde tu panel.',
    '/panel#transitos',
    jsonb_build_object('offer_id', offer_id, 'campaign_id', target_campaign)
  );

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    'transit_offer.saved',
    'campaign_help_offer',
    offer_id::text,
    jsonb_build_object('campaign_id', target_campaign, 'shared_whatsapp', shared_whatsapp is not null)
  );

  return offer_id;
end
$function$;

create function public.review_transit_offer_v1(
  target_offer uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  clean_decision text := lower(btrim(coalesce(p_decision, '')));
  offerer uuid;
  campaign_id uuid;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada.' using errcode = '42501';
  end if;
  if clean_decision not in ('accepted', 'rejected') then
    raise exception 'La decision debe ser accepted o rejected.';
  end if;

  select offer.offerer_id, offer.campaign_id
  into offerer, campaign_id
  from public.campaign_help_offers offer
  join public.transit_campaign_details_018 details on details.campaign_id = offer.campaign_id
  join public.rescuer_campaigns campaign on campaign.id = offer.campaign_id
  join public.rescuer_profiles rescuer on rescuer.id = campaign.rescuer_profile_id
  where offer.id = target_offer
    and offer.status = 'pending'
    and (rescuer.user_id = actor or private.is_admin())
  for update of offer;

  if offerer is null then
    raise exception 'La oferta no existe, ya fue revisada o no te pertenece.';
  end if;

  perform set_config('huellas.workflow_reason', 'Oferta de transito revisada por el rescatista', true);

  update public.campaign_help_offers
  set status = clean_decision::public.campaign_help_offer_status,
      decided_by = actor,
      decided_at = now(),
      updated_at = now()
  where id = target_offer;

  insert into public.notifications (
    user_id, event_type, title, body, link, payload
  ) values (
    offerer,
    case when clean_decision = 'accepted' then 'transit_offer_accepted' else 'transit_offer_rejected' end,
    'Tu ofrecimiento de transito fue revisado',
    case
      when clean_decision = 'accepted' then 'El rescatista acepto tu ofrecimiento y podra contactarte con los datos compartidos.'
      else 'El rescatista reviso tu ofrecimiento. Gracias por sumarte.'
    end,
    '/panel#mis-transitos',
    jsonb_build_object('offer_id', target_offer, 'campaign_id', campaign_id, 'status', clean_decision)
  );

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    'transit_offer.reviewed',
    'campaign_help_offer',
    target_offer::text,
    jsonb_build_object('campaign_id', campaign_id, 'decision', clean_decision)
  );
end
$function$;

create function public.set_transit_request_status_v1(
  target_campaign uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  clean_status text := lower(btrim(coalesce(p_status, '')));
  current_status public.rescuer_campaign_status;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada.' using errcode = '42501';
  end if;
  if clean_status not in ('completed', 'closed') then
    raise exception 'El estado debe ser completed o closed.';
  end if;

  select campaign.status
  into current_status
  from public.rescuer_campaigns campaign
  join public.transit_campaign_details_018 details on details.campaign_id = campaign.id
  join public.rescuer_profiles rescuer on rescuer.id = campaign.rescuer_profile_id
  where campaign.id = target_campaign
    and (rescuer.user_id = actor or private.is_admin())
  for update of campaign;

  if current_status is null then
    raise exception 'La busqueda de transito no existe o no te pertenece.';
  end if;
  if current_status <> 'active' then
    raise exception 'La busqueda de transito ya esta cerrada.';
  end if;

  perform set_config('huellas.workflow_reason', 'Busqueda de transito cerrada por el rescatista', true);

  update public.rescuer_campaigns
  set status = clean_status::public.rescuer_campaign_status,
      completed_at = now(),
      updated_at = now()
  where id = target_campaign;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    'transit_request.closed',
    'rescuer_campaign',
    target_campaign::text,
    jsonb_build_object('status', clean_status)
  );
end
$function$;

create function public.get_my_transit_dashboard_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when (select auth.uid()) is null then
      jsonb_build_object('requests', '[]'::jsonb, 'offers_made', '[]'::jsonb)
    else jsonb_build_object(
      'requests', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'campaign_id', campaign.id,
            'pet_post_id', detail.pet_post_id,
            'title', campaign.title,
            'status', campaign.status,
            'pet_name', post.name,
            'species', post.species,
            'zone_name', coalesce(campaign.zone_name, post.zone_name),
            'cover_image_url', case when cardinality(post.photo_paths) > 0 then post.photo_paths[1] else null end,
            'created_at', campaign.created_at,
            'offers', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', offer.id,
                  'offerer_name', offerer.display_name,
                  'message', offer.message,
                  'status', offer.status,
                  'home_zone', offer_detail.home_zone,
                  'availability', offer_detail.availability,
                  'has_dogs', offer_detail.has_dogs,
                  'has_cats', offer_detail.has_cats,
                  'has_children', offer_detail.has_children,
                  'contact_whatsapp', offer_detail.contact_whatsapp,
                  'created_at', offer.created_at
                ) order by offer.created_at desc
              )
              from public.campaign_help_offers offer
              join public.profiles offerer on offerer.id = offer.offerer_id
              left join public.transit_offer_details_018 offer_detail on offer_detail.offer_id = offer.id
              where offer.campaign_id = campaign.id
            ), '[]'::jsonb)
          ) order by campaign.created_at desc
        )
        from public.rescuer_campaigns campaign
        join public.transit_campaign_details_018 detail on detail.campaign_id = campaign.id
        join public.pet_posts post on post.id = detail.pet_post_id
        join public.rescuer_profiles rescuer on rescuer.id = campaign.rescuer_profile_id
        where rescuer.user_id = (select auth.uid())
      ), '[]'::jsonb),
      'offers_made', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', offer.id,
            'campaign_id', campaign.id,
            'title', campaign.title,
            'pet_name', post.name,
            'organization_name', rescuer.organization_name,
            'status', offer.status,
            'created_at', offer.created_at
          ) order by offer.created_at desc
        )
        from public.campaign_help_offers offer
        join public.rescuer_campaigns campaign on campaign.id = offer.campaign_id
        join public.transit_campaign_details_018 detail on detail.campaign_id = campaign.id
        join public.pet_posts post on post.id = detail.pet_post_id
        join public.rescuer_profiles rescuer on rescuer.id = campaign.rescuer_profile_id
        where offer.offerer_id = (select auth.uid())
      ), '[]'::jsonb)
    )
  end;
$function$;

revoke all on function public.create_pet_post_v2(
  uuid,text,text,text,text,text,text,text,text[],text,text,text,text,text[],text,
  double precision,double precision,text,boolean,timestamptz,boolean,text
) from public, anon;
grant execute on function public.create_pet_post_v2(
  uuid,text,text,text,text,text,text,text,text[],text,text,text,text,text[],text,
  double precision,double precision,text,boolean,timestamptz,boolean,text
) to authenticated;

revoke all on function public.offer_transit_home_v1(
  uuid,text,text,boolean,boolean,boolean,text,boolean
) from public, anon;
grant execute on function public.offer_transit_home_v1(
  uuid,text,text,boolean,boolean,boolean,text,boolean
) to authenticated;

revoke all on function public.review_transit_offer_v1(uuid,text) from public, anon;
grant execute on function public.review_transit_offer_v1(uuid,text) to authenticated;

revoke all on function public.set_transit_request_status_v1(uuid,text) from public, anon;
grant execute on function public.set_transit_request_status_v1(uuid,text) to authenticated;

revoke all on function public.get_my_transit_dashboard_v1() from public, anon;
grant execute on function public.get_my_transit_dashboard_v1() to authenticated;

insert into private.app_migrations (version, name, details)
values (
  '018',
  'rescuer_posts_and_transit_homes',
  jsonb_build_object(
    'optional_rescuer_location_time', true,
    'optional_distinctive_features_fixed', true,
    'transit_requests_linked_to_adoptions', true,
    'community_transit_offers', true,
    'private_offer_contacts', true,
    'notification_types_hardened', true
  )
);

notify pgrst, 'reload schema';

commit;
