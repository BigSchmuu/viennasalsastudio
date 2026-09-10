-- PROJ-50 / BUG-1: Eine bestätigte Flatrate-Buchung erzeugt einen Kursplatz.
--
-- Beim QA-Durchgang aufgefallen: Drei Wege in einen Kurs waren versorgt — die
-- Bestandsdaten über die Migration, die Selbstbedienung über
-- `add_course_to_flatrate` und die Nachrückung. Der vierte nicht: die
-- Bestätigung durch den Betreiber. Dabei entstand ein Abo ohne Kursbezug und
-- kein Kursplatz — der Kunde zahlte und saß in keinem Kurs.
--
-- Ausgerechnet der Weg, den **jeder neue Flatrate-Kunde** nimmt.
--
-- Als Trigger und nicht an den Aufrufstellen: Bestätigt wird an zwei Stellen
-- (einzeln und im Stapel), und beide setzen dieselben zwei Felder. Eine Regel
-- an der Tabelle gilt für beide — und für die dritte, die es noch nicht gibt.
-- Dieselbe Überlegung wie bei `abo_ende_beendet_kursplaetze`.
create or replace function public.erzeuge_kursplatz_bei_bestaetigung()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_ist_flatrate boolean;
begin
  if new.status <> 'confirmed' or new.subscription_id is null or new.type <> 'regular' then
    return new;
  end if;

  -- Nur für Flatrates. Bei einem kursgebundenen Abo steht der Kurs am Abo
  -- selbst; ein zusätzlicher Kursplatz wäre dieselbe Aussage zweimal.
  select s.course_id is null and s.status = 'active'
    into v_ist_flatrate
  from subscriptions s
  where s.id = new.subscription_id;

  if not coalesce(v_ist_flatrate, false) then
    return new;
  end if;

  -- `on conflict do nothing` gegen den Teilindex „ein offener Platz je Kunde
  -- und Kurs": Wird dieselbe Buchung zweimal bestätigt, entsteht nichts Neues.
  insert into course_memberships (customer_id, course_id, subscription_id, dance_role, started_on)
  values (
    new.customer_id,
    new.course_id,
    new.subscription_id,
    new.dance_role,
    coalesce(new.chosen_date, public.heute_wien())
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists bestaetigung_erzeugt_kursplatz on public.course_bookings;
create trigger bestaetigung_erzeugt_kursplatz
  after insert or update of status, subscription_id on public.course_bookings
  for each row
  execute function public.erzeuge_kursplatz_bei_bestaetigung();
