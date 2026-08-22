-- Align notification_queue.event_type with notification_preferences.event_group
-- ("event_tickets", plural) — every other pair in the system matches exactly
-- (buchungsstatus, warteliste, abo_kuendigung, kursstart_erinnerung all do),
-- only sepa_ankuendigung is the intentional fixed-with-no-group exception.
alter table public.notification_queue drop constraint notification_queue_event_type_check;
alter table public.notification_queue add constraint notification_queue_event_type_check
  check (event_type in ('buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung', 'sepa_ankuendigung', 'event_tickets'));
