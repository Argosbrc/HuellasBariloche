-- Huellas Bariloche - Migracion 016
-- Datos utiles administrables y portal publico de rescatistas.
-- Requiere migraciones 001 a 015 aprobadas.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

select pg_advisory_xact_lock(
  hashtextextended('huellas-bariloche:migration:016', 0)
);

do $preflight$
declare
  missing_migrations text;
  required_column record;
begin
  if to_regclass('private.app_migrations') is null then
    raise exception 'Falta private.app_migrations. Se cancela 016.';
  end if;

  select string_agg(expected.version, ', ' order by expected.version)
  into missing_migrations
  from (
    select lpad(value::text, 3, '0') as version
    from generate_series(1, 15) value
  ) expected
  where not exists (
    select 1
    from private.app_migrations applied
    where applied.version = expected.version
  );

  if missing_migrations is not null then
    raise exception 'Faltan migraciones registradas: %. Se cancela 016.', missing_migrations;
  end if;

  if exists (select 1 from private.app_migrations where version = '016') then
    raise exception 'La migracion 016 ya esta registrada. No debe repetirse.';
  end if;

  if to_regclass('public.service_details_016') is not null
     or to_regclass('public.rescuer_directory_profiles_016') is not null
     or to_regclass('public.api_useful_data_directory_v1') is not null
     or to_regclass('public.api_rescuer_directory_v1') is not null
     or to_regprocedure('public.admin_upsert_service_details_v1(uuid,boolean,boolean,text[],text[],boolean,text[],text,text,text)') is not null
     or to_regprocedure('public.update_my_rescuer_directory_profile_v1(text,text,text[],text,text,text,text,text)') is not null then
    raise exception 'Se detectaron objetos parciales o externos reservados para 016.';
  end if;

  if to_regclass('public.services') is null
     or to_regclass('public.service_categories') is null
     or to_regclass('public.api_service_directory') is null
     or to_regclass('public.rescuer_profiles') is null
     or to_regclass('public.rescuer_applications') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.cities') is null
     or to_regclass('public.pet_posts') is null
     or to_regclass('public.audit_log') is null then
    raise exception 'Faltan tablas o vistas requeridas. Se cancela 016.';
  end if;

  if to_regprocedure('private.is_active_user()') is null
     or to_regprocedure('private.is_admin()') is null then
    raise exception 'Faltan funciones de seguridad requeridas.';
  end if;

  for required_column in
    select *
    from (values
      ('services', 'id'),
      ('services', 'category_id'),
      ('service_categories', 'id'),
      ('service_categories', 'slug'),
      ('service_categories', 'created_by'),
      ('rescuer_profiles', 'id'),
      ('rescuer_profiles', 'user_id'),
      ('rescuer_profiles', 'verification_status'),
      ('profiles', 'id'),
      ('profiles', 'role'),
      ('profiles', 'avatar_url'),
      ('pet_posts', 'rescuer_profile_id')
    ) expected(table_name, column_name)
  loop
    if not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = required_column.table_name
        and c.column_name = required_column.column_name
    ) then
      raise exception 'Falta public.%.%. Se cancela 016.',
        required_column.table_name, required_column.column_name;
    end if;
  end loop;
end
$preflight$;

-- La tabla base de servicios se conserva intacta. Esta extension agrega datos
-- que cambian segun el rubro sin romper las funciones ni vistas anteriores.
create table public.service_details_016 (
  service_id uuid primary key references public.services(id) on delete cascade,
  home_visit boolean not null default false,
  has_on_call boolean not null default false,
  specializations text[] not null default '{}'::text[],
  product_types text[] not null default '{}'::text[],
  delivery_available boolean not null default false,
  payment_methods text[] not null default '{}'::text[],
  facebook text,
  tiktok text,
  notes text,
  updated_at timestamptz not null default now(),
  constraint service_details_specializations_limit_016 check (cardinality(specializations) <= 20),
  constraint service_details_products_limit_016 check (cardinality(product_types) <= 20),
  constraint service_details_payments_limit_016 check (cardinality(payment_methods) <= 20),
  constraint service_details_facebook_length_016 check (facebook is null or char_length(facebook) between 2 and 300),
  constraint service_details_tiktok_length_016 check (tiktok is null or char_length(tiktok) between 2 and 300),
  constraint service_details_notes_length_016 check (notes is null or char_length(notes) between 2 and 1600)
);

