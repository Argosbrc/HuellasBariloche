-- Huellas Bariloche - Migracion 017
-- Corrige la aprobacion de rescatistas despues del endurecimiento de
-- notificaciones aplicado por la migracion 009.

begin;

do $preflight$
begin
  if exists (
    select 1
    from private.app_migrations migration
    where migration.version = '017'
  ) then
    raise exception 'La migracion 017 ya fue aplicada.';
  end if;

  if not exists (
    select 1
    from private.app_migrations migration
    where migration.version = '009'
  ) or not exists (
    select 1
    from private.app_migrations migration
    where migration.version = '016'
  ) then
    raise exception 'Primero deben estar instaladas las migraciones 009 y 016.';
  end if;

  if to_regprocedure(
    'public.admin_review_rescuer_application(uuid,public.rescuer_application_status,text)'
  ) is null then
    raise exception 'No existe la funcion de revision de rescatistas esperada.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint constraint_ref
    join pg_catalog.pg_class relation_ref
      on relation_ref.oid = constraint_ref.conrelid
    join pg_catalog.pg_namespace namespace_ref
      on namespace_ref.oid = relation_ref.relnamespace
    where namespace_ref.nspname = 'public'
      and relation_ref.relname = 'notifications'
      and constraint_ref.conname = 'notifications_event_type_format'
      and constraint_ref.convalidated
  ) then
    raise exception 'No esta activa la regla segura de tipos de notificacion de 009.';
  end if;
end
$preflight$;

create or replace function public.admin_review_rescuer_application(
  target_application uuid,
  decision public.rescuer_application_status,
  admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  admin_user_id uuid := (select auth.uid());
  application public.rescuer_applications%rowtype;
  city_name text;
  notification_event_type text;
begin
  if not private.is_admin() then
    raise exception 'Acceso denegado';
  end if;

  if decision not in ('approved', 'rejected') then
    raise exception 'La decision debe ser approved o rejected';
  end if;

  if admin_note is not null
     and char_length(trim(admin_note)) not between 2 and 1000 then
    raise exception 'La nota debe tener entre 2 y 1000 caracteres';
  end if;

  select application_ref.*
  into application
  from public.rescuer_applications application_ref
  where application_ref.id = target_application
    and application_ref.status = 'pending'
  for update;

  if not found then
    raise exception 'La solicitud no existe o ya fue revisada';
  end if;

  select city.name
  into city_name
  from public.cities city
  where city.id = application.city_id;

  if city_name is null then
    raise exception 'La solicitud no tiene una ciudad valida';
  end if;

  update public.rescuer_applications
  set status = decision,
      review_note = nullif(trim(admin_note), ''),
      reviewed_by = admin_user_id,
      reviewed_at = now(),
      updated_at = now()
  where id = application.id;

  if decision = 'approved' then
    insert into public.rescuer_profiles as rescuer_profile (
      user_id,
      city_id,
      organization_name,
      contact_area,
      social_url,
      verification_status,
      verification_note,
      verified_by,
      verified_at
    )
    values (
      application.user_id,
      application.city_id,
      coalesce(
        nullif(trim(application.organization_name), ''),
        application.applicant_name
      ),
      city_name,
      nullif(trim(application.social_url), ''),
      'verified',
      nullif(trim(admin_note), ''),
      admin_user_id,
      now()
    )
    on conflict (user_id) do update
    set city_id = excluded.city_id,
        organization_name = excluded.organization_name,
        contact_area = excluded.contact_area,
        social_url = coalesce(excluded.social_url, rescuer_profile.social_url),
        verification_status = 'verified',
        verification_note = excluded.verification_note,
        verified_by = excluded.verified_by,
        verified_at = excluded.verified_at,
        updated_at = now();

    update public.profiles
    set role = 'rescuer',
        updated_at = now()
    where id = application.user_id
      and role <> 'admin';
  end if;

  notification_event_type := case decision
    when 'approved' then 'rescuer_application_approved'
    else 'rescuer_application_rejected'
  end;

  insert into public.notifications (
    user_id,
    event_type,
    title,
    body,
    link,
    payload
  )
  values (
    application.user_id,
    notification_event_type,
    case decision
      when 'approved' then 'Solicitud de rescatista aprobada'
      else 'Actualizacion de tu solicitud de rescatista'
    end,
    case decision
      when 'approved' then 'Tu perfil de rescatista ya esta habilitado.'
      else 'Tu solicitud fue revisada. Podes consultar el detalle desde tu cuenta.'
    end,
    '/cuenta/perfil',
    jsonb_build_object(
      'application_id', application.id,
      'status', decision
    )
  );

  insert into public.admin_actions (
    admin_id,
    action,
    target_type,
    target_id,
    details
  )
  values (
    admin_user_id,
    'review_rescuer_application',
    'rescuer_application',
    application.id,
    jsonb_build_object('decision', decision, 'note', admin_note)
  );

  insert into public.audit_log (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    admin_user_id,
    'rescuer_application.reviewed',
    'rescuer_application',
    application.id::text,
    jsonb_build_object('decision', decision)
  );
end
$function$;

revoke all on function public.admin_review_rescuer_application(
  uuid,
  public.rescuer_application_status,
  text
) from public, anon;

grant execute on function public.admin_review_rescuer_application(
  uuid,
  public.rescuer_application_status,
  text
) to authenticated;

insert into private.app_migrations (version, name, details)
values (
  '017',
  'rescuer_approval_notification_fix',
  jsonb_build_object(
    'rescuer_approval_restored', true,
    'notification_event_types_compatible_with_009', true,
    'pending_applications_preserved', true
  )
);

notify pgrst, 'reload schema';

commit;
