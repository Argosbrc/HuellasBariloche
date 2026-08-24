-- Huellas Bariloche
-- Migracion 022: gestion, edicion y cierre transaccional de casos.
-- Requiere 001 a 021. Es transaccional: ante un error no deja cambios parciales.

begin;

select pg_advisory_xact_lock(
  hashtextextended('huellas-bariloche:migration:022', 0)
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
    '019','020','021'
  ]::text[]) required(version)
  where not exists (
    select 1 from private.app_migrations migration
    where migration.version = required.version
  );

  if missing_migrations is not null then
    raise exception 'Faltan migraciones requeridas: %', missing_migrations;
  end if;

  if exists (select 1 from private.app_migrations where version = '022')
     or to_regprocedure('public.get_my_pet_post_editor_v1(uuid)') is not null
     or to_regprocedure('public.update_my_pet_post_v1(uuid,text,text,text,text,text,text,text[],text,text,text,text,text[],text,double precision,double precision,text,boolean,timestamp with time zone)') is not null
     or to_regprocedure('public.resolve_my_pet_case_v1(uuid,text,text)') is not null
     or to_regprocedure('public.set_my_pet_sighting_alert_status_v1(uuid,text)') is not null then
    raise exception 'La migracion 022 ya fue aplicada o existe parcialmente. No debe ejecutarse nuevamente.';
  end if;

  if to_regclass('public.pet_posts') is null
     or to_regclass('public.pet_locations_private') is null
     or to_regclass('public.post_status_history') is null
     or to_regclass('public.external_media') is null
     or to_regclass('public.adoption_requests') is null
     or to_regclass('public.adoption_request_details_019') is null
     or to_regclass('public.transit_campaign_details_018') is null
     or to_regclass('public.pet_sighting_alerts_020') is null
     or to_regclass('public.notifications') is null
     or to_regclass('public.audit_log') is null then
    raise exception 'Faltan tablas requeridas para gestionar casos.';
  end if;

  if to_regprocedure('private.is_active_user()') is null
     or to_regprocedure('private.is_admin()') is null
     or to_regprocedure('public.set_pet_post_state(uuid,public.pet_post_state,text)') is null
     or to_regprocedure('public.set_transit_request_status_v1(uuid,text)') is null
     or to_regprocedure('public.review_adoption_application_v1(uuid,text)') is null then
    raise exception 'Faltan funciones de seguridad y estados requeridas.';
  end if;
end;
$$;

create function public.get_my_pet_post_editor_v1(p_pet_post_id uuid)
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
    'id', post.id,
    'post_type', post.post_type,
    'post_state', post.post_state,
    'name', post.name,
    'species', post.species,
    'breed', post.breed,
    'sex', post.sex,
    'age_label', post.age_label,
    'size_label', post.size_label,
    'colors', post.colors,
    'distinctive_features', post.distinctive_features,
    'description', post.description,
    'health_status', post.health_status,
    'adoption_requirements', post.adoption_requirements,
    'photo_paths', post.photo_paths,
    'zone_name', post.zone_name,
    'public_latitude', post.public_latitude,
    'public_longitude', post.public_longitude,
    'exact_latitude', location.exact_latitude,
    'exact_longitude', location.exact_longitude,
    'address_notes', location.address_notes,
    'show_whatsapp', post.show_whatsapp,
    'event_at', post.event_at,
    'created_at', post.created_at,
    'updated_at', post.updated_at,
    'history', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'from_state', history.from_state,
          'to_state', history.to_state,
          'reason', history.reason,
          'created_at', history.created_at
        ) order by history.created_at desc, history.id desc
      )
      from public.post_status_history history
      where history.pet_post_id = post.id
    ), '[]'::jsonb)
  )
  into result
  from public.pet_posts post
  left join public.pet_locations_private location on location.pet_post_id = post.id
  where post.id = p_pet_post_id
    and (post.owner_id = actor or private.is_admin());

  if result is null then
    raise exception 'El caso no existe o no te pertenece.' using errcode = '42501';
  end if;
  return result;
end;
$function$;

