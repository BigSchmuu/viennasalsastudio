-- Kursdaten, die eine Lehrkraft für ihre eigenen Kurse braucht (PROJ-49).
--
-- Nachtrag zu `get_course_participants`: Nicht nur `profiles` war für Lehrer
-- gesperrt. Drei weitere Tabellen liefern beim direkten Lesen stumm nichts:
--
--   `course_attendance`      — hat gar keine Leseregel (nur Funktionen lesen)
--   `subscriptions`          — Regel „eigene Zeile oder Admin"
--   `course_bookings`        — Regel „eigene Zeile oder Admin"
--
-- Ohne Fehlermeldung, mit leerem Ergebnis. Sichtbar wurde das erst an den
-- Tests: Geburtstage und Probestunden blieben leer, die Rollenverteilung zeigte
-- „0 Leader / 0 Follower", und jede vergangene Stunde galt als nicht erfasst.
--
-- Jede Funktion prüft dieselbe Frage wie die Anwesenheitsliste: Gehört der Kurs
-- der aufrufenden Lehrkraft? Wer nicht zugeordnet ist, bekommt nichts.

-- Welche Stunden bereits Anwesenheit haben — mehr als Kurs und Datum braucht
-- der Lehrer-Bereich dafür nicht.
create or replace function public.get_course_attendance_dates(p_course_ids uuid[])
returns table (course_id uuid, occurrence_date date)
language sql
stable
security definer
set search_path to 'public'
as $$
  select distinct a.course_id, a.occurrence_date
  from course_attendance a
  where a.course_id = any(p_course_ids)
    and (is_course_teacher(a.course_id) or "current_role"() = 'admin');
$$;

-- Kunden mit aktivem Abo — die „Schüler" eines Kurses.
create or replace function public.get_course_active_subscribers(p_course_ids uuid[])
returns table (course_id uuid, customer_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.course_id, s.customer_id
  from subscriptions s
  where s.course_id = any(p_course_ids)
    and s.status = 'active'
    and (is_course_teacher(s.course_id) or "current_role"() = 'admin');
$$;

-- Anstehende Probestunden im gefragten Zeitraum.
create or replace function public.get_course_trial_bookings(
  p_course_ids uuid[],
  p_von date,
  p_bis date
)
returns table (id uuid, course_id uuid, customer_id uuid, chosen_date date)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.id, b.course_id, b.customer_id, b.chosen_date
  from course_bookings b
  where b.course_id = any(p_course_ids)
    and b.type = 'trial'
    and b.status not in ('cancelled', 'rejected')
    and b.chosen_date between p_von and p_bis
    and (is_course_teacher(b.course_id) or "current_role"() = 'admin');
$$;

-- Gewählte Tanzrolle je Buchung, älteste zuerst — die jüngste Wahl gewinnt,
-- diese Auswertung bleibt beim Aufrufer.
--
-- Auch die Anwesenheitsliste aus PROJ-13 liest das bislang direkt und bekam als
-- Lehrer nichts: Die Leader/Follower-Markierung aus PROJ-30 war dort für die
-- eigentliche Zielgruppe nie sichtbar.
create or replace function public.get_course_dance_roles(p_course_ids uuid[])
returns table (course_id uuid, customer_id uuid, dance_role text, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.course_id, b.customer_id, b.dance_role, b.created_at
  from course_bookings b
  where b.course_id = any(p_course_ids)
    and b.type = 'regular'
    and b.dance_role is not null
    and (is_course_teacher(b.course_id) or "current_role"() = 'admin')
  order by b.created_at asc;
$$;

revoke all on function public.get_course_attendance_dates(uuid[]) from public, anon;
revoke all on function public.get_course_active_subscribers(uuid[]) from public, anon;
revoke all on function public.get_course_trial_bookings(uuid[], date, date) from public, anon;
revoke all on function public.get_course_dance_roles(uuid[]) from public, anon;

grant execute on function public.get_course_attendance_dates(uuid[]) to authenticated;
grant execute on function public.get_course_active_subscribers(uuid[]) to authenticated;
grant execute on function public.get_course_trial_bookings(uuid[], date, date) to authenticated;
grant execute on function public.get_course_dance_roles(uuid[]) to authenticated;
