-- PROJ-102: Der Studierendenpreis endet mit 28 -- angekuendigt, nicht
-- ueberraschend.
--
-- PROJ-101 sperrt den Rabatt bei **neuen** Anfragen. Ein laufendes Abo merkte
-- davon nichts: Es wird weiter zum alten Preis eingezogen, auch wenn der Kunde
-- laengst 30 ist. Niemand sah das, weil ein Abo gar nicht wusste, dass es ein
-- Studierendenabo ist -- `subscriptions` kannte nur `price`.
--
-- Diese Migration gibt dem Abo dieses Wissen und den Platz fuer eine
-- angekuendigte Umstellung. Der Lauf selbst steht in TypeScript
-- (`src/lib/subscriptions/studentenpreis.ts`) und wird vom Tageslauf gerufen --
-- dort, wo `vollzieheFaelligeAenderungen` schon steht.

-- ---------------------------------------------------------------------------
-- 1. Was das Abo kuenftig weiss
-- ---------------------------------------------------------------------------

alter table public.subscriptions
  add column if not exists student_price boolean not null default false,
  -- Die angekuendigte Umstellung. Alle drei zusammen oder keines.
  add column if not exists pending_price numeric,
  add column if not exists pending_price_old numeric,
  add column if not exists pending_price_date date,
  -- Die Sperre gegen Doppelversand: Ein wiederholter Lauf darf keine zweite
  -- Mail erzeugen.
  add column if not exists price_notice_sent_at timestamptz;

comment on column public.subscriptions.student_price is
  'PROJ-102: Laeuft dieses Abo zum Studierendenpreis? Wird beim Bestaetigen der '
  'Buchung gesetzt. Fuer den Bestand einmalig aus course_bookings abgeleitet; '
  'was sich nicht zuordnen liess, bleibt false und steht in der Liste fuer den '
  'Betreiber.';
comment on column public.subscriptions.pending_price_old is
  'PROJ-102: Der Preis zum Zeitpunkt der Ankuendigung. Stimmt er am Stichtag '
  'nicht mehr, hat die Verwaltung von Hand eingegriffen -- dann bleibt ihre '
  'Zahl stehen.';

-- Fuer den Lauf: wenige Zeilen aus vielen.
create index if not exists subscriptions_student_price_idx
  on public.subscriptions (student_price)
  where student_price;

create index if not exists subscriptions_pending_price_date_idx
  on public.subscriptions (pending_price_date)
  where pending_price_date is not null;

-- ---------------------------------------------------------------------------
-- 2. Der Bestand: abgeleitet, nicht geraten
-- ---------------------------------------------------------------------------

-- Nur wo die urspruengliche Anfrage noch am Abo haengt und den Rabatt verlangt
-- hat. Alles andere bleibt `false`: Ein geratenes Kennzeichen wuerde spaeter
-- eine Preiserhoehung ankuendigen, fuer die es keinen Grund gibt.
update public.subscriptions s
set student_price = true
where s.student_price = false
  and exists (
    select 1
    from public.course_bookings b
    where b.subscription_id = s.id
      and coalesce(b.wants_student_price, false)
  );

-- ---------------------------------------------------------------------------
-- 3. Der Normalpreis dieses Abos -- an einer Stelle
-- ---------------------------------------------------------------------------