create function public.update_my_pet_post_v1(
  p_pet_post_id uuid,
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
  p_event_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  target_owner uuid;
  target_type public.pet_post_type;
  target_state public.pet_post_state;
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
  clean_zone text := nullif(btrim(coalesce(p_zone_name, '')), '');
  clean_address text := nullif(btrim(coalesce(p_address_notes, '')), '');
  clean_colors text[];
  clean_photos text[] := coalesce(p_photo_urls, '{}'::text[]);
  public_lat double precision;
  public_lon double precision;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada.' using errcode = '42501';
  end if;

  select post.owner_id, post.post_type, post.post_state
  into target_owner, target_type, target_state
  from public.pet_posts post
  where post.id = p_pet_post_id
  for update;

  if target_owner is null or (target_owner <> actor and not private.is_admin()) then
    raise exception 'El caso no existe o no te pertenece.' using errcode = '42501';
  end if;
  if target_state not in ('lost', 'sighted', 'found', 'available') then
    raise exception 'Un caso cerrado o archivado ya no puede editarse.';
  end if;

  if target_type in ('lost', 'adoption')
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

  if target_type in ('lost', 'found') then
    if clean_zone is null or char_length(clean_zone) not between 2 and 120 then
      raise exception 'La zona o barrio es obligatoria para animales perdidos o encontrados.';
    end if;
    if p_event_at is null then
      raise exception 'La fecha y hora son obligatorias para animales perdidos o encontrados.';
    end if;
  elsif clean_zone is not null and char_length(clean_zone) not between 2 and 120 then
    raise exception 'La zona debe tener entre 2 y 120 caracteres.';
  end if;

  if target_type = 'adoption' then
    if clean_requirements is null or char_length(clean_requirements) not between 10 and 2000 then
      raise exception 'La adopcion requiere condiciones de hogar de entre 10 y 2000 caracteres.';
    end if;
  else
    clean_requirements := null;
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

  if cardinality(clean_colors) > 12
     or exists (select 1 from unnest(clean_colors) color where char_length(color) > 40) then
    raise exception 'Se permiten hasta 12 colores o marcas de 40 caracteres.';
  end if;
  if cardinality(clean_photos) not between 1 and 4 then
    raise exception 'La publicacion requiere entre una y cuatro fotografias.';
  end if;
  if (select count(*) <> count(distinct photo) from unnest(clean_photos) photo) then
    raise exception 'No se permiten fotografias duplicadas.';
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
    select 1 from public.profile_contacts contact
    where contact.user_id = target_owner
      and nullif(btrim(contact.whatsapp), '') is not null
  ) then
    raise exception 'Agrega un WhatsApp en tu perfil antes de mostrarlo en la publicacion.';
  end if;

  perform set_config('huellas.workflow_reason', 'Publicacion editada por su titular', true);

  update public.pet_posts
  set name = clean_name,
      species = clean_species,
      breed = clean_breed,
      sex = clean_sex,
      age_label = clean_age,
      size_label = clean_size,
      colors = clean_colors,
      distinctive_features = clean_features,
      description = clean_description,
      health_status = clean_health,
      adoption_requirements = clean_requirements,
      photo_paths = clean_photos,
      zone_name = clean_zone,
      public_latitude = public_lat,
      public_longitude = public_lon,
      show_whatsapp = coalesce(p_show_whatsapp, false),
      event_at = p_event_at,
      updated_at = now()
  where id = p_pet_post_id;

  if p_exact_latitude is null then
    delete from public.pet_locations_private location
    where location.pet_post_id = p_pet_post_id;
  else
    insert into public.pet_locations_private (
      pet_post_id, exact_latitude, exact_longitude, address_notes
    ) values (
      p_pet_post_id, p_exact_latitude, p_exact_longitude, clean_address
    )
    on conflict (pet_post_id) do update
    set exact_latitude = excluded.exact_latitude,
        exact_longitude = excluded.exact_longitude,
        address_notes = excluded.address_notes;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    'pet_post.updated',
    'pet_post',
    p_pet_post_id::text,
    jsonb_build_object(
      'image_count', cardinality(clean_photos),
      'has_private_location', p_exact_latitude is not null,
      'show_whatsapp', coalesce(p_show_whatsapp, false)
    )
  );

  return p_pet_post_id;
end;
$function$;

