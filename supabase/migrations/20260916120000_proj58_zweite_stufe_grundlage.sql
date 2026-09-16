-- PROJ-58: Grundlage für die Zwei-Faktor-Anmeldung der Verwaltungskonten.
--
-- Diese Migration ist harmlos: Sie ändert nichts an bestehenden Rechten und
-- sperrt niemanden aus. Sie darf jederzeit eingespielt werden.
-- Das Scharfschalten steht in der zweiten Datei.

-- ---------------------------------------------------------------------------
-- 1. Die Benachrichtigung beim Zurücksetzen
-- ---------------------------------------------------------------------------
-- Die Prüfbedingung listet die erlaubten Ereignistypen einzeln auf. Ohne
-- diesen Eintrag scheitert das Einreihen still: enqueueAndDispatch
-- protokolliert den Fehler nur, damit ein misslungener Versand nie die
-- auslösende Handlung mitreißt. Genau das ist in diesem Projekt schon
-- passiert — deshalb steht der Hinweis hier ein zweites Mal.

alter table public.notification_queue drop constraint notification_queue_event_type_check;

alter table public.notification_queue add constraint notification_queue_event_type_check
  check (event_type = any (array[
    'buchungsstatus',
    'warteliste',
    'abo_kuendigung',
    'kursstart_erinnerung',
    'sepa_ankuendigung',
    'event_tickets',
    'probestunde_nachfassung',
    'newsletter',
    'neue_buchung',
    'zahlungserinnerung',
    'kursausfall',
    'guthaben',
    'konto_existiert',
    'kursumwandlung',
    'zweite_stufe_zurueckgesetzt'
  ]));

-- ---------------------------------------------------------------------------
-- 2. Alle Anmeldungen eines Kontos beenden
-- ---------------------------------------------------------------------------
-- Wird gebraucht, wenn ein Admin die zweite Stufe eines anderen zurücksetzt:
-- Ohne diesen Schritt liefe eine bereits offene Sitzung des Betroffenen
-- weiter, obwohl ihr Nachweis gerade entfernt wurde — und ein Verdachtsfall
-- ist der häufigste Grund, überhaupt zurückzusetzen.
--
-- Warum eine eigene Funktion: Die Bibliothek kann fremde Sitzungen nicht
-- beenden, sie verlangt dafür das Anmeldetoken des Betroffenen, das wir nicht
-- haben. Das Löschen der Sitzungszeile ist genau das, was ein Abmelden tut.
--
-- SECURITY DEFINER, weil `auth.sessions` niemandem sonst offensteht. Die
-- Rechteprüfung steht deshalb *in* der Funktion — und sie erbt automatisch die
-- Pflicht zur zweiten Stufe, sobald die zweite Migration eingespielt ist.

create or replace function public.admin_sitzungen_beenden(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_anzahl integer;
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'Nur Administratoren duerfen Sitzungen beenden';
  end if;

  -- Das eigene Konto ist ausgenommen: Wer sich selbst abmelden will, benutzt
  -- den Knopf im Profil. Hier waere es nur ein Weg, sich aus Versehen aus der
  -- laufenden Arbeit zu werfen.
  if p_user_id = auth.uid() then
    raise exception 'Das eigene Konto laesst sich hier nicht abmelden';
  end if;

  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_anzahl = row_count;
  return v_anzahl;
end;
$$;

revoke execute on function public.admin_sitzungen_beenden(uuid) from public, anon;
grant execute on function public.admin_sitzungen_beenden(uuid) to authenticated;

comment on function public.admin_sitzungen_beenden(uuid) is
  'PROJ-58: Beendet alle Anmeldungen eines fremden Kontos. Nur fuer Administratoren.';
