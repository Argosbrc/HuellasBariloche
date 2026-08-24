# Reversion controlada de la migracion 015

No ejecutes esta reversion si ya existen publicaciones creadas mediante la web
sin preparar antes un inventario de `private.pet_post_requests`.

```sql
begin;

revoke all on function public.create_pet_post_v1(
  uuid, text, text, text, text, text, text, text, text[], text,
  text, text, text, text[], text, double precision, double precision,
  text, boolean, timestamptz
) from public, anon, authenticated;

drop function public.create_pet_post_v1(
  uuid, text, text, text, text, text, text, text, text[], text,
  text, text, text, text[], text, double precision, double precision,
  text, boolean, timestamptz
);

drop table private.pet_post_requests;
delete from private.app_migrations where version = '015';

grant insert (
  rescuer_profile_id, post_type, name, species, breed, sex, age_label,
  size_label, colors, distinctive_features, description, health_status,
  adoption_requirements, photo_paths, zone_name, public_latitude,
  public_longitude, location_precision, show_whatsapp, event_at, pet_id
) on table public.pet_posts to authenticated;

grant insert (
  pet_post_id, exact_latitude, exact_longitude, address_notes
) on table public.pet_locations_private to authenticated;

commit;
```

La reversion no elimina casos ni fotografias. Solo retira el contrato de alta y
su registro de idempotencia.
