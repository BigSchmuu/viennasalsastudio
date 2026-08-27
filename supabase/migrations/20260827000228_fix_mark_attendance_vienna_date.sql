-- Die Anwesenheit fuer den heutigen Termin liess sich nachts nicht markieren.
--
-- current_date rechnet in der Zeitzone der Datenbank, und die steht bei
-- Supabase auf UTC. Zwischen Mitternacht und 2 Uhr Wiener Zeit (im Winter
-- einer) ist der heutige Wiener Tag dort noch "morgen" -- die Pruefung
-- "kein zukuenftiger Termin" schlug also zu, obwohl der Kurs gerade
-- stattgefunden hatte. Ein Lehrer, der nach einem spaeten Kurs die
-- Anwesenheit eintraegt, bekam die Eingabe still abgewiesen.
--
-- Nachgewiesen ueber die Oberflaeche: Der Knopf liess sich klicken, es kam
-- weder ein Fehler in der Konsole noch eine abgelehnte Anfrage, und der
-- Status blieb trotzdem leer.
--
-- Verglichen wird jetzt mit dem Kalendertag in Wien -- derselbe Massstab,
-- den die App seit dem Zeitzonen-Fix verwendet.
create or replace function public.mark_attendance(
  p_course_id uuid,
  p_customer_id uuid,
  p_occurrence_date date,
  p_status text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not (is_course_teacher(p_course_id) or "current_role"() = 'admin') then
    raise exception 'not authorized';
  end if;
  if p_occurrence_date > (now() at time zone 'Europe/Vienna')::date then
    raise exception 'cannot mark attendance for a future date';
  end if;
  if p_status not in ('present', 'absent') then
    raise exception 'invalid status';
  end if;

  insert into course_attendance (course_id, customer_id, occurrence_date, status, marked_by)
  values (p_course_id, p_customer_id, p_occurrence_date, p_status, auth.uid())
  on conflict (course_id, customer_id, occurrence_date)
  do update set status = excluded.status, marked_by = excluded.marked_by, updated_at = now();
end;
$function$;