-- Seleccionar un postulante no concreta automaticamente la adopcion. El cierre
-- final se realiza desde resolve_my_pet_case_v1 cuando la entrega ya ocurrio.
create or replace function public.review_adoption_application_v1(
  p_adoption_request_id uuid,
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
  target_post uuid;
  target_requester uuid;
  current_post_state public.pet_post_state;
  current_request_status public.adoption_request_status;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada';
  end if;
  if clean_decision not in ('accepted', 'rejected') then
    raise exception 'La decision debe ser accepted o rejected';
  end if;

  select request.pet_post_id, request.requester_id, post.post_state, request.status
  into target_post, target_requester, current_post_state, current_request_status
  from public.adoption_requests request
  join public.adoption_request_details_019 detail
    on detail.adoption_request_id = request.id
  join public.pet_posts post on post.id = request.pet_post_id
  join public.rescuer_profiles rescuer on rescuer.id = post.rescuer_profile_id
  where request.id = p_adoption_request_id
    and request.status::text in ('pending', 'accepted')
    and (post.owner_id = actor or rescuer.user_id = actor or private.is_admin())
  for update of request, post;

  if target_post is null then
    raise exception 'La solicitud no existe, ya fue rechazada o no te pertenece';
  end if;
  if clean_decision = 'accepted' and current_request_status::text <> 'pending' then
    return;
  end if;
  if clean_decision = 'rejected' and current_request_status::text = 'rejected' then
    return;
  end if;
  if clean_decision = 'accepted' and current_post_state::text <> 'available' then
    raise exception 'La adopcion ya no esta disponible';
  end if;
  if clean_decision = 'accepted' and exists (
    select 1 from public.adoption_requests other
    where other.pet_post_id = target_post
      and other.id <> p_adoption_request_id
      and other.status::text = 'accepted'
  ) then
    raise exception 'Ya existe un postulante seleccionado. Cancela esa seleccion antes de elegir otro.';
  end if;

  perform set_config(
    'huellas.workflow_reason',
    case when clean_decision = 'accepted'
      then 'Postulante seleccionado; adopcion aun no concretada'
      else 'Solicitud de adopcion rechazada o seleccion cancelada'
    end,
    true
  );

  update public.adoption_requests
  set status = clean_decision::public.adoption_request_status,
      decided_by = actor,
      decided_at = now(),
      updated_at = now()
  where id = p_adoption_request_id;

  insert into public.notifications (
    user_id, event_type, title, body, link, payload, dedupe_key
  )
  values (
    target_requester,
    'adoption_request_' || clean_decision,
    case when clean_decision = 'accepted'
      then 'Fuiste seleccionado para una adopcion'
      else 'Tu solicitud de adopcion fue revisada'
    end,
    case when clean_decision = 'accepted'
      then 'El rescatista te selecciono como postulante. Ahora deben coordinar el encuentro; la adopcion se confirmara despues de la entrega.'
      else 'El rescatista actualizo la seleccion de esta adopcion.'
    end,
    '/panel#mis-solicitudes-adopcion',
    jsonb_build_object(
      'adoption_request_id', p_adoption_request_id,
      'pet_post_id', target_post,
      'status', clean_decision,
      'adoption_concreted', false
    ),
    'adoption_decision_022_' || p_adoption_request_id::text || '_' || clean_decision
  )
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    'adoption.request_reviewed',
    'adoption_request',
    p_adoption_request_id::text,
    jsonb_build_object(
      'pet_post_id', target_post,
      'decision', clean_decision,
      'adoption_concreted', false
    )
  );
end;
$function$;

create function public.resolve_my_pet_case_v1(
  p_pet_post_id uuid,
  p_new_state text,
  p_reason text default null
)
returns public.pet_post_state
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  clean_state text := lower(btrim(coalesce(p_new_state, '')));
  clean_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  target_type public.pet_post_type;
  target_owner uuid;
  final_state public.pet_post_state;
  target_campaign record;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada.' using errcode = '42501';
  end if;
  if clean_reason is not null and char_length(clean_reason) not between 3 and 500 then
    raise exception 'La nota del cierre debe tener entre 3 y 500 caracteres.';
  end if;

  select post.post_type, post.owner_id
  into target_type, target_owner
  from public.pet_posts post
  where post.id = p_pet_post_id
  for update;

  if target_owner is null or (target_owner <> actor and not private.is_admin()) then
    raise exception 'El caso no existe o no te pertenece.' using errcode = '42501';
  end if;
  if target_type in ('lost', 'found') and clean_state not in ('reunited', 'closed', 'archived') then
    raise exception 'El estado final no corresponde a este caso.';
  end if;
  if target_type = 'adoption' and clean_state not in ('adopted', 'closed', 'archived') then
    raise exception 'El estado final no corresponde a una adopcion.';
  end if;

  final_state := public.set_pet_post_state(
    p_pet_post_id,
    clean_state::public.pet_post_state,
    coalesce(clean_reason,
      case clean_state
        when 'reunited' then 'El animal volvio con su familia'
        when 'adopted' then 'La adopcion fue concretada por el rescatista'
        when 'closed' then 'El titular cerro el caso sin una resolucion publica'
        else 'El titular archivo el caso'
      end
    )
  );

  if target_type = 'adoption' and clean_state in ('adopted', 'closed', 'archived') then
    for target_campaign in
      select campaign.id
      from public.rescuer_campaigns campaign
      join public.transit_campaign_details_018 details on details.campaign_id = campaign.id
      where details.pet_post_id = p_pet_post_id
        and campaign.status::text = 'active'
      for update of campaign
    loop
      perform public.set_transit_request_status_v1(
        target_campaign.id,
        case when clean_state = 'adopted' then 'completed' else 'closed' end
      );
    end loop;

    with rejected_requests as (
      update public.adoption_requests request
      set status = 'rejected',
          decided_by = actor,
          decided_at = now(),
          updated_at = now()
      where request.pet_post_id = p_pet_post_id
        and (
          request.status::text = 'pending'
          or (clean_state in ('closed', 'archived') and request.status::text = 'accepted')
        )
      returning request.id, request.requester_id
    )
    insert into public.notifications (
      user_id, event_type, title, body, link, payload, dedupe_key
    )
    select
      rejected.requester_id,
      'adoption_request_rejected',
      'Actualizacion de una adopcion',
      case when clean_state = 'adopted'
        then 'La adopcion se concreto con otra postulacion.'
        else 'La publicacion de adopcion fue cerrada por el rescatista.'
      end,
      '/panel#mis-solicitudes-adopcion',
      jsonb_build_object(
        'adoption_request_id', rejected.id,
        'pet_post_id', p_pet_post_id,
        'status', 'rejected',
        'case_state', clean_state
      ),
      'adoption_case_closed_022_' || rejected.id::text || '_' || clean_state
    from rejected_requests rejected
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

    if clean_state = 'adopted' then
      insert into public.notifications (
        user_id, event_type, title, body, link, payload, dedupe_key
      )
      select
        request.requester_id,
        'adoption_completed',
        'Adopcion concretada',
        'El rescatista confirmo que la adopcion fue concretada. Gracias por elegir una adopcion responsable.',
        '/panel#mis-solicitudes-adopcion',
        jsonb_build_object(
          'adoption_request_id', request.id,
          'pet_post_id', p_pet_post_id,
          'status', 'accepted',
          'case_state', 'adopted'
        ),
        'adoption_completed_022_' || request.id::text
      from public.adoption_requests request
      where request.pet_post_id = p_pet_post_id
        and request.status::text = 'accepted'
      on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    end if;
  end if;

  if target_type in ('lost', 'found') and clean_state in ('reunited', 'closed', 'archived') then
    update public.pet_sighting_alerts_020 alert
    set status = 'resolved', updated_at = now()
    where alert.pet_post_id = p_pet_post_id
      and alert.status in ('new', 'contacted');
  end if;

  return final_state;
