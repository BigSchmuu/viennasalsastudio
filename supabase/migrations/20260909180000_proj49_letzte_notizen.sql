-- PROJ-49: Die jüngste Notiz je Kurs für den Lehrer-Bereich.
--
-- Notizen sind nur über SECURITY-DEFINER-Funktionen zugänglich; auf der Tabelle
-- selbst gibt es bewusst keine Regel. get_course_session_note() beantwortet
-- „welche Notiz steht an diesem Termin?" — der Lehrer-Bereich braucht aber
-- „was habe ich zuletzt notiert?", und zwar für mehrere Kurse auf einmal.
--
-- Derselbe Zaun wie bei der bestehenden Funktion: zugewiesene Lehrkraft oder
-- Admin. Wer nach fremden Kursen fragt, bekommt für diese schlicht keine Zeile
-- zurück — kein Fehler, denn ein Lehrer fragt im Regelfall mit seiner eigenen
-- Kursliste an, und ein Abbruch mitten in der Liste hälfe niemandem.
create or replace function public.get_last_session_notes(p_course_ids uuid[])
returns table (course_id uuid, occurrence_date date, note text)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
  select distinct on (n.course_id) n.course_id, n.occurrence_date, n.note
  from course_session_notes n
  where n.course_id = any(p_course_ids)
    and n.note is not null
    and n.note <> ''
    and (is_course_teacher(n.course_id) or "current_role"() = 'admin')
  order by n.course_id, n.occurrence_date desc;
end;
$$;

revoke all on function public.get_last_session_notes(uuid[]) from public;
grant execute on function public.get_last_session_notes(uuid[]) to authenticated;
