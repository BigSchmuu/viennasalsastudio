-- PROJ-44: Die Benachrichtigungsart heisst jetzt "guthaben" statt
-- "empfehlung".
--
-- Grund: Sie traegt ab jetzt zwei Faelle -- die gezaehlte Empfehlung und die
-- Gutschrift von Hand, etwa als Ausgleich fuer einen ausgefallenen Kurs. Beide
-- sagen dem Kunden dasselbe: "du hast Guthaben bekommen". Zwei getrennte
-- Schalter fuer eine Sache waeren eine Frage, die niemand stellen will.
--
-- Umbenennen statt danebenstellen ist hier gefahrlos: Die Art wurde am selben
-- Tag angelegt, es gibt zu ihr weder gespeicherte Einstellungen noch
-- Nachrichten noch angepasste Vorlagen (geprueft, alle drei Zaehler auf 0).
alter table public.notification_preferences drop constraint if exists notification_preferences_event_group_check;
alter table public.notification_preferences
  add constraint notification_preferences_event_group_check
  check (event_group = any (array[
    'buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung',
    'event_tickets', 'probestunde_nachfassung', 'newsletter', 'guthaben'
  ]));

alter table public.notification_queue drop constraint if exists notification_queue_event_type_check;
alter table public.notification_queue
  add constraint notification_queue_event_type_check
  check (event_type = any (array[
    'buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung',
    'sepa_ankuendigung', 'event_tickets', 'probestunde_nachfassung', 'newsletter',
    'neue_buchung', 'zahlungserinnerung', 'kursausfall', 'guthaben'
  ]));