alter table public.service_details_016 enable row level security;
revoke all on table public.service_details_016 from public, anon, authenticated;
grant select on table public.service_details_016 to authenticated;

create policy service_details_admin_select_016
on public.service_details_016
for select
to authenticated
using ((select private.is_admin()));

create function public.admin_upsert_service_details_v1(
  p_service_id uuid,
  p_home_visit boolean default false,
  p_has_on_call boolean default false,
  p_specializations text[] default '{}'::text[],
  p_product_types text[] default '{}'::text[],
  p_delivery_available boolean default false,
  p_payment_methods text[] default '{}'::text[],
  p_facebook text default null,
  p_tiktok text default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  clean_specializations text[];
  clean_products text[];
  clean_payments text[];
  clean_facebook text := nullif(btrim(coalesce(p_facebook, '')), '');
  clean_tiktok text := nullif(btrim(coalesce(p_tiktok, '')), '');
  clean_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if actor is null or not private.is_admin() then
    raise exception 'Solo administracion puede editar Datos utiles';
  end if;
  perform 1 from public.services service where service.id = p_service_id;
  if not found then raise exception 'El lugar indicado no existe'; end if;

  select coalesce(array_agg(value order by value), '{}'::text[])
  into clean_specializations
  from (
    select distinct btrim(item) as value
    from unnest(coalesce(p_specializations, '{}'::text[])) item
    where char_length(btrim(item)) between 2 and 100
  ) cleaned;

  select coalesce(array_agg(value order by value), '{}'::text[])
  into clean_products
  from (
    select distinct btrim(item) as value
    from unnest(coalesce(p_product_types, '{}'::text[])) item
    where char_length(btrim(item)) between 2 and 100
  ) cleaned;

  select coalesce(array_agg(value order by value), '{}'::text[])
  into clean_payments
  from (
    select distinct btrim(item) as value
    from unnest(coalesce(p_payment_methods, '{}'::text[])) item
    where char_length(btrim(item)) between 2 and 80
  ) cleaned;

  if cardinality(clean_specializations) > 20
     or cardinality(clean_products) > 20
     or cardinality(clean_payments) > 20 then
    raise exception 'Cada lista admite hasta veinte elementos';
  end if;
  if clean_facebook is not null and char_length(clean_facebook) > 300 then
    raise exception 'Facebook supera el maximo permitido';
  end if;
  if clean_tiktok is not null and char_length(clean_tiktok) > 300 then
    raise exception 'TikTok supera el maximo permitido';
  end if;
  if clean_notes is not null and char_length(clean_notes) > 1600 then
    raise exception 'La informacion adicional supera el maximo permitido';
  end if;

  insert into public.service_details_016 (
    service_id, home_visit, has_on_call, specializations, product_types,
    delivery_available, payment_methods, facebook, tiktok, notes, updated_at
  ) values (
    p_service_id, coalesce(p_home_visit, false), coalesce(p_has_on_call, false),
    clean_specializations, clean_products, coalesce(p_delivery_available, false),
    clean_payments, clean_facebook, clean_tiktok, clean_notes, now()
  )
  on conflict (service_id) do update
  set home_visit = excluded.home_visit,
      has_on_call = excluded.has_on_call,
      specializations = excluded.specializations,
      product_types = excluded.product_types,
      delivery_available = excluded.delivery_available,
      payment_methods = excluded.payment_methods,
      facebook = excluded.facebook,
      tiktok = excluded.tiktok,
      notes = excluded.notes,
      updated_at = now();

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'useful_data.details_upserted', 'service', p_service_id::text, '{}'::jsonb);
end
$function$;

revoke all on function public.admin_upsert_service_details_v1(
  uuid, boolean, boolean, text[], text[], boolean, text[], text, text, text
) from public, anon;
grant execute on function public.admin_upsert_service_details_v1(
  uuid, boolean, boolean, text[], text[], boolean, text[], text, text, text
) to authenticated;

