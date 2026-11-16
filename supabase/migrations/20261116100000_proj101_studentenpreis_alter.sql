-- PROJ-101: Der Studierendenpreis gilt bis einschliesslich 27.
--
-- Bisher wurde der Studierendenpreis **behauptet**: Im Buchungsdialog steht ein
-- Kaestchen "Ich bin Student(in)", es setzt `wants_student_price`, und
-- `resolve_plan_price` macht daraus den guenstigeren Preis. Wer alt genug ist,
-- prueft niemand.
--
-- Warum Trigger und nicht vier umgeschriebene Funktionen:
-- Das Kennzeichen entsteht an vier Wegen (regulaere Buchung, Selbstbedienung
-- inkl. Drop-in, Umbuchung, Event-Ticket), und jeder davon ist eine lange
-- Funktion, die mit PROJ-27/39/41/42/44/52/56/93 schon mehrfach ersetzt wurde.
-- Vier Koerper abzuschreiben, um in jedem eine Zeile zu ergaenzen, waere vier
-- Gelegenheiten, etwas anderes zu verlieren -- und der naechste neue Weg waere
-- wieder ungeprueft. Geprueft wird deshalb dort, wo das Kennzeichen **landet**:
-- an `course_bookings` und `tickets`. Das deckt jeden heutigen und jeden
-- kuenftigen Weg.
--
-- Die Ausnahme ist das Flatrate-Upgrade: Dort schreibt
-- `confirm_flatrate_upgrade` den Preis direkt ans Abo, und der Betreiber
-- uebergibt das Kennzeichen von Hand. Diese Funktion wird ersetzt; ihr Koerper
-- ist der aus PROJ-91, ergaenzt um die Pruefung.

-- ---------------------------------------------------------------------------
-- 1. Die Regel, an einer Stelle
-- ---------------------------------------------------------------------------

