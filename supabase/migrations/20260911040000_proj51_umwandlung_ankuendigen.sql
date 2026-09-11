-- PROJ-51: Die vorgemerkte Umwandlung wird angekündigt und vollzogen.
--
-- Die Vormerkung selbst steht seit 20260911030000 am Kurs. Was fehlte, war
-- beides Ausführende: die Nachricht an die Kunden und der Vollzug am Stichtag.

-- 1. Wann die Ankündigung hinausging.
--
-- Ohne diese Spur verschickt jeder nächtliche Lauf dieselbe Nachricht erneut:
-- Die Vormerkung steht ja bis zum Stichtag da. Der Zeitstempel ist zugleich
-- die Antwort auf „wurde schon informiert?" — eine Frage, die sich sonst nur
-- aus der Warteschlange rekonstruieren ließe, und die wird aufgeräumt.
alter table public.courses
  add column if not exists pending_announced_at timestamptz;

comment on column public.courses.pending_announced_at is
  'PROJ-51: Wann die Kunden über die vorgemerkte Umwandlung informiert wurden. Wird mit der Vormerkung zusammen geleert.';

-- 2. Die neue Benachrichtigungsart.
--
-- Die Prüfbedingung listet die erlaubten Ereignistypen einzeln auf. Ohne
-- diesen Eintrag scheitert das Einreihen still: enqueueAndDispatch
-- protokolliert den Fehler nur, damit ein misslungener Versand nie die
-- auslösende Handlung mitreißt.
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
    'kursumwandlung'
  ]));
