-- Public-safe aggregate occupancy, mirroring get_course_occupancy (PROJ-12).
-- tickets itself is RLS-scoped to "own row or staff", so anonymous/other
-- customers need this to see accurate capacity without exposing any PII.
create or replace function public.get_event_occupancy()
returns table(event_id uuid, ticket_count bigint)
language sql
security definer
set search_path to 'public'
stable
as $$
  select event_id, count(*) as ticket_count
  from tickets
  where status in ('reserved', 'confirmed', 'checked_in')
  group by event_id;
$$;

grant execute on function public.get_event_occupancy() to anon, authenticated;
