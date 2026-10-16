-- PROJ-90: Einchecken noch nachtraeglich bis 23 Uhr.
--
-- Nach oben gab es nie eine Grenze: Diese Funktion erlaubte den Selbst-Check-in
-- den ganzen Kurstag, gesperrt war nur das *Zuruecknehmen* nach Kursende. Weg
-- war bloss der Knopf -- das Kunden-Dashboard warf den Termin in der Sekunde
-- des Kursendes aus der Liste (siehe src/lib/dashboard/naechster-termin.ts).
-- Wer um 21:30 merkte, dass er vergessen hatte zu druecken, fand keine Stelle
-- mehr dafuer.
--
-- Mit dem Nachtragen braucht es die Grenze jetzt wirklich, und sie gehoert
-- hierher: Die Oberflaeche entscheidet, ob die Karte stehen bleibt, die
-- Datenbank entscheidet. Sonst waere die ganze Nacht offen.
--
-- Die Funktion ist im Uebrigen unveraendert aus der Fassung von PROJ-69
-- uebernommen; neu sind `v_nachtrag_bis` und ein Zweig.

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
  v_nachtrag_bis timestamptz;
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

  -- PROJ-90: 23 Uhr Wiener Zeit -- dieselbe Stunde wie
  -- SELF_CHECKIN_NACHTRAG_BIS_STUNDE in src/lib/constants/checkin.ts.
  --
  -- `greatest` haelt die Grenze hinter dem Kursende: Ein Kurs, der bis 23:30
  -- laeuft, waere sonst mitten im Unterricht nicht mehr eincheckbar. Der
  -- Kurstag selbst ist oben schon festgelegt -- `v_occurrence_date` ist heute
  -- in Wien, gestern ist also ohnehin unerreichbar.
  v_nachtrag_bis := greatest(
    (v_occurrence_date::text || ' 23:00')::timestamp at time zone 'Europe/Vienna',
    v_class_ends
  );

  if now() < v_class_opens then
    raise exception 'too early';
  end if;

  if now() >= v_nachtrag_bis then
    raise exception 'too late';
  end if;

  select status into v_existing_status
  from course_attendance
  where course_id = p_course_id and customer_id = v_customer_id and occurrence_date = v_occurrence_date;

  if v_existing_status = 'present' then
    -- Unveraendert aus PROJ-25: Ein Check-in, den die Lehrkraft gesehen hat,
    -- soll nicht nachtraeglich verschwinden. Nachtragen ist etwas anderes als
    -- Widerrufen.
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

comment on function public.self_toggle_attendance(uuid) is
  'PROJ-25/69/90: Selbst-Check-in fuer den heutigen Kursabend. Oeffnet 6 Stunden vor Kursbeginn, laesst bis 23 Uhr Wiener Zeit nachtragen (nie vor Kursende) und sperrt das Zuruecknehmen ab Kursende.';

-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.self_toggle_attendance(uuid) from public, anon;
grant execute on function public.self_toggle_attendance(uuid) to authenticated;
