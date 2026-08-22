
-- PROJ-25: Self-Check-In für Kursanwesenheit (Abo-Kunden).
-- course_attendance has RLS enabled but deliberately no policies at all
-- (PROJ-13 convention) — every access goes through a SECURITY DEFINER
-- function that does its own authorization check. This keeps that
-- convention: customers get a dedicated, narrowly-scoped write path
-- instead of a raw table policy (see PROJ-14 BUG-1 for why a raw
-- customer-facing UPDATE policy on a status/ownership-sensitive table is
-- risky — it can't restrict which columns are allowed to change).

create or replace function public.self_toggle_attendance(p_course_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := auth.uid();
  v_occurrence_date date := current_date;
  v_weekday int;
  v_start_time time;
  v_end_time time;
  v_is_paused boolean;
  v_has_active_sub boolean;
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
    select 1 from subscriptions
    where course_id = p_course_id and customer_id = v_customer_id and status = 'active'
  ) into v_has_active_sub;
  if not v_has_active_sub then
    raise exception 'no active subscription';
  end if;

  -- start_time/end_time are entered and displayed as Vienna wall-clock time
  -- everywhere else in the app; interpret them as such here too (not as
  -- naive UTC), otherwise the 30-minute window would be off by the
  -- Vienna/UTC offset (1-2h depending on DST).
  v_class_opens := ((v_occurrence_date::text || ' ' || v_start_time::text)::timestamp at time zone 'Europe/Vienna') - interval '30 minutes';
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
$function$;

create or replace function public.get_my_todays_attendance()
returns table(course_id uuid, status text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select ca.course_id, ca.status
  from course_attendance ca
  where ca.customer_id = auth.uid() and ca.occurrence_date = current_date;
$function$;

-- Extend the existing roster function with a self-check-in indicator.
-- Return-type change requires drop+recreate.
drop function public.get_course_attendance_roster(uuid, date);

create function public.get_course_attendance_roster(p_course_id uuid, p_occurrence_date date)
returns table(customer_id uuid, full_name text, source text, status text, self_checked_in boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not (is_course_teacher(p_course_id) or "current_role"() = 'admin') then
    raise exception 'not authorized';
  end if;

  return query
  with expected_all as (
    select s.customer_id, 'abo' as source, 1 as priority
    from subscriptions s
    where s.course_id = p_course_id and s.status = 'active'
    union all
    select cb.customer_id, 'buchung' as source, 2 as priority
    from course_bookings cb
    where cb.course_id = p_course_id
      and cb.type in ('trial', 'dropin')
      and cb.status = 'confirmed'
      and cb.chosen_date = p_occurrence_date
    union all
    select ca.customer_id, 'manuell' as source, 3 as priority
    from course_attendance ca
    where ca.course_id = p_course_id and ca.occurrence_date = p_occurrence_date
      and ca.customer_id not in (
        select s2.customer_id from subscriptions s2 where s2.course_id = p_course_id and s2.status = 'active'
        union
        select cb2.customer_id from course_bookings cb2
        where cb2.course_id = p_course_id and cb2.type in ('trial', 'dropin') and cb2.status = 'confirmed'
          and cb2.chosen_date = p_occurrence_date
      )
  ),
  expected as (
    select distinct on (expected_all.customer_id) expected_all.customer_id, expected_all.source
    from expected_all
    order by expected_all.customer_id, expected_all.priority
  )
  select e.customer_id, p.full_name, e.source, ca.status,
    (ca.marked_by is not null and ca.marked_by = e.customer_id) as self_checked_in
  from expected e
  join profiles p on p.id = e.customer_id
  left join course_attendance ca
    on ca.course_id = p_course_id and ca.customer_id = e.customer_id and ca.occurrence_date = p_occurrence_date
  order by p.full_name;
end;
$function$;
