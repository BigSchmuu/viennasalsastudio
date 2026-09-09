-- Namen und Geburtsdaten der eigenen Kursteilnehmer, für Lehrkräfte lesbar.
--
-- `profiles` erlaubt per Regel nur „eigene Zeile oder Admin". Eine Lehrkraft
-- bekommt beim direkten Lesen also nichts — stumm, ohne Fehler. Zwei Folgen:
--
-- 1. PROJ-49 konnte weder Geburtstage noch die Namen anstehender
--    Probestunden anzeigen.
-- 2. PROJ-31 ist davon schon länger betroffen: Das Geburtstags-Symbol in der
--    Anwesenheitsliste erscheint nur Admins, obwohl die Nutzergeschichte
--    ausdrücklich den Lehrer meint. Der zugehörige Test meldet sich als Admin
--    an und war deshalb immer grün.
--
-- Herausgegeben wird nur, was die Lehrkraft in der Anwesenheitsliste ohnehin
-- sieht: Personen mit aktivem Abo oder einer Buchung in ihren eigenen Kursen.
-- Kein Zugriff auf beliebige Profile.
create or replace function public.get_course_participants(p_course_ids uuid[])
returns table (customer_id uuid, full_name text, birthdate date)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
  select distinct p.id, p.full_name, p.birthdate
  from profiles p
  where p.id in (
    select s.customer_id from subscriptions s
    where s.course_id = any(p_course_ids)
      and s.status = 'active'
      and (is_course_teacher(s.course_id) or "current_role"() = 'admin')
    union
    select b.customer_id from course_bookings b
    where b.course_id = any(p_course_ids)
      and b.status not in ('cancelled', 'rejected')
      and (is_course_teacher(b.course_id) or "current_role"() = 'admin')
  );
end;
$$;

revoke all on function public.get_course_participants(uuid[]) from public;
grant execute on function public.get_course_participants(uuid[]) to authenticated;
