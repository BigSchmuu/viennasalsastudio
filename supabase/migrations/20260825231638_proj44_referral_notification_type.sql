-- PROJ-44: Die Nachricht "deine Empfehlung hat gezaehlt" ist eine eigene Art.
-- Wie alle anderen kann der Kunde sie abschalten -- das Guthaben entsteht
-- davon unabhaengig, denn es haengt an der Abbuchung, nicht am Versand.
alter table public.notification_preferences drop constraint if exists notification_preferences_event_group_check;
alter table public.notification_preferences
  add constraint notification_preferences_event_group_check
  check (event_group = any (array[
    'buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung',
    'event_tickets', 'probestunde_nachfassung', 'newsletter', 'empfehlung'
  ]));

alter table public.notification_queue drop constraint if exists notification_queue_event_type_check;
alter table public.notification_queue
  add constraint notification_queue_event_type_check
  check (event_type = any (array[
    'buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung',
    'sepa_ankuendigung', 'event_tickets', 'probestunde_nachfassung', 'newsletter',
    'neue_buchung', 'zahlungserinnerung', 'kursausfall', 'empfehlung'
  ]));
