-- Ausführungsrecht für Nicht-Angemeldete entziehen (QA-Befund vom 2026-09-09).
--
-- Drei Funktionen waren ohne Anmeldung aufrufbar. Herausgegeben haben sie
-- nichts — der Zaun sitzt in ihrem Rumpf: `get_course_attendance_roster` wirft
-- „not authorized", die beiden anderen filtern auf null Zeilen. Es fehlte die
-- zweite Schranke, und die gehört dazu.
--
-- Die Ursache ist eine Falle, die bei jeder künftigen Funktion wieder zuschlägt:
--
--   `create or replace function` setzt die Rechte einer Funktion zurück, und
--   Supabase vergibt per Default-Privileg `EXECUTE` erneut an `anon`. Ein
--   `revoke ... from public` entfernt das **nicht** — `anon` ist eine eigene
--   Rolle, kein Teil von PUBLIC.
--
-- Wer also eine Funktion mit `create or replace` überarbeitet, muss `anon` das
-- Recht danach erneut entziehen. Sonst ist sie wieder offen, ohne dass sich
-- an ihrem Rumpf etwas geändert hätte.
-- Beim Anwenden kam noch ein zweiter Weg zum Vorschein: Der Roster hatte in
-- seiner Rechteliste einen Eintrag mit leerem Empfänger (`=X/postgres`), also
-- PUBLIC. Ein Entzug bei `anon` allein greift dort nicht — die Rolle erbt das
-- Recht über PUBLIC. Deshalb beides, für alle drei.
revoke all on function public.get_course_participants(uuid[]) from public, anon;
revoke all on function public.get_last_session_notes(uuid[]) from public, anon;
revoke all on function public.get_course_attendance_roster(uuid, date) from public, anon;

-- Die eigentliche Zielgruppe behält ihr Recht.
grant execute on function public.get_course_participants(uuid[]) to authenticated;
grant execute on function public.get_last_session_notes(uuid[]) to authenticated;
grant execute on function public.get_course_attendance_roster(uuid, date) to authenticated;
