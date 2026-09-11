-- PROJ-51 BUG-1: Die Umwandlung nimmt den Zeitraum der neuen Staffel mit.
--
-- Gefunden im QA-Durchgang vom 2026-09-11, und es war der Hauptweg durch das
-- Feature, nicht ein Randfall: Ein Kurs mit „läuft bis 21.12." und einer
-- Umwandlung zum 07.01. wurde am Stichtag umbenannt — `runs_until` blieb aber
-- auf dem 21.12. stehen. Ab dem 22.12. fiel der Kurs aus dem Stundenplan und
-- kam nie zurück, obwohl die Kunden vorher die Ankündigung bekommen hatten,
-- dass es als Beginner 2 weitergeht.
--
-- Die Ursache war ein zu enger Begriff von „Umwandlung": Name und Level, aber
-- nicht der Zeitraum. Eine Staffel ist aber genau beides — ein Kurs unter
-- neuem Namen *und* ein neues Ende. Deshalb gehört das Ende der neuen Staffel
-- in die Vormerkung.
--
-- Nur das Ende, nicht der Beginn: `runs_from` bleibt beim Vollzug stehen, weil
-- die Anwesenheitsliste des Lehrers ihre Historie daran begrenzt. Auf den
-- Stichtag gesetzt, verschwände alles, was vor der Umwandlung stattfand.
alter table public.courses
  add column if not exists pending_runs_until date;

comment on column public.courses.pending_runs_until is
  'PROJ-51: Das Ende der neuen Staffel. Wird beim Vollzug zu courses.runs_until; leer heißt unbefristet.';

-- Die Vormerkung bleibt ein Ganzes: entweder steht sie, oder sie steht nicht.
-- Ein Enddatum ohne Vormerkung wäre eine Angabe, die niemand ausführt.
alter table public.courses drop constraint if exists courses_umwandlung_vollstaendig;
alter table public.courses add constraint courses_umwandlung_vollstaendig
  check (
    (pending_name is null and pending_level is null and pending_effective_date is null
      and pending_runs_until is null)
    or (pending_name is not null and pending_effective_date is not null)
  );

-- Dieselbe Prüfung wie am Kurs selbst: Ein Ende vor dem Stichtag ergibt keinen
-- Zeitraum — ab dem Stichtag gilt die neue Staffel.
alter table public.courses drop constraint if exists courses_umwandlung_zeitraum_sinnvoll;
alter table public.courses add constraint courses_umwandlung_zeitraum_sinnvoll
  check (
    pending_runs_until is null
    or pending_effective_date is null
    or pending_runs_until >= pending_effective_date
  );
