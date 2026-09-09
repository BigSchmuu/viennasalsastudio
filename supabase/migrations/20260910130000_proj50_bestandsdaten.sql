-- PROJ-50: Kursplätze für bestehende Flatrate-Kunden anlegen.
--
-- Jede bestätigte Flatrate-Buchung ist bereits mit ihrem Abo verknüpft
-- (`course_bookings.subscription_id`). Daraus entsteht je ein Kursplatz — samt
-- der damals gewählten Tanzrolle und dem damals gewählten Starttermin.
--
-- Wiederholbar: Ein zweiter Lauf richtet nichts an. Eine Migration wird öfter
-- angefasst, als man plant, und `on conflict do nothing` greift hier auf den
-- Teilindex „ein offener Platz je Kunde und Kurs".
--
-- Wo keine Verknüpfung existiert, bleibt die Liste leer und der Kunde trägt
-- sich selbst ein. Das ist kein Fehler, sondern der Preis dafür, dass die
-- Zuordnung bisher nirgends festgehalten wurde.
insert into public.course_memberships (
  customer_id, course_id, subscription_id, dance_role, started_on
)
select
  b.customer_id,
  b.course_id,
  s.id,
  b.dance_role,
  coalesce(b.chosen_date, s.cycle_anchor_date)
from public.course_bookings b
join public.subscriptions s on s.id = b.subscription_id
where b.type = 'regular'
  and b.status = 'confirmed'
  and s.course_id is null          -- nur Flatrates; kursgebundene Abos tragen ihren Kurs selbst
  and s.status = 'active'
on conflict do nothing;
