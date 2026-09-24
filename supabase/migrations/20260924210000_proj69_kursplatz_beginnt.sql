-- PROJ-69: Ein Kursplatz gilt erst ab seinem Starttermin.
--
-- Aus dem Betrieb gemeldet (2026-09-24): Ein Kunde hatte die Flatrate für
-- Oktober gebucht und konnte sich noch im September einchecken. Derselbe Kunde
-- stand auch schon auf der Anwesenheitsliste des Lehrers.
--
-- Die gemeinsame Antwort `course_members` kannte nur „aktiv" und „nicht
-- beendet" — der Beginn kam darin nicht vor, obwohl er an beiden Quellen
-- steht: beim kursgebundenen Abo als `cycle_anchor_date`, beim Flatrate-Platz
-- als `started_on` (gesetzt aus dem gewünschten Einstiegstermin).
--
-- Der Platz bleibt ab der Bestätigung belegt — sonst ließe sich der Kurs
-- überbuchen, weil der Oktober-Platz nicht mitzählte (Entscheidung des
-- Betreibers). Geändert wird nur, was sich auf einen **Tag** bezieht:
-- Selbst-Check-in und Anwesenheitsliste.

-- 1. Die gemeinsame Antwort nennt jetzt auch, ab wann sie gilt.
--
-- Neue Spalte am Ende: `create or replace view` verträgt das, bestehende
-- Lesestellen bleiben unberührt.
create or replace view public.course_members as
  select
    s.course_id,
    s.customer_id,
    s.id           as subscription_id,
    cb.dance_role,
    'abo'::text    as quelle,
    s.cycle_anchor_date as gilt_ab
  from public.subscriptions s
  left join public.course_bookings cb
    on cb.subscription_id = s.id and cb.type = 'regular'
  where s.status = 'active' and s.course_id is not null
union all
  select
    m.course_id,
    m.customer_id,
    m.subscription_id,
    m.dance_role,
    'flatrate'::text as quelle,
    m.started_on     as gilt_ab
  from public.course_memberships m
  join public.subscriptions s on s.id = m.subscription_id
  where m.ended_on is null and s.status = 'active';

comment on view public.course_members is
  'PROJ-50/PROJ-69: Die einzige Antwort auf „wer ist in diesem Kurs?". Vereint kursgebundene Abos und Flatrate-Kursplaetze. `gilt_ab` sagt, ab welchem Tag der Platz zaehlt -- fuer alles Tagesbezogene (Check-in, Anwesenheitsliste) ist das zu beachten; fuer die Kursgrenze nicht, dort zaehlt der Platz ab der Bestaetigung.';

revoke all on public.course_members from public, anon, authenticated;