end;
$function$;

create function public.set_my_pet_sighting_alert_status_v1(
  p_alert_id uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  clean_status text := lower(btrim(coalesce(p_status, '')));
  current_status text;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada.' using errcode = '42501';
  end if;
  if clean_status not in ('contacted', 'resolved', 'dismissed') then
    raise exception 'El estado del aviso no es valido.';
  end if;

  select alert.status into current_status
  from public.pet_sighting_alerts_020 alert
  where alert.id = p_alert_id
    and (alert.owner_user_id = actor or private.is_admin())
  for update;

  if current_status is null then
    raise exception 'El aviso no existe o no te pertenece.' using errcode = '42501';
  end if;
  if current_status = clean_status then
    return clean_status;
  end if;
  if current_status in ('resolved', 'dismissed')
     or (current_status = 'contacted' and clean_status = 'contacted') then
    raise exception 'El aviso ya tiene un estado final.';
  end if;

  update public.pet_sighting_alerts_020 alert
  set status = clean_status, updated_at = now()
  where alert.id = p_alert_id;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    'pet_sighting_alert.status_changed',
    'pet_sighting_alert',
    p_alert_id::text,
    jsonb_build_object('from_status', current_status, 'to_status', clean_status)
  );
  return clean_status;
end;
$function$;

revoke all on function public.get_my_pet_post_editor_v1(uuid) from public, anon;
grant execute on function public.get_my_pet_post_editor_v1(uuid) to authenticated;

revoke all on function public.update_my_pet_post_v1(
  uuid,text,text,text,text,text,text,text[],text,text,text,text,text[],text,
  double precision,double precision,text,boolean,timestamp with time zone
) from public, anon;
grant execute on function public.update_my_pet_post_v1(
  uuid,text,text,text,text,text,text,text[],text,text,text,text,text[],text,
  double precision,double precision,text,boolean,timestamp with time zone
) to authenticated;

revoke all on function public.resolve_my_pet_case_v1(uuid,text,text) from public, anon;
grant execute on function public.resolve_my_pet_case_v1(uuid,text,text) to authenticated;

revoke all on function public.set_my_pet_sighting_alert_status_v1(uuid,text) from public, anon;
grant execute on function public.set_my_pet_sighting_alert_status_v1(uuid,text) to authenticated;

revoke all on function public.review_adoption_application_v1(uuid,text) from public, anon;
grant execute on function public.review_adoption_application_v1(uuid,text) to authenticated;

insert into private.app_migrations (version, name, details)
values (
  '022',
  'pet_case_management',
  jsonb_build_object(
    'owner_case_editor', true,
    'photo_replacement_with_inventory', true,
    'state_history_visible_to_owner', true,
    'active_list_cleanup', true,
    'transit_closes_with_adoption', true,
    'adoption_selection_separated_from_completion', true,
    'sighting_alert_workflow', true
  )
);

notify pgrst, 'reload schema';

commit;
