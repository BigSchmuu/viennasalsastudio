-- Neue Benachrichtigung: Jemand hat versucht, sich mit einer bereits
-- vergebenen E-Mail-Adresse zu registrieren.
--
-- Supabase antwortet in diesem Fall absichtlich wie bei einer neuen Adresse und
-- verschickt nichts (Schutz vor Adress-Ausspähung). Der Kunde stand deshalb vor
-- einer Seite, die eine Mail versprach, die nie kam. Jetzt bekommt der Inhaber
-- des Postfachs eine Nachricht — und nur er, womit der Schutz erhalten bleibt.
--
-- Die Prüfbedingung listet die erlaubten Ereignistypen einzeln auf. Ohne diesen
-- Eintrag scheitert das Einreihen still: enqueueAndDispatch protokolliert den
-- Fehler nur, damit ein misslungener Versand nie die auslösende Handlung
-- mitreisst.
alter table notification_queue drop constraint notification_queue_event_type_check;

alter table notification_queue add constraint notification_queue_event_type_check
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
    'konto_existiert'
  ]));
