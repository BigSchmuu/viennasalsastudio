-- PROJ-97, Nachtrag: Ein Kommentar, der die eigene Funktion falsch beschrieb.
--
-- Gefunden bei der Durchsicht nach festen Zyklusfenstern (2026-11-05).
--
-- `flatrate_upgrade_angerechnet` summiert nur `flatrate_upgrade_anrechnung`
-- und rechnet damit seit PROJ-97 richtig -- ferienbewusst, nach
-- Unterrichtswochen. Ihr eigener Kommentar stand aber noch aus PROJ-88 und
-- sagte "Barzahlungen der letzten 28 Tage".
--
-- Nur ein Kommentar, und trotzdem eine Falle: Wer eine Funktion liest, statt
-- sie zu testen, glaubt ihr. Genau so entstand die Annahme, die PROJ-97
-- aufraeumen musste.
--
-- Der Rumpf wird nicht angefasst. `comment on function` setzt die Rechte
-- **nicht** zurueck -- anders als `create or replace function`, das Supabase
-- EXECUTE per Default-Privileg neu an `anon` vergeben laesst. Hier braucht es
-- deshalb kein revoke/grant, und das steht hier, damit die fehlenden Zeilen
-- nicht wie ein Versehen aussehen.
comment on function public.flatrate_upgrade_angerechnet(uuid) is
  'PROJ-88/97: Summe der Anrechnung -- Einzuege ohne Rueckbuchung und Barzahlungen, die zum laufenden Zyklus gehoeren (gerechnet nach Unterrichtswochen, siehe flatrate_upgrade_anrechnung). Die Differenz beim Upgrade ist Flatrate-Preis minus dieser Summe, mindestens null.';
