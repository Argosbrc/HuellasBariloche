-- Huellas Bariloche
-- Migracion 019: solicitudes de adopcion completas y contacto seguro desde el mapa.
-- Requiere 001 a 018. Es transaccional: ante un error no deja cambios parciales.

begin;

select pg_advisory_xact_lock(
  hashtextextended('huellas-bariloche:migration:019', 0)
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
    '010','011','012','013','014','015','016','017','018'
  ]::text[]) required(version)
  where not exists (
    select 1 from private.app_migrations migration
    where migration.version = required.version
  );

  if missing_migrations is not null then
    raise exception 'Faltan migraciones requeridas: %', missing_migrations;
  end if;

  if exists (select 1 from private.app_migrations where version = '019')
     or to_regclass('public.adoption_request_details_019') is not null
     or to_regprocedure('public.submit_adoption_application_v1(uuid,text,text,text,text,text,text,text,text)') is not null
     or to_regprocedure('public.review_adoption_application_v1(uuid,text)') is not null
     or to_regprocedure('public.get_my_adoption_dashboard_v1()') is not null
     or to_regprocedure('public.get_public_pet_case_contact_v1(uuid)') is not null then
    raise exception 'La migracion 019 ya fue aplicada o existe parcialmente. No debe ejecutarse nuevamente.';
  end if;

  if to_regclass('public.adoption_requests') is null
     or to_regclass('public.adoption_details') is null
     or to_regclass('public.pet_posts') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.profile_contacts') is null
     or to_regclass('public.rescuer_profiles') is null
     or to_regclass('public.notifications') is null
     or to_regclass('public.audit_log') is null then
    raise exception 'Faltan tablas requeridas para adopciones y contactos.';
  end if;

  if to_regprocedure('private.is_active_user()') is null
     or to_regprocedure('private.is_admin()') is null
     or to_regprocedure('private.set_updated_at()') is null then
    raise exception 'Faltan funciones de seguridad requeridas.';
  end if;
end;
$$;

create table public.adoption_request_details_019 (
  adoption_request_id uuid primary key
    references public.adoption_requests(id) on delete cascade,
  full_name text not null,
  home_address text not null,
  phone text not null,
  locality text not null,
  secure_home text not null,
  financial_capacity text not null,
  neuter_commitment text not null,
  follow_up_commitment text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adoption_request_details_name_length_019
    check (char_length(btrim(full_name)) between 2 and 80),
  constraint adoption_request_details_address_length_019
    check (char_length(btrim(home_address)) between 5 and 200),
  constraint adoption_request_details_phone_length_019
    check (char_length(btrim(phone)) between 7 and 30),
  constraint adoption_request_details_phone_format_019
    check (phone ~ '^[0-9+() .-]{7,30}$'),
  constraint adoption_request_details_locality_length_019
    check (char_length(btrim(locality)) between 2 and 80),
  constraint adoption_request_details_secure_home_019
    check (secure_home in ('yes', 'no', 'apartment_safe_balcony')),
  constraint adoption_request_details_financial_capacity_019
    check (financial_capacity in ('yes', 'no', 'with_effort')),
  constraint adoption_request_details_neuter_commitment_019
    check (neuter_commitment in ('agreed', 'cannot_guarantee')),
  constraint adoption_request_details_follow_up_019
    check (follow_up_commitment in ('agreed', 'prefer_not'))
);

comment on table public.adoption_request_details_019 is
  'Filtro privado de adopcion. Solo se entrega al postulante, al rescatista responsable y a administracion mediante funciones controladas.';

create trigger adoption_request_details_set_updated_at_019
before update on public.adoption_request_details_019
for each row execute function private.set_updated_at();

alter table public.adoption_request_details_019 enable row level security;
revoke all on table public.adoption_request_details_019 from public, anon, authenticated;
grant select, insert, update, delete on table public.adoption_request_details_019 to service_role;

