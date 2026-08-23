-- PROJ-37: payment reminder for a bounced direct debit.
--
-- Like 'sepa_ankuendigung' this deliberately sits outside the customer
-- notification preferences: a demand for money the customer already owes must
-- not be switchable off by the customer.
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
    'zahlungserinnerung'
  ]));
