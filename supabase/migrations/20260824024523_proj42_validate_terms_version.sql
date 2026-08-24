-- PROJ-42 BUG-1: Der AGB-Stand war ein freies Textfeld.
--
-- Die Server Action setzt ihn korrekt aus AGB_VERSION, aber die Funktionen sind
-- ueber PostgREST auch direkt erreichbar. Ein eingeloggter Kunde konnte damit
-- '1999-01' oder 5000 Zeichen Muell an seine eigene Buchung schreiben — und
-- genau die Frage verfaelschen, die dieses Feature beantworten soll.
--
-- Drei Bedingungen, alle aus dem, was die Datenbank ohnehin weiss:
--   1. Form JJJJ-MM mit einem echten Monat. Kappt Muell und '2026-99'.
--   2. Nicht in der Zukunft. Niemand stimmt einer Fassung zu, die es noch
--      nicht gibt.
--   3. Nicht vor 2026-01. Die App gibt es nicht laenger; alles davor ist
--      erfunden.
--
-- Was bleibt: ein Kunde kann einen *plausiblen* vergangenen Monat waehlen.
-- Dafuer braeuchte es eine Liste gueltiger Staende in der Datenbank — dann
-- gaebe es zwei Orte, die auseinanderlaufen koennen. Der Zeitstempel kommt
-- ohnehin vom Server und haelt den wahren Moment fest.
create or replace function public.assert_valid_terms_version(p_version text)
returns text
language plpgsql
immutable
as $$
declare
  v_version text := trim(coalesce(p_version, ''));
begin
  if v_version = '' then
    raise exception 'terms version missing';
  end if;
  if v_version !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'terms version invalid';
  end if;
  if v_version > to_char(current_date, 'YYYY-MM') then
    raise exception 'terms version invalid';
  end if;
  if v_version < '2026-01' then
    raise exception 'terms version invalid';
  end if;
  return v_version;
end;
$$;

comment on function public.assert_valid_terms_version(text) is
  'PROJ-42 BUG-1: Prueft den AGB-Stand auf Form JJJJ-MM, echten Monat und plausiblen Zeitraum. Gibt ihn zurueck oder wirft.';

-- Zusaetzlich in der Tabelle verankert, damit auch ein kuenftiger Schreibweg
-- keinen Muell ablegen kann. Bewusst nur die Form, ohne Zeitbezug: ein CHECK
-- muss unveraenderlich sein, current_date ist es nicht.
alter table public.course_bookings
  add constraint course_bookings_terms_version_format
  check (terms_version is null or terms_version ~ '^\d{4}-(0[1-9]|1[0-2])$');

alter table public.waitlist_entries
  add constraint waitlist_entries_terms_version_format
  check (terms_version is null or terms_version ~ '^\d{4}-(0[1-9]|1[0-2])$');

alter table public.tickets
  add constraint tickets_terms_version_format
  check (terms_version is null or terms_version ~ '^\d{4}-(0[1-9]|1[0-2])$');
