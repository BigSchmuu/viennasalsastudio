-- PROJ-39: internal alert to the admins when a booking needs a decision.
-- The event type is intentionally NOT part of notification_event_group
-- (the customer-facing preference list) — same treatment as
-- 'sepa_ankuendigung', which also bypasses customer preferences.
alter table public.notification_queue
  drop constraint notification_queue_event_type_check;

alter table public.notification_queue
  add constraint notification_queue_event_type_check
  check (event_type = any (array[
    'buchungsstatus',
    'warteliste',
    'abo_kuendigung',
    'kursstart_erinnerung',
    'sepa_ankuendigung',
    'event_tickets',
    'probestunde_nachfassung',
    'newsletter',
    'neue_buchung'
  ]));
