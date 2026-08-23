-- PROJ-38: notification that a session has been cancelled.
--
-- Like 'sepa_ankuendigung' and 'zahlungserinnerung' this sits outside the
-- customer notification preferences on purpose: somebody who switched off
-- notifications would otherwise stand in front of a locked door.
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
    'neue_buchung',
    'zahlungserinnerung',
    'kursausfall'
  ]));