create function public.admin_upsert_service_category_v1(
  p_category_id uuid,
  p_slug text,
  p_name text,
  p_description text default null,
  p_sort_order integer default 100,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  target_id uuid := p_category_id;
  clean_slug text := lower(btrim(coalesce(p_slug, '')));
  clean_name text := btrim(coalesce(p_name, ''));
  clean_description text := nullif(btrim(coalesce(p_description, '')), '');
begin
  if actor is null or not private.is_admin() then
    raise exception 'Solo administracion puede editar categorias';
  end if;
  if clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or char_length(clean_slug) not between 2 and 80 then
    raise exception 'El identificador de categoria es invalido';
  end if;
  if char_length(clean_name) not between 2 and 80 then
    raise exception 'El nombre de categoria es invalido';
  end if;
  if clean_description is not null and char_length(clean_description) > 300 then
    raise exception 'La descripcion de categoria es demasiado larga';
  end if;
  if p_sort_order not between 0 and 999 then
    raise exception 'El orden debe estar entre 0 y 999';
  end if;

  if target_id is null then
    select category.id into target_id
    from public.service_categories category
    where category.slug = clean_slug;
  end if;

  if target_id is null then
    target_id := gen_random_uuid();
    insert into public.service_categories (
      id, slug, name, description, sort_order, active, created_by
    ) values (
      target_id, clean_slug, clean_name, clean_description,
      p_sort_order, coalesce(p_active, true), actor
    );
  else
    update public.service_categories
    set slug = clean_slug,
        name = clean_name,
        description = clean_description,
        sort_order = p_sort_order,
        active = coalesce(p_active, true)
    where id = target_id;
    if not found then raise exception 'La categoria indicada no existe'; end if;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'useful_data.category_upserted', 'service_category', target_id::text, jsonb_build_object('slug', clean_slug));
  return target_id;
end
$function$;

revoke all on function public.admin_upsert_service_category_v1(
  uuid, text, text, text, integer, boolean
) from public, anon;
grant execute on function public.admin_upsert_service_category_v1(
  uuid, text, text, text, integer, boolean
) to authenticated;

-- Categorias iniciales. SQL Editor no establece auth.uid(), por eso las filas
-- base se atribuyen de forma explicita a un administrador ya registrado.
-- No se eliminan ni se desactivan categorias existentes.
do $seed_categories$
declare
  admin_actor uuid;
begin
  select profile.id
  into admin_actor
  from public.profiles profile
  where profile.role::text = 'admin'
  order by profile.id::text
  limit 1;

  if admin_actor is null then
    raise exception 'No existe un perfil administrador para atribuir las categorias iniciales. Se cancela 016.';
  end if;

  insert into public.service_categories (
    id, slug, name, description, sort_order, active, created_by
  )
  select
    gen_random_uuid(), seed.slug, seed.name, seed.description,
    seed.sort_order, true, admin_actor
  from (values
    ('veterinarias', 'Veterinarias', 'Consultorios, clinicas, guardias y especialidades veterinarias.', 10),
    ('pet-shops', 'Pet shops', 'Accesorios, higiene, cuchas y productos para animales.', 20),
    ('alimentos', 'Alimentos', 'Balanceados, dietas especiales y puntos de venta.', 30),
    ('farmacias-veterinarias', 'Farmacias veterinarias', 'Medicamentos y productos veterinarios.', 40),
    ('peluquerias', 'Peluquerias', 'Bano, corte e higiene de mascotas.', 50),
    ('paseadores-y-cuidadores', 'Paseadores y cuidadores', 'Paseos, guarderia y cuidado a domicilio.', 60),
    ('transporte', 'Transporte', 'Traslados de mascotas y asistencia logistica.', 70),
    ('otros-servicios', 'Otros servicios', 'Otros datos utiles vinculados al cuidado animal.', 90)
  ) seed(slug, name, description, sort_order)
  where not exists (
    select 1
    from public.service_categories category
    where category.slug = seed.slug
  );
