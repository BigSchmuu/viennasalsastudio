-- PROJ-45: Der Kunde sieht auf seinem Dashboard, wie oft er zuletzt da war.
--
-- course_attendance ist bewusst abgeschottet: RLS ist aktiv, es gibt keine
-- einzige Policy, und jeder Zugriff laeuft ueber eine eigens gebaute Funktion
-- (Konvention aus PROJ-13). Diese Absicherung wird hier nicht gelockert.
-- Stattdessen bekommt der Kunde einen Zugang, der genau eine Frage
-- beantwortet: "wie oft war *ich* da". Keine Namen anderer Kunden, keine
-- Termine, keine Kursbelegung -- eine Zahl.
--
-- Die Funktion nimmt bewusst keinen Parameter. Waere der Zeitraum von aussen
-- waehlbar, koennten der Text im Dashboard ("in den letzten acht Wochen") und
-- die tatsaechlich gezaehlte Spanne auseinanderlaufen. So steht die Spanne an
-- genau einer Stelle.

create or replace function public.count_my_recent_attendance()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(*)::int
  from course_attendance ca
  where ca.customer_id = auth.uid()
    and ca.status = 'present'
    and ca.occurrence_date > public.heute_wien() - 56
    and ca.occurrence_date <= public.heute_wien();
$function$;

comment on function public.count_my_recent_attendance() is
  'PROJ-45: Anzahl der eigenen Anwesenheiten der letzten acht Wochen. Liefert nur eine Zahl ueber den Aufrufer selbst.';

-- Standardmaessig darf PUBLIC jede neue Funktion ausfuehren. Fuer eine
-- Funktion auf einer abgeschotteten Tabelle ist das zu viel: erst entziehen,
-- dann gezielt den angemeldeten Kunden geben. Anonyme Besucher haben hier
-- nichts zu suchen -- auth.uid() waere ohnehin null, aber das ist eine
-- Eigenschaft der Abfrage, keine Zugangsregel.
revoke execute on function public.count_my_recent_attendance() from public, anon;
grant execute on function public.count_my_recent_attendance() to authenticated, service_role;

-- Der Primaerschluessel ist (course_id, customer_id, occurrence_date) -- fuer
-- eine Suche nach dem Kunden also die falsche Reihenfolge. Bei sechs Zeilen
-- egal, bei ein paar tausend nicht mehr.
create index if not exists idx_course_attendance_customer_date
  on public.course_attendance (customer_id, occurrence_date);
