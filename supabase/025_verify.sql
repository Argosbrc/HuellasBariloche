-- Verificacion de la migracion 025

select
  case
    when to_regprocedure('public.start_sighting_conversation(uuid,uuid)') is null
      then 'FAIL: falta start_sighting_conversation'
    when not exists (select 1 from private.app_migrations where version = '025')
      then 'FAIL: falta registro en app_migrations'
    when lower(pg_get_functiondef('public.get_my_pet_sighting_alerts_v1()'::regprocedure::oid)) not like '%reporter_user_id%'
      then 'FAIL: get_my_pet_sighting_alerts_v1 no expone reporter_user_id'
    else 'PASS'
  end as migration_025_status;