end
$seed_categories$;

create view public.api_useful_data_directory_v1
with (security_barrier = true)
as
select
  directory.*,
  coalesce(details.home_visit, false) as home_visit,
  coalesce(details.has_on_call, false) as has_on_call,
  coalesce(details.specializations, '{}'::text[]) as specializations,
  coalesce(details.product_types, '{}'::text[]) as product_types,
  coalesce(details.delivery_available, false) as delivery_available,
  coalesce(details.payment_methods, '{}'::text[]) as payment_methods,
  details.facebook,
  details.tiktok,
  details.notes as useful_notes
from public.api_service_directory directory
left join public.service_details_016 details on details.service_id = directory.id;

revoke all on table public.api_useful_data_directory_v1 from public;
grant select on table public.api_useful_data_directory_v1 to anon, authenticated;

-- Datos publicos opcionales para cada rescatista ya aprobado. La solicitud y
-- la decision administrativa siguen usando el flujo existente.
create table public.rescuer_directory_profiles_016 (
  rescuer_profile_id uuid primary key references public.rescuer_profiles(id) on delete cascade,
  donation_alias text,
  donation_note text,
  current_needs text[] not null default '{}'::text[],
  public_phone text,
  public_email text,
  instagram text,
  facebook text,
  website text,
  updated_at timestamptz not null default now(),
  constraint rescuer_directory_alias_length_016 check (donation_alias is null or char_length(donation_alias) between 3 and 60),
  constraint rescuer_directory_note_length_016 check (donation_note is null or char_length(donation_note) between 3 and 1200),
  constraint rescuer_directory_needs_limit_016 check (cardinality(current_needs) <= 20),
  constraint rescuer_directory_phone_length_016 check (public_phone is null or char_length(public_phone) between 7 and 50),
  constraint rescuer_directory_email_length_016 check (public_email is null or char_length(public_email) <= 254),
  constraint rescuer_directory_instagram_length_016 check (instagram is null or char_length(instagram) between 2 and 300),
  constraint rescuer_directory_facebook_length_016 check (facebook is null or char_length(facebook) between 2 and 300),
  constraint rescuer_directory_website_length_016 check (website is null or char_length(website) between 8 and 500)
);

alter table public.rescuer_directory_profiles_016 enable row level security;
revoke all on table public.rescuer_directory_profiles_016 from public, anon, authenticated;
grant select on table public.rescuer_directory_profiles_016 to authenticated;

create policy rescuer_directory_owner_or_admin_select_016
on public.rescuer_directory_profiles_016
for select
to authenticated
using (
  (select private.is_admin())
  or exists (
    select 1
    from public.rescuer_profiles rescuer
    where rescuer.id = rescuer_profile_id
      and rescuer.user_id = (select auth.uid())
  )
);