-- Contacto publico estrictamente condicionado por la autorizacion que el
-- publicador marco en el caso. Las adopciones usan el formulario privado.
create function public.get_public_pet_case_contact_v1(p_pet_post_id uuid)
returns table (
  pet_post_id uuid,
  publisher_name text,
  whatsapp text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    post.id,
    profile.display_name,
    nullif(btrim(contact.whatsapp), '')
  from public.pet_posts post
  join public.profiles profile on profile.id = post.owner_id
  join public.profile_contacts contact on contact.user_id = post.owner_id
  where post.id = p_pet_post_id
    and post.post_type::text <> 'adoption'
    and post.moderation_status::text = 'visible'
    and post.post_state::text in ('lost', 'sighted', 'found', 'reunited')
    and post.show_whatsapp
    and nullif(btrim(contact.whatsapp), '') is not null;
$function$;

create function public.submit_adoption_application_v1(
  p_pet_post_id uuid,
  p_full_name text,
  p_home_address text,
  p_phone text,
  p_locality text,
  p_secure_home text,
  p_financial_capacity text,
  p_neuter_commitment text,
  p_follow_up_commitment text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor uuid := (select auth.uid());
  target_rescuer_user uuid;
  target_pet_name text;
  request_id uuid;
  request_status public.adoption_request_status;
  request_created boolean := false;
  details_created boolean := false;
  clean_name text := btrim(coalesce(p_full_name, ''));
  clean_address text := btrim(coalesce(p_home_address, ''));
  clean_phone text := btrim(coalesce(p_phone, ''));
  clean_locality text := btrim(coalesce(p_locality, ''));
  clean_secure_home text := lower(btrim(coalesce(p_secure_home, '')));
  clean_financial text := lower(btrim(coalesce(p_financial_capacity, '')));
  clean_neuter text := lower(btrim(coalesce(p_neuter_commitment, '')));
  clean_follow_up text := lower(btrim(coalesce(p_follow_up_commitment, '')));
  secure_home_label text;
  financial_label text;
  neuter_label text;
  follow_up_label text;
  notification_body text;
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada';
  end if;

  if char_length(clean_name) not between 2 and 80 then
    raise exception 'Nombre y apellido deben tener entre 2 y 80 caracteres';
  end if;
  if char_length(clean_address) not between 5 and 200 then
    raise exception 'La direccion debe tener entre 5 y 200 caracteres';
  end if;
  if char_length(clean_phone) not between 7 and 30 then
    raise exception 'El telefono debe tener entre 7 y 30 caracteres';
  end if;
  if char_length(clean_locality) not between 2 and 80 then
    raise exception 'La localidad debe tener entre 2 y 80 caracteres';
  end if;
  if clean_secure_home not in ('yes', 'no', 'apartment_safe_balcony') then
    raise exception 'Selecciona una opcion valida para patio, porton o departamento';
  end if;
  if clean_financial not in ('yes', 'no', 'with_effort') then
    raise exception 'Selecciona una opcion valida para gastos veterinarios';
  end if;
  if clean_neuter not in ('agreed', 'cannot_guarantee') then
    raise exception 'Selecciona una opcion valida para el compromiso de castracion';
  end if;
  if clean_follow_up not in ('agreed', 'prefer_not') then
    raise exception 'Selecciona una opcion valida para el seguimiento';
  end if;

  select rescuer.user_id, coalesce(nullif(btrim(post.name), ''), 'este animal')
  into target_rescuer_user, target_pet_name
  from public.pet_posts post
  join public.rescuer_profiles rescuer on rescuer.id = post.rescuer_profile_id
  join public.adoption_details detail on detail.pet_post_id = post.id
  where post.id = p_pet_post_id
    and post.post_type::text = 'adoption'
    and post.post_state::text = 'available'
    and post.moderation_status::text = 'visible'
    and rescuer.verification_status::text = 'verified'
  for share of post;

  if target_rescuer_user is null then
    raise exception 'La adopcion no esta disponible';
  end if;
  if target_rescuer_user = actor then
    raise exception 'No podes solicitar tu propia publicacion de adopcion';
  end if;

  insert into public.adoption_requests (pet_post_id, requester_id)
  values (p_pet_post_id, actor)
  on conflict (pet_post_id, requester_id) do nothing
  returning id into request_id;

  if request_id is not null then
    request_created := true;
    request_status := 'pending';
  else
    select request.id, request.status
    into request_id, request_status
    from public.adoption_requests request
    where request.pet_post_id = p_pet_post_id
      and request.requester_id = actor;
  end if;

  if request_id is null then
    raise exception 'No se pudo crear la solicitud de adopcion';
  end if;
  if request_status <> 'pending' then
    raise exception 'Esta solicitud ya fue revisada y no puede modificarse';
  end if;

  details_created := not exists (
    select 1
    from public.adoption_request_details_019 existing_detail
    where existing_detail.adoption_request_id = request_id
  );

  insert into public.adoption_request_details_019 (
    adoption_request_id, full_name, home_address, phone, locality,
    secure_home, financial_capacity, neuter_commitment, follow_up_commitment
  )
  values (
    request_id, clean_name, clean_address, clean_phone, clean_locality,
    clean_secure_home, clean_financial, clean_neuter, clean_follow_up
  )
  on conflict (adoption_request_id) do update
  set full_name = excluded.full_name,
      home_address = excluded.home_address,
      phone = excluded.phone,
      locality = excluded.locality,
      secure_home = excluded.secure_home,
      financial_capacity = excluded.financial_capacity,
      neuter_commitment = excluded.neuter_commitment,
      follow_up_commitment = excluded.follow_up_commitment,
      updated_at = now();

  secure_home_label := case clean_secure_home
    when 'yes' then 'SÍ'
    when 'no' then 'NO'
    else 'DEPARTAMENTO CON BALCON SEGURO'
  end;
  financial_label := case clean_financial
    when 'yes' then 'SÍ'
    when 'no' then 'NO'
    else 'CON ESFUERZO'
  end;
  neuter_label := case clean_neuter
    when 'agreed' then 'DE ACUERDO'
    else 'NO PUEDE GARANTIZARLO'
  end;
  follow_up_label := case clean_follow_up
    when 'agreed' then 'SÍ, TOTALMENTE'
    else 'PREFIERE QUE NO'
  end;

  notification_body := left(
    'El usuario ' || clean_name || ' quiere conocer a ' || target_pet_name || E'.\n' ||
    '• Patio/Portón seguro: ' || secure_home_label || E'\n' ||
    '• Solvencia económica: ' || financial_label || E'\n' ||
    '• Compromiso de castración: ' || neuter_label || E'\n' ||
    '• Seguimiento: ' || follow_up_label || E'\n' ||
    '• Contacto: ' || clean_phone || ' | Zona: ' || clean_locality,
    500
  );

  if request_created or details_created then
    insert into public.notifications (
      user_id, event_type, title, body, link, payload, dedupe_key
    )
    values (
      target_rescuer_user,
      'adoption_request_created',
      '🚨 NUEVA SOLICITUD DE ADOPCIÓN 🚨',
      notification_body,
      '/panel#solicitudes-adopcion',
      jsonb_build_object(
        'adoption_request_id', request_id,
        'pet_post_id', p_pet_post_id,
        'applicant_name', clean_name,
        'phone', clean_phone,
        'locality', clean_locality
      ),
      'adoption_request_' || request_id::text
    )
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    case when request_created then 'adoption.request_created' else 'adoption.request_updated' end,
    'adoption_request',
    request_id::text,
    jsonb_build_object('pet_post_id', p_pet_post_id)
  );

  return request_id;
end;
$function$;

create function public.review_adoption_application_v1(
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
begin
  if actor is null or not private.is_active_user() then
    raise exception 'Debes iniciar sesion con una cuenta habilitada';
  end if;
  if clean_decision not in ('accepted', 'rejected') then
    raise exception 'La decision debe ser accepted o rejected';
  end if;

  select request.pet_post_id, request.requester_id, post.post_state
  into target_post, target_requester, current_post_state
  from public.adoption_requests request
  join public.adoption_request_details_019 detail
    on detail.adoption_request_id = request.id
  join public.pet_posts post on post.id = request.pet_post_id
  join public.rescuer_profiles rescuer on rescuer.id = post.rescuer_profile_id
  where request.id = p_adoption_request_id
    and request.status::text = 'pending'
    and (post.owner_id = actor or rescuer.user_id = actor or private.is_admin())
  for update of request, post;

  if target_post is null then
    raise exception 'La solicitud no existe, ya fue revisada o no te pertenece';
  end if;
  if clean_decision = 'accepted' and current_post_state::text <> 'available' then
    raise exception 'La adopcion ya no esta disponible';
  end if;

  perform set_config(
    'huellas.workflow_reason',
    case when clean_decision = 'accepted'
      then 'Solicitud de adopcion aceptada'
      else 'Solicitud de adopcion rechazada'
    end,
    true
  );

  update public.adoption_requests
  set status = clean_decision::public.adoption_request_status,
      decided_by = actor,
      decided_at = now(),
      updated_at = now()
  where id = p_adoption_request_id;

  if clean_decision = 'accepted' then
    perform set_config('huellas.transition_source', case when private.is_admin() then 'admin' else 'user' end, true);
    perform set_config('huellas.transition_reason', 'Adopcion confirmada mediante formulario verificado', true);

    update public.pet_posts
    set post_state = 'adopted', updated_at = now()
    where id = target_post;

    with rejected_requests as (
      update public.adoption_requests
      set status = 'rejected',
          decided_by = actor,
          decided_at = now(),
          updated_at = now()
      where pet_post_id = target_post
        and status::text = 'pending'
      returning id, requester_id
    )
    insert into public.notifications (
      user_id, event_type, title, body, link, payload, dedupe_key
    )
    select
      rejected.requester_id,
      'adoption_request_rejected',
      'Actualizacion de una adopcion',
      'La mascota fue asignada a otra solicitud.',
      '/panel#mis-solicitudes-adopcion',
      jsonb_build_object(
        'adoption_request_id', rejected.id,
        'pet_post_id', target_post,
        'status', 'rejected'
      ),
      'adoption_decision_' || rejected.id::text || '_rejected'
    from rejected_requests rejected
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  insert into public.notifications (
    user_id, event_type, title, body, link, payload, dedupe_key
  )
  values (
    target_requester,
    'adoption_request_' || clean_decision,
    case when clean_decision = 'accepted'
      then 'Tu solicitud de adopcion fue aceptada'
      else 'Tu solicitud de adopcion fue revisada'
    end,
    case when clean_decision = 'accepted'
      then 'El rescatista acepto tu solicitud. Coordinen el encuentro y los siguientes pasos.'
      else 'El rescatista reviso tu solicitud y esta vez no fue seleccionada.'
    end,
    '/panel#mis-solicitudes-adopcion',
    jsonb_build_object(
      'adoption_request_id', p_adoption_request_id,
      'pet_post_id', target_post,
      'status', clean_decision
    ),
    'adoption_decision_' || p_adoption_request_id::text || '_' || clean_decision
  )
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    'adoption.request_reviewed',
    'adoption_request',
    p_adoption_request_id::text,
    jsonb_build_object('pet_post_id', target_post, 'decision', clean_decision)
  );
end;
$function$;

create function public.get_my_adoption_dashboard_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when (select auth.uid()) is null or not private.is_active_user() then
      jsonb_build_object('received', '[]'::jsonb, 'sent', '[]'::jsonb)
    else jsonb_build_object(
      'received', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', request.id,
            'pet_post_id', post.id,
            'pet_name', post.name,
            'cover_image_url', case when cardinality(post.photo_paths) > 0 then post.photo_paths[1] else null end,
            'full_name', detail.full_name,
            'home_address', detail.home_address,
            'phone', detail.phone,
            'locality', detail.locality,
            'secure_home', detail.secure_home,
            'financial_capacity', detail.financial_capacity,
            'neuter_commitment', detail.neuter_commitment,
            'follow_up_commitment', detail.follow_up_commitment,
            'status', request.status,
            'created_at', request.created_at
          ) order by request.created_at desc
        )
        from public.adoption_requests request
        join public.adoption_request_details_019 detail on detail.adoption_request_id = request.id
        join public.pet_posts post on post.id = request.pet_post_id
        join public.rescuer_profiles rescuer on rescuer.id = post.rescuer_profile_id
        where rescuer.user_id = (select auth.uid())
          or post.owner_id = (select auth.uid())
          or private.is_admin()
      ), '[]'::jsonb),
      'sent', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', request.id,
            'pet_post_id', post.id,
            'pet_name', post.name,
            'cover_image_url', case when cardinality(post.photo_paths) > 0 then post.photo_paths[1] else null end,
            'rescuer_name', rescuer.organization_name,
            'status', request.status,
            'created_at', request.created_at
          ) order by request.created_at desc
        )
        from public.adoption_requests request
        join public.adoption_request_details_019 detail on detail.adoption_request_id = request.id
        join public.pet_posts post on post.id = request.pet_post_id
        join public.rescuer_profiles rescuer on rescuer.id = post.rescuer_profile_id
        where request.requester_id = (select auth.uid())
      ), '[]'::jsonb)
    )
  end;
$function$;

revoke all on function public.get_public_pet_case_contact_v1(uuid) from public;
grant execute on function public.get_public_pet_case_contact_v1(uuid) to anon, authenticated;

revoke all on function public.submit_adoption_application_v1(
  uuid,text,text,text,text,text,text,text,text
) from public, anon;
grant execute on function public.submit_adoption_application_v1(
  uuid,text,text,text,text,text,text,text,text
) to authenticated;

revoke all on function public.review_adoption_application_v1(uuid,text) from public, anon;
grant execute on function public.review_adoption_application_v1(uuid,text) to authenticated;

revoke all on function public.get_my_adoption_dashboard_v1() from public, anon;
grant execute on function public.get_my_adoption_dashboard_v1() to authenticated;

insert into private.app_migrations (version, name, details)
values (
  '019',
  'adoption_applications_and_map_contacts',
  jsonb_build_object(
    'private_adoption_filter', true,
    'rescuer_adoption_dashboard', true,
    'secure_public_case_contact', true,
    'notification_types_hardened', true
  )
);

notify pgrst, 'reload schema';

commit;