create or replace function public.abo_normalpreis(p_subscription_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_abo subscriptions;
  v_preis numeric;
begin
  select * into v_abo from subscriptions where id = p_subscription_id;
  if not found then
    return null;
  end if;

  -- Die drei Stufen unterscheiden sich an genau diesen zwei Feldern (PROJ-93):
  -- Pass hat eine Stilrichtung, Kursabo einen Kurs, die Flatrate keines von
  -- beiden.
  if v_abo.dance_style_id is not null then
    select pass_price into v_preis from dance_styles where id = v_abo.dance_style_id;
    return v_preis;
  end if;

  if v_abo.course_id is not null then
    -- Dieselbe Funktion, aus der die Buchung ihren Preis bekommt -- nur ohne
    -- Ermaessigung. Ein zweiter Rechenweg wuerde driften.
    return public.resolve_plan_price(v_abo.course_id, 'single_course', false);
  end if;

  select flatrate_price into v_preis from dropin_pricing limit 1;
  return v_preis;
end;
$$;

comment on function public.abo_normalpreis(uuid) is
  'PROJ-102: Der Normalpreis der Stufe, auf der dieses Abo laeuft -- Pass, '
  'Kursabo oder Flatrate. Quelle fuer die Umstellung zum 28. Geburtstag.';

-- ---------------------------------------------------------------------------
-- 4. Die neue Benachrichtigungsart
--
-- `notification_queue.event_type` hat eine CHECK-Liste. Ohne diese Zeilen
-- scheitert das Einreihen -- und zwar still, weil der Lauf den Fehler nur
-- protokolliert.
-- ---------------------------------------------------------------------------

alter table public.notification_queue drop constraint if exists notification_queue_event_type_check;
alter table public.notification_queue add constraint notification_queue_event_type_check
  check (event_type = any (array[
    'buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung',
    'sepa_ankuendigung', 'event_tickets', 'probestunde_nachfassung', 'newsletter',
    'neue_buchung', 'zahlungserinnerung', 'kursausfall', 'guthaben',
    'konto_existiert', 'kursumwandlung', 'zweite_stufe_zurueckgesetzt',
    'ticket_storniert', 'gasttaenzer_einladung', 'abo_upgrade',
    'studentenpreis_endet'
  ]));

-- ---------------------------------------------------------------------------
-- 5. Das Upgrade raeumt eine angekuendigte Umstellung ab
--
-- Koerper aus PROJ-91, Altersgrenze aus PROJ-101, dazu zwei Zeilen: Nach einem
-- Upgrade gilt der Preis des Upgrades, und das Kennzeichen richtet sich nach
-- dem Preis, den es gesetzt hat.
-- ---------------------------------------------------------------------------

create or replace function public.confirm_flatrate_upgrade(
  p_subscription_id uuid,
  p_student boolean default false,
  p_differenz numeric default null
)
returns subscriptions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_alt subscriptions;
  v_neu subscriptions;
  v_student boolean;
  v_preis numeric;
  v_angerechnet numeric;
  v_differenz numeric;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  select * into v_alt from subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'subscription not found';
  end if;
  if v_alt.upgrade_requested_at is null then
    raise exception 'no open request';
  end if;
  if not flatrate_upgrade_moeglich(p_subscription_id) then
    raise exception 'upgrade not possible';
  end if;

  -- PROJ-101: Auch die Hand des Betreibers kann sich irren. Ist der Kunde zu
  -- alt, entsteht die Flatrate zum Normalpreis -- abgewiesen wird das Upgrade
  -- nicht, denn gewollt war es trotzdem.
  v_student := coalesce(p_student, false)
               and public.studentenpreis_erlaubt(v_alt.customer_id, public.heute_wien());

  select case when v_student then flatrate_student_price else flatrate_price end
    into v_preis
    from dropin_pricing limit 1;

  if v_preis is null or v_preis <= 0 then
    raise exception 'flatrate price missing';
  end if;

  if p_differenz is null then
    if flatrate_upgrade_zyklus_wird_abgebucht(p_subscription_id) then
      v_differenz := 0;
    else
      v_angerechnet := flatrate_upgrade_angerechnet(v_alt.customer_id);
      v_differenz := round(v_preis - v_angerechnet, 2);
    end if;
  else
    v_differenz := round(p_differenz, 2);
    if v_differenz < 0 then
      raise exception 'difference must not be negative';
    end if;
    if v_differenz > 10000 then
      raise exception 'difference too high';
    end if;
  end if;

  insert into course_memberships (customer_id, course_id, subscription_id, dance_role, started_on)
  select v_alt.customer_id, s.course_id, p_subscription_id, null, public.heute_wien()
  from subscriptions s
  where s.customer_id = v_alt.customer_id
    and s.status = 'active'
    and s.course_id is not null
  on conflict do nothing;

  update subscriptions
  set status = 'cancelled',
      cancelled_at = public.heute_wien(),
      pending_status = null,
      pending_effective_date = null,
      upgrade_requested_at = null
  where customer_id = v_alt.customer_id
    and status = 'active'
    and course_id is not null
    and id <> p_subscription_id;

  update subscriptions
  set course_id = null,
      name = 'Flatrate',
      price = v_preis,
      upgrade_requested_at = null,
      -- PROJ-102: Der Preis des Upgrades gilt. Eine angekuendigte Umstellung
      -- waere danach eine zweite Preisaenderung fuer denselben Zyklus -- das
      -- liesse sich niemandem erklaeren.
      student_price = v_student,
      pending_price = null,
      pending_price_old = null,
      pending_price_date = null,
      price_notice_sent_at = null
  where id = p_subscription_id
  returning * into v_neu;

  if v_differenz > 0 then
    insert into subscription_surcharges (subscription_id, customer_id, amount, reason)
    values (p_subscription_id, v_alt.customer_id, v_differenz, 'Upgrade auf Flatrate');
  end if;

  insert into notification_queue (customer_id, event_type, payload, dedupe_key)
  values (
    v_alt.customer_id,
    'abo_upgrade',
    jsonb_build_object(
      'entscheidung', 'bestaetigt',
      'abo', 'Flatrate',
      'preis', v_preis,
      'differenz', greatest(v_differenz, 0)
    ),
    'abo_upgrade:' || p_subscription_id::text || ':' || public.heute_wien()::text
  );

  return v_neu;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Rechte
-- ---------------------------------------------------------------------------

revoke all on function public.abo_normalpreis(uuid) from public, anon;
grant execute on function public.abo_normalpreis(uuid) to authenticated;

revoke all on function public.confirm_flatrate_upgrade(uuid, boolean, numeric) from public, anon;
grant execute on function public.confirm_flatrate_upgrade(uuid, boolean, numeric) to authenticated;