-- 2. Der Selbst-Check-in.
create or replace function public.self_toggle_attendance(p_course_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_customer_id uuid := auth.uid();
  v_occurrence_date date := public.heute_wien();
  v_weekday int;
  v_start_time time;
  v_end_time time;
  v_is_paused boolean;
  v_ist_teilnehmer boolean;
  v_beginn date;
  v_class_opens timestamptz;
  v_class_ends timestamptz;
  v_existing_status text;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  select cs.weekday, cs.start_time, cs.end_time
    into v_weekday, v_start_time, v_end_time
  from course_schedule cs
  where cs.course_id = p_course_id;

  if v_weekday is null then
    raise exception 'no schedule';
  end if;

  -- App-wide weekday convention: 0=Montag..6=Sonntag (jsDayToWeekday).
  -- Postgres isodow: 1=Monday..7=Sunday.
  if v_weekday <> (extract(isodow from v_occurrence_date)::int - 1) then
    raise exception 'not today';
  end if;

  select exists (
    select 1
    from course_schedule_pauses p
    join course_schedule cs2 on cs2.id = p.schedule_id
    where cs2.course_id = p_course_id and p.pause_date = v_occurrence_date
  ) into v_is_paused;
  if v_is_paused then
    raise exception 'course paused today';
  end if;

  select exists (
    select 1 from course_members
    where course_id = p_course_id and customer_id = v_customer_id
  ) into v_ist_teilnehmer;
  if not v_ist_teilnehmer then
    raise exception 'no active subscription';
  end if;

  -- PROJ-69: Der frueheste Beginn seiner Plaetze in diesem Kurs. Liegt er in
  -- der Zukunft, ist der Platz gebucht, aber heute noch nicht gueltig.
  select min(cm.gilt_ab) into v_beginn
  from course_members cm
  where cm.course_id = p_course_id and cm.customer_id = v_customer_id;

  if v_beginn > v_occurrence_date then
    raise exception 'membership not started';
  end if;

  -- start_time/end_time are entered and displayed as Vienna wall-clock time
  -- everywhere else in the app; interpret them as such here too (not as
  -- naive UTC), otherwise the window would be off by the Vienna/UTC offset
  -- (1-2h depending on DST).
  --
  -- Die Frist steht auch in src/lib/constants/checkin.ts. Dort entscheidet sie,
  -- ob der Knopf erscheint; hier entscheidet sie wirklich. Wer eine aendert,
  -- aendert beide.
  v_class_opens := ((v_occurrence_date::text || ' ' || v_start_time::text)::timestamp at time zone 'Europe/Vienna') - interval '6 hours';
  v_class_ends := (v_occurrence_date::text || ' ' || v_end_time::text)::timestamp at time zone 'Europe/Vienna';

  if now() < v_class_opens then
    raise exception 'too early';
  end if;

  select status into v_existing_status
  from course_attendance
  where course_id = p_course_id and customer_id = v_customer_id and occurrence_date = v_occurrence_date;

  if v_existing_status = 'present' then
    if now() >= v_class_ends then
      raise exception 'cannot undo after class end';
    end if;
    delete from course_attendance
    where course_id = p_course_id and customer_id = v_customer_id and occurrence_date = v_occurrence_date;
    return 'removed';
  else
    insert into course_attendance (course_id, customer_id, occurrence_date, status, marked_by)
    values (p_course_id, v_customer_id, v_occurrence_date, 'present', v_customer_id)
    on conflict (course_id, customer_id, occurrence_date)
    do update set status = 'present', marked_by = v_customer_id, updated_at = now();
    return 'present';
  end if;
end;
$$;

-- 3. Die Anwesenheitsliste eines Tages.
--
-- Unveraendert aus der Fassung von PROJ-60 uebernommen (Gaeste!), ergaenzt um
-- den Beginn an beiden Stellen, an denen `course_members` vorkommt: in der
-- Erwartungsliste und in der Ausschlussliste darunter. Beide muessen dasselbe
-- sagen, sonst verschwindet ein vorzeitig eingetragener Kunde aus beiden.
create or replace function public.get_course_attendance_roster(p_course_id uuid, p_occurrence_date date)
returns table (customer_id uuid, full_name text, source text, status text, self_checked_in boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not (is_course_teacher(p_course_id) or "current_role"() = 'admin') then
    raise exception 'not authorized';
  end if;
  return query
  with expected_all as (
    select cm.customer_id, 'abo' as source, 1 as priority from course_members cm
    where cm.course_id = p_course_id and cm.gilt_ab <= p_occurrence_date
    union all
    select cb.customer_id, 'buchung' as source, 2 as priority from course_bookings cb
    where cb.course_id = p_course_id and cb.type in ('trial', 'dropin') and cb.status = 'confirmed'
      and cb.chosen_date = p_occurrence_date
    union all
    select cb.customer_id, 'gast' as source, 2 as priority from course_bookings cb
    where cb.course_id = p_course_id and cb.type = 'guest' and cb.status = 'confirmed'
      and cb.chosen_date = p_occurrence_date
    union all
    select ca.customer_id, 'manuell' as source, 3 as priority from course_attendance ca
    where ca.course_id = p_course_id and ca.occurrence_date = p_occurrence_date
      and ca.customer_id not in (
        select cm2.customer_id from course_members cm2
        where cm2.course_id = p_course_id and cm2.gilt_ab <= p_occurrence_date
        union
        select cb2.customer_id from course_bookings cb2
        where cb2.course_id = p_course_id and cb2.type in ('trial', 'dropin', 'guest')
          and cb2.status = 'confirmed' and cb2.chosen_date = p_occurrence_date
      )
  ),
  expected as (
    select distinct on (expected_all.customer_id) expected_all.customer_id, expected_all.source
    from expected_all order by expected_all.customer_id, expected_all.priority
  )
  select e.customer_id, p.full_name, e.source, ca.status,
    (ca.marked_by is not null and ca.marked_by = e.customer_id) as self_checked_in
  from expected e
  join profiles p on p.id = e.customer_id
  left join course_attendance ca
    on ca.course_id = p_course_id and ca.customer_id = e.customer_id and ca.occurrence_date = p_occurrence_date
  order by p.full_name;
end;
$$;

-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.self_toggle_attendance(uuid) from public, anon;
revoke all on function public.get_course_attendance_roster(uuid, date) from public, anon;

grant execute on function public.self_toggle_attendance(uuid) to authenticated;
grant execute on function public.get_course_attendance_roster(uuid, date) to authenticated;