create function public.update_my_rescuer_directory_profile_v1(
  p_donation_alias text default null,
  p_donation_note text default null,
  p_current_needs text[] default '{}'::text[],
  p_public_phone text default null,
  p_public_email text default null,
  p_instagram text default null,
  p_facebook text default null,
  p_website text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  target_rescuer uuid;
  clean_alias text := nullif(lower(btrim(coalesce(p_donation_alias, ''))), '');
  clean_note text := nullif(btrim(coalesce(p_donation_note, '')), '');
  clean_needs text[];
  clean_phone text := nullif(btrim(coalesce(p_public_phone, '')), '');
  clean_email text := nullif(lower(btrim(coalesce(p_public_email, ''))), '');
  clean_instagram text := nullif(btrim(coalesce(p_instagram, '')), '');
  clean_facebook text := nullif(btrim(coalesce(p_facebook, '')), '');
  clean_website text := nullif(btrim(coalesce(p_website, '')), '');
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada';
  end if;

  select rescuer.id into target_rescuer
  from public.rescuer_profiles rescuer
  where rescuer.user_id = actor
    and rescuer.verification_status::text = 'verified';
  if target_rescuer is null then
    raise exception 'Solo un rescatista aprobado puede publicar esta ficha';
  end if;

  select coalesce(array_agg(value order by value), '{}'::text[])
  into clean_needs
  from (
    select distinct btrim(item) as value
    from unnest(coalesce(p_current_needs, '{}'::text[])) item
    where char_length(btrim(item)) between 2 and 100
  ) cleaned;

  if cardinality(clean_needs) > 20 then raise exception 'Se permiten hasta veinte necesidades'; end if;
  if clean_alias is not null and (char_length(clean_alias) not between 3 and 60 or clean_alias !~ '^[a-z0-9._-]+$') then
    raise exception 'El alias de donacion no tiene un formato valido';
  end if;
  if clean_note is not null and char_length(clean_note) not between 3 and 1200 then
    raise exception 'El mensaje de donaciones debe tener entre 3 y 1200 caracteres';
  end if;
  if clean_phone is not null and char_length(clean_phone) not between 7 and 50 then
    raise exception 'El telefono publico no tiene una longitud valida';
  end if;
  if clean_email is not null and (char_length(clean_email) > 254 or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'El correo publico no tiene un formato valido';
  end if;
  if clean_website is not null and clean_website !~* '^https://[^[:space:]]+$' then
    raise exception 'El sitio web debe comenzar con https://';
  end if;

  insert into public.rescuer_directory_profiles_016 (
    rescuer_profile_id, donation_alias, donation_note, current_needs,
    public_phone, public_email, instagram, facebook, website, updated_at
  ) values (
    target_rescuer, clean_alias, clean_note, clean_needs,
    clean_phone, clean_email, clean_instagram, clean_facebook, clean_website, now()
  )
  on conflict (rescuer_profile_id) do update
  set donation_alias = excluded.donation_alias,
      donation_note = excluded.donation_note,
      current_needs = excluded.current_needs,
      public_phone = excluded.public_phone,
      public_email = excluded.public_email,
      instagram = excluded.instagram,
      facebook = excluded.facebook,
      website = excluded.website,
      updated_at = now();

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'rescuer.directory_profile_updated', 'rescuer_profile', target_rescuer::text, jsonb_build_object('needs_count', cardinality(clean_needs)));
end
$function$;

revoke all on function public.update_my_rescuer_directory_profile_v1(
  text, text, text[], text, text, text, text, text
) from public, anon;
grant execute on function public.update_my_rescuer_directory_profile_v1(
  text, text, text[], text, text, text, text, text
) to authenticated;

create view public.api_rescuer_directory_v1
with (security_barrier = true)
as
select
  rescuer.id,
  rescuer.organization_name,
  profile.display_name,
  rescuer.description,
  rescuer.contact_area,
  city.name as city_name,
  rescuer.social_url,
  profile.avatar_url,
  directory.donation_alias,
  directory.donation_note,
  coalesce(directory.current_needs, '{}'::text[]) as current_needs,
  directory.public_phone,
  directory.public_email,
  directory.instagram,
  directory.facebook,
  directory.website,
  coalesce((
    select count(*)::integer
    from public.pet_posts post
    where post.rescuer_profile_id = rescuer.id
      and post.post_type::text = 'adoption'
      and post.status::text = 'active'
      and post.moderation_status::text = 'visible'
  ), 0) as adoption_count,
  rescuer.created_at
from public.rescuer_profiles rescuer
join public.profiles profile on profile.id = rescuer.user_id
join public.cities city on city.id = rescuer.city_id
left join public.rescuer_directory_profiles_016 directory
  on directory.rescuer_profile_id = rescuer.id
where rescuer.verification_status::text = 'verified';

revoke all on table public.api_rescuer_directory_v1 from public;
grant select on table public.api_rescuer_directory_v1 to anon, authenticated;

insert into private.app_migrations (version, name, details)
values (
  '016',
  'useful_data_and_rescuer_directory',
  jsonb_build_object(
    'useful_data_categories_seeded', true,
    'useful_data_admin_extensions', true,
    'rescuer_approval_preserved', true,
    'rescuer_public_directory', true,
    'donation_alias_optional', true,
    'current_needs_optional', true
  )
);

notify pgrst, 'reload schema';

commit;
