-- Huellas Bariloche
-- Migracion 021: notificaciones Web Push opt-in para nuevas solicitudes de adopcion.
-- Requiere 001 a 020. No cambia el formulario ni expone datos del postulante.

begin;

select pg_advisory_xact_lock(
  hashtextextended('huellas-bariloche:migration:021', 0)
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
    '011','012','013','014','015','016','017','018','019','020'
  ]::text[]) required(version)
  where not exists (
    select 1 from private.app_migrations migration
    where migration.version = required.version
  );

  if missing_migrations is not null then
    raise exception 'Faltan migraciones requeridas: %', missing_migrations;
  end if;

  if exists (select 1 from private.app_migrations where version = '021')
     or to_regclass('public.adoption_push_deliveries_021') is not null
     or to_regprocedure('public.claim_adoption_request_push_delivery_v1(uuid,uuid)') is not null then
    raise exception 'La migracion 021 ya fue aplicada o existe parcialmente. No debe ejecutarse nuevamente.';
  end if;

  if to_regclass('public.adoption_requests') is null
     or to_regclass('public.adoption_request_details_019') is null
     or to_regclass('public.rescuer_profiles') is null
     or to_regclass('public.pet_posts') is null
     or to_regclass('public.web_push_subscriptions_020') is null then
    raise exception 'Faltan tablas requeridas para las alertas de adopcion.';
  end if;
end;
$$;

create table public.adoption_push_deliveries_021 (
  adoption_request_id uuid primary key
    references public.adoption_requests(id) on delete cascade,
  requester_id uuid not null
    references public.profiles(id) on delete cascade,
  claimed_at timestamptz not null default now()
);

comment on table public.adoption_push_deliveries_021 is
  'Registro privado de entrega unica para evitar notificaciones push duplicadas por solicitud de adopcion.';

alter table public.adoption_push_deliveries_021 enable row level security;
revoke all on table public.adoption_push_deliveries_021 from public, anon, authenticated;
grant select, insert, update, delete on table public.adoption_push_deliveries_021 to service_role;

create function public.claim_adoption_request_push_delivery_v1(
  p_adoption_request_id uuid,
  p_requester_id uuid
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
  target_requester uuid;
  target_rescuer uuid;
  target_status text;
  target_created_at timestamptz;
  target_pet_name text;
  target_applicant_name text;
  claimed boolean := false;
begin
  select
    request.requester_id,
    rescuer.user_id,
    request.status::text,
    request.created_at,
    coalesce(nullif(btrim(post.name), ''), 'una mascota'),
    detail.full_name
  into
    target_requester,
    target_rescuer,
    target_status,
    target_created_at,
    target_pet_name,
    target_applicant_name
  from public.adoption_requests request
  join public.adoption_request_details_019 detail
    on detail.adoption_request_id = request.id
  join public.pet_posts post
    on post.id = request.pet_post_id
  join public.rescuer_profiles rescuer
    on rescuer.id = post.rescuer_profile_id
  where request.id = p_adoption_request_id;

  if target_requester is null
     or target_requester <> p_requester_id
     or target_rescuer is null
     or target_status <> 'pending'
     or target_created_at < now() - interval '15 minutes' then
    return;
  end if;

  insert into public.adoption_push_deliveries_021 (
    adoption_request_id, requester_id
  ) values (
    p_adoption_request_id, p_requester_id
  )
  on conflict (adoption_request_id) do nothing
  returning true into claimed;

  if not coalesce(claimed, false) then
    return;
  end if;

  return query
  select
    subscription.endpoint,
    subscription.p256dh,
    subscription.auth,
    '🐾 Nueva solicitud para ' || target_pet_name,
    left(target_applicant_name || ' completó el formulario de adopción. Revisá sus respuestas y contacto.', 180),
    '/panel#solicitudes-adopcion'
  from public.web_push_subscriptions_020 subscription
  where subscription.user_id = target_rescuer
    and subscription.active;

  update public.web_push_subscriptions_020 subscription
  set last_used_at = now(), updated_at = now()
  where subscription.user_id = target_rescuer
    and subscription.active;
end;
$function$;

revoke all on function public.claim_adoption_request_push_delivery_v1(uuid,uuid) from public;
revoke all on function public.claim_adoption_request_push_delivery_v1(uuid,uuid) from anon, authenticated;
grant execute on function public.claim_adoption_request_push_delivery_v1(uuid,uuid) to service_role;

insert into private.app_migrations (version, name, details)
values (
  '021',
  'adoption_push_notifications',
  jsonb_build_object(
    'rescuer_opt_in_web_push', true,
    'single_delivery_per_application', true,
    'private_applicant_details', true,
    'internal_notification_preserved', true
  )
);

notify pgrst, 'reload schema';

commit;
