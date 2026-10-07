-- PROJ-78: Die Wegbeschreibung eines Standorts auch auf Englisch.
--
-- Seit PROJ-77 steht die Beschreibung des Standorts in der Kursstart-Erinnerung
-- ("So findest du uns: ..."). Die Einleitung ist zweisprachig, der Text selbst
-- war es nicht: Ein englischsprachiger Kunde las eine englische Einleitung und
-- danach Deutsch.
--
-- PROJ-43 hatte zweisprachige Datenbankinhalte ausdruecklich zurueckgestellt --
-- "nachruestbar, wenn es im Betrieb stoert". Es stoert (gemeldet 2026-10-07).
--
-- Eine Spalte, keine eigene Tabelle: Das Studio fuehrt genau zwei Sprachen, und
-- die Beschreibung erscheint an genau einer Stelle. Eine Uebersetzungstabelle
-- waere Mechanik fuer einen Fall, der nicht ansteht.
--
-- Bleibt die Spalte leer, gilt die deutsche Fassung (Entscheidung des
-- Betreibers): Eine Wegbeschreibung hilft auch in der falschen Sprache noch zur
-- Tuer -- dieselbe Abwaegung wie bei den Benachrichtigungs-Vorlagen.
alter table public.locations
  add column if not exists description_en text;

comment on column public.locations.description_en is
  'PROJ-78: Englische Fassung der Wegbeschreibung. Leer = die deutsche Fassung (description) gilt auch fuer englischsprachige Empfaenger.';
