-- PROJ-56, Nachtrag: das Kontingent einer Ticketart öffentlich sichtbar machen
-- (QA-Befund BUG-1).
--
-- Die Eventseite weiß nicht, wie viele Tickets einer Art schon verkauft sind —
-- Tickets sind nicht öffentlich lesbar, und das soll so bleiben. Ohne die Zahl
-- gilt jede Art als unbegrenzt: Sie wird angeboten, der Kunde wählt sie, und
-- erst die Datenbank weist den Kauf ab. Niemand bekommt ein Ticket zu viel,
-- aber der Kunde läuft in eine Sackgasse.
--
-- Dieselbe Bauart wie get_event_unit_occupancy und get_event_occupancy
-- (PROJ-12): Die Zahl darf jeder sehen, die Tickets dahinter nicht.
create or replace function public.get_event_type_occupancy(p_event_id uuid)
returns table(ticket_type_id uuid, ticket_count bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    tt.id as ticket_type_id,
    count(t.id) as ticket_count
  from event_ticket_types tt
  left join tickets t
    on t.ticket_type_id = tt.id
   and t.status in ('reserved', 'confirmed', 'checked_in')
  where tt.event_id = p_event_id
  group by tt.id;
$function$;

revoke all on function public.get_event_type_occupancy(uuid) from public, anon;
grant execute on function public.get_event_type_occupancy(uuid) to anon, authenticated;
