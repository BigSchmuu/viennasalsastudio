-- PROJ-60: Welche Kurse sind aus der Balance?
--
-- Gezählt wird **genau wie beim Buchen**: aktive Abos (die Rolle steht an der
-- Buchung, aus der das Abo entstand) plus offene reguläre Buchungen. Die
-- Vorlage dafür steht in der Buchungsfunktion aus PROJ-30.
--
-- Dass dieselben zwei Zählungen hier ein zweites Mal stehen, ist bewusst und
-- unschön: Eine eigene Rechnung in der Anwendung wäre schlimmer, weil sie
-- weiter weg von der ersten stünde. Wer die eine ändert, muss die andere
-- mitändern — sonst meldet die Verwaltung „im Gleichgewicht", während ein
-- Kunde gerade hört, er dürfe wegen der Balance nicht buchen.

create or replace function public.get_course_role_balance()
returns table (
  course_id uuid,
  course_name text,
  leader_count integer,
  follower_count integer,
  max_role_difference integer,
  fehlende_rolle text,
  fehlende_anzahl integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'not authorized';
  end if;

  return query
  with zaehlung as (
    select
      c.id,
      c.name,
      c.max_role_difference as grenze,
      (
        (select count(*) from subscriptions s
           join course_bookings cb on cb.subscription_id = s.id
          where s.course_id = c.id and s.status = 'active' and cb.dance_role = 'leader')
        + (select count(*) from course_bookings
            where course_id = c.id and type = 'regular' and status = 'open' and dance_role = 'leader')
      )::integer as leader,
      (
        (select count(*) from subscriptions s
           join course_bookings cb on cb.subscription_id = s.id
          where s.course_id = c.id and s.status = 'active' and cb.dance_role = 'follower')
        + (select count(*) from course_bookings
            where course_id = c.id and type = 'regular' and status = 'open' and dance_role = 'follower')
      )::integer as follower
    from courses c
    where c.role_query_enabled
      and c.max_role_difference is not null
      -- Beendete Kurse interessieren nicht mehr.
      and (c.runs_until is null or c.runs_until >= current_date)
  )
  select
    z.id,
    z.name,
    z.leader,
    z.follower,
    z.grenze,
    -- Gesucht wird die Rolle, von der zu *wenige* da sind.
    case when z.leader > z.follower then 'follower' else 'leader' end,
    (abs(z.leader - z.follower) - z.grenze)::integer
  from zaehlung z
  where abs(z.leader - z.follower) > z.grenze
  order by (abs(z.leader - z.follower) - z.grenze) desc, z.name;
end;
$$;

revoke execute on function public.get_course_role_balance() from public, anon;
grant execute on function public.get_course_role_balance() to authenticated;

comment on function public.get_course_role_balance() is
  'PROJ-60: Kurse, deren Rollendifferenz die eingestellte Grenze ueberschreitet. Zaehlt wie PROJ-30 beim Buchen.';