create or replace function public.studentenpreis_erlaubt(
  p_customer_id uuid,
  p_stichtag date default null
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  -- `age()` rechnet kalendergenau: Der 28. Geburtstag beendet den Preis, auch
  -- wenn er auf einen 29. Februar faellt. Ohne hinterlegtes Geburtsdatum gibt
  -- es den Preis nicht -- sonst traefe die Regel genau die, die nichts
  -- angegeben haben.
  select coalesce(
    (
      select extract(year from age(
               coalesce(p_stichtag, public.heute_wien())::timestamp,
               p.birthdate::timestamp
             ))::int <= 27
      from profiles p
      where p.id = p_customer_id
        and p.birthdate is not null
    ),
    false
  );
$$;

comment on function public.studentenpreis_erlaubt(uuid, date) is
  'PROJ-101: Darf dieser Kunde am Stichtag den Studierendenpreis bekommen? '
  'Einzige Stelle fuer die Altersgrenze. Geprueft wird sie an den Triggern '
  'course_bookings_studentenpreis / tickets_studentenpreis und in '
  'confirm_flatrate_upgrade.';

-- Auskunft fuer die Oberflaeche: Warum nicht, nicht nur ob.
--
-- Der Dialog soll kein Geburtsdatum herumtragen muessen, um einen Satz
-- anzuzeigen. Er fragt nach seinem eigenen Fall; die Regel bleibt oben.
create or replace function public.studentenpreis_auskunft()
returns table (moeglich boolean, grund text)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_datum date;
begin
  if (select auth.uid()) is null then
    return query select
      false,                                                      -- moeglich
      'nicht_angemeldet'::text;                                   -- grund
    return;
  end if;

  select p.birthdate into v_datum from profiles p where p.id = (select auth.uid());

  if v_datum is null then
    return query select
      false,                                                      -- moeglich
      'kein_geburtsdatum'::text;                                  -- grund
    return;
  end if;

  if public.studentenpreis_erlaubt((select auth.uid())) then
    return query select
      true,                                                       -- moeglich
      'ok'::text;                                                 -- grund
  else
    return query select
      false,                                                      -- moeglich
      'zu_alt'::text;                                             -- grund
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Buchungsanfragen: Kennzeichen und Preis richtigstellen
-- ---------------------------------------------------------------------------

create or replace function public.course_bookings_studentenpreis()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_normal numeric;
begin
  -- Nur wenn der Rabatt verlangt wird. Ein Antrag ohne Kennzeichen wird nicht
  -- angefasst, und ein Preis, den die Verwaltung spaeter von Hand setzt, auch
  -- nicht: Der Trigger haengt am Einfuegen, nicht am Aendern.
  if not coalesce(new.wants_student_price, false) then
    return new;
  end if;

  -- Stichtag ist der Tag der Anfrage, nicht der gewaehlte Termin: Der Preis
  -- soll der sein, den der Kunde gesehen hat.
  if public.studentenpreis_erlaubt(new.customer_id, public.heute_wien()) then
    return new;
  end if;

  new.wants_student_price := false;

  if new.type = 'dropin' then
    select normal_price into v_normal from dropin_pricing limit 1;
  else
    select public.resolve_plan_price(new.course_id, new.desired_plan, false) into v_normal;
  end if;

  -- `coalesce`: Lieber den alten Betrag stehen lassen als den Preis zu loeschen.
  -- Ohne ermaessigten Satz faellt `resolve_plan_price` ohnehin auf den normalen
  -- zurueck, dieser Fall ist also theoretisch -- aber eine Buchung ohne Preis
  -- waere schlimmer als eine mit einem zu pruefenden.
  new.price := coalesce(v_normal, new.price);

  return new;
end;
$$;

drop trigger if exists course_bookings_studentenpreis on public.course_bookings;
create trigger course_bookings_studentenpreis
  before insert on public.course_bookings
  for each row
  execute function public.course_bookings_studentenpreis();

-- ---------------------------------------------------------------------------
-- 3. Event-Tickets: dasselbe
-- ---------------------------------------------------------------------------

create or replace function public.tickets_studentenpreis()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_normal numeric;
begin
  if not coalesce(new.wants_student_price, false) then
    return new;
  end if;

  if public.studentenpreis_erlaubt(new.customer_id, public.heute_wien()) then
    return new;
  end if;

  new.wants_student_price := false;

  -- Derselbe Weg wie in `purchase_event_ticket`: die Ticketart, wenn es eine
  -- gibt, sonst die Veranstaltung selbst (PROJ-56).
  if new.ticket_type_id is not null then
    select price_normal into v_normal from event_ticket_types where id = new.ticket_type_id;
  end if;
  if v_normal is null then
    select price_normal into v_normal from events where id = new.event_id;
  end if;

  new.price := coalesce(v_normal, new.price);

  return new;
end;
$$;

drop trigger if exists tickets_studentenpreis on public.tickets;
create trigger tickets_studentenpreis
  before insert on public.tickets
  for each row
  execute function public.tickets_studentenpreis();

-- ---------------------------------------------------------------------------
-- 4. Das Flatrate-Upgrade (Koerper aus PROJ-91, ergaenzt um die Pruefung)
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
  -- nicht, denn gewollt war es trotzdem. Das Alter steht in der
  -- Verwaltungsansicht neben dem Haken, damit der Fall vor dem Klick sichtbar
  -- ist.
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
      -- PROJ-91: Der naechste Lauf nimmt dieses Abo regulaer mit und bucht die
      -- Flatrate voll ab. Ein Aufschlag darauf waere derselbe Zyklus zum
      -- zweiten Mal.
      v_differenz := 0;
    else
      -- **Vor** dem Umstellen gerechnet: Die Anrechnung liest die aktiven
      -- Kursabos, und gleich gibt es keine mehr.
      v_angerechnet := flatrate_upgrade_angerechnet(v_alt.customer_id);
      v_differenz := round(v_preis - v_angerechnet, 2);
    end if;
  else
    -- Null ist eine Aussage und kein fehlender Wert: "nichts dazu".
    v_differenz := round(p_differenz, 2);
    if v_differenz < 0 then
      raise exception 'difference must not be negative';
    end if;
    -- Dieselbe Obergrenze wie bei jedem Betrag, den jemand von Hand eintippt.
    if v_differenz > 10000 then
      raise exception 'difference too high';
    end if;
  end if;

  -- Die Kursplätze zuerst, solange die anderen Abos noch stehen.
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
      upgrade_requested_at = null
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
-- 5. Das Geburtsdatum kommt schon bei der Registrierung mit
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_datum text;
begin
  -- PROJ-101: Das Geburtsdatum ist Pflicht bei der Registrierung und geht als
  -- Metadatum mit. Geprueft wird es vorher im Schema; hier wird nur ein
  -- gueltiges Muster uebernommen, damit eine krumme Angabe die Anmeldung nicht
  -- scheitern laesst -- ein Konto ohne Geburtsdatum ist reparabel, ein
  -- gescheiterter `signUp` nicht.
  v_datum := btrim(new.raw_user_meta_data->>'birthdate');

  insert into public.profiles (id, role, first_name, last_name, birthdate)
  values (
    new.id,
    'customer',
    nullif(left(btrim(new.raw_user_meta_data->>'first_name'), 100), ''),
    nullif(left(btrim(new.raw_user_meta_data->>'last_name'), 100), ''),
    case
      when v_datum ~ '^\d{4}-\d{2}-\d{2}$' then v_datum::date
      else null
    end
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Rechte
--
-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE an `anon` neu. Jede angefasste Funktion braucht die Zeilen deshalb
-- wieder.
-- ---------------------------------------------------------------------------

revoke all on function public.studentenpreis_erlaubt(uuid, date) from public, anon;
grant execute on function public.studentenpreis_erlaubt(uuid, date) to authenticated;

revoke all on function public.studentenpreis_auskunft() from public, anon;
grant execute on function public.studentenpreis_auskunft() to authenticated;

revoke all on function public.confirm_flatrate_upgrade(uuid, boolean, numeric) from public, anon;
grant execute on function public.confirm_flatrate_upgrade(uuid, boolean, numeric) to authenticated;

-- Triggerfunktionen ruft niemand selbst auf.
revoke all on function public.course_bookings_studentenpreis() from public, anon, authenticated;
revoke all on function public.tickets_studentenpreis() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
