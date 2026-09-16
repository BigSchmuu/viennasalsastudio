-- PROJ-25: Das Fenster fuer den Selbst-Check-in von 30 Minuten auf 6 Stunden.
--
-- Auf Wunsch des Betreibers (2026-09-16): Wer morgens weiss, dass er abends
-- kommt, soll das sagen koennen, statt bis kurz vor Kursbeginn zu warten.
--
-- Die Funktion ist im Uebrigen unveraendert aus der Fassung von PROJ-50
-- uebernommen; geaendert ist genau das Intervall.

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

  -- HIER die einzige Änderung: über die gemeinsame Antwort statt über
  -- `subscriptions.course_id`.
  select exists (
    select 1 from course_members
    where course_id = p_course_id and customer_id = v_customer_id
  ) into v_ist_teilnehmer;
  if not v_ist_teilnehmer then
    raise exception 'no active subscription';
  end if;

  -- start_time/end_time are entered and displayed as Vienna wall-clock time
  -- everywhere else in the app; interpret them as such here too (not as
  -- naive UTC), otherwise the window would be off by the Vienna/UTC offset
  -- (1-2h depending on DST).
  --
  -- Die Frist steht auch in src/lib/constants/checkin.ts. Dort entscheidet sie,
  -- ob der Knopf erscheint; hier entscheidet sie wirklich. Wer eine aendert,
  -- aendert beide — sonst erscheint der Knopf zu frueh und wird abgewiesen,
  -- oder er bleibt weg, obwohl es ginge.
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
