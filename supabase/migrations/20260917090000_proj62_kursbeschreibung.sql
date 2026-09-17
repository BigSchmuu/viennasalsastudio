-- PROJ-62: Eine freiwillige Beschreibung je Kurs.
--
-- Die Kursseite wird zur Landeseite fuer Interessenten von der Website. Dort
-- stand bisher nur, was in Feldern erfasst ist — Level, Tanzstil, Ort, Zeiten,
-- Preis. Es fehlten die zwei, drei Saetze, fuer wen der Kurs ist.
--
-- Freiwillig und ohne Vorgabewert: Nicht jeder Kurs braucht einen Text, und ein
-- leeres Feld soll auf der Seite gar nicht erst erscheinen.
--
-- Die Laengengrenze entspricht der bei den Events (PROJ-53). Die Datenbank
-- setzt sie mit durch, damit sie auch dann gilt, wenn jemand am Formular
-- vorbei schreibt.

alter table public.courses
  add column if not exists description text;

alter table public.courses
  add constraint courses_description_laenge
  check (description is null or char_length(description) <= 2000);

comment on column public.courses.description is
  'PROJ-62: Freiwillige Beschreibung, erscheint auf der Kursseite. Hoechstens 2000 Zeichen.';
