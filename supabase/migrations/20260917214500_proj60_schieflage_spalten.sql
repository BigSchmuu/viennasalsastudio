-- PROJ-60, Korrektur: Die Schieflage war nie zu sehen.
--
-- `returns table (course_id uuid, ...)` legt in PL/pgSQL eine Variable namens
-- `course_id` an. Die beiden Zählungen weiter unten schrieben `where course_id
-- = c.id` ohne Tabellenpräfix — und Postgres wies den Aufruf mit 42702 ab:
-- „column reference course_id is ambiguous". Die Verwaltung bekam davon nichts
-- mit: `getSchieflage()` protokolliert den Fehler und liefert eine leere
-- Liste, und die Seite schrieb daraufhin „Gerade ist nichts zu tun".
--
-- Aufgefallen im Volllauf vom 2026-09-17 an der Serverausgabe, nicht an einem
-- Test — der neue Test in tests/PROJ-60-gasttaenzer.spec.ts geht jetzt den Weg
-- über die Verwaltungsseite und sieht den Vorschlag.
--
-- Gleiche Signatur wie zuvor: `create or replace` erhält damit die Rechte.

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
        + (select count(*) from course_bookings b
            where b.course_id = c.id and b.type = 'regular' and b.status = 'open'
              and b.dance_role = 'leader')
      )::integer as leader,
      (
        (select count(*) from subscriptions s
           join course_bookings cb on cb.subscription_id = s.id
          where s.course_id = c.id and s.status = 'active' and cb.dance_role = 'follower')
        + (select count(*) from course_bookings b
            where b.course_id = c.id and b.type = 'regular' and b.status = 'open'
              and b.dance_role = 'follower')
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
