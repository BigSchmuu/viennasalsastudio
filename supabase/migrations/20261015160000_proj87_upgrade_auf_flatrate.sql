-- PROJ-87: Upgrade auf die Flatrate -- angefragt vom Kunden, bestaetigt vom
-- Betreiber.
--
-- Ein Upgrade aendert den Beitrag, und darueber entscheidet der Betreiber
-- selbst. Der Kunde stellt deshalb nur eine Anfrage; sein Abo bleibt bis zur
-- Bestaetigung unberuehrt.
--
-- Mit der Bestaetigung gilt die Flatrate **sofort**: Das Abo verliert seinen
-- Kurs, bekommt den Flatrate-Preis, und der bisherige Kurs steht ab heute als
-- Kursplatz daneben (PROJ-50). Die Differenz fuer den laufenden Zyklus wird als
-- einmaliger Aufschlag festgehalten und reist im naechsten Lastschriftlauf mit.
--
-- Umgekehrt gibt es keinen Weg: `self_switch_subscription_course` verlangt
-- `course_id is not null`, eine Flatrate laesst sich damit nicht in einen Kurs
-- zuruecktauschen. Das bleibt so.

-- 1. Die Anfrage ist eine Markierung am Abo.
--
-- Keine eigene Tabelle: Es gibt genau zwei Zustaende, und die Spur des
-- Vorgangs steckt danach im Aufschlag und am Abo selbst.
alter table public.subscriptions
  add column if not exists upgrade_requested_at timestamptz;

comment on column public.subscriptions.upgrade_requested_at is
  'PROJ-87: Gesetzt, solange der Kunde ein Upgrade auf die Flatrate angefragt hat. Die Bestaetigung loescht es.';

create index if not exists subscriptions_upgrade_offen
  on public.subscriptions (upgrade_requested_at)
  where upgrade_requested_at is not null;

-- 2. Der einmalige Aufschlag.
--
-- Geld braucht eine Zeile, die man lesen kann: wer, wie viel, warum, und in
-- welcher Laufposition er gelandet ist.
create table if not exists public.subscription_surcharges (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null check (amount > 0),
  reason text not null,
  -- `set null`, nicht `cascade`: Ein verworfener Entwurf loescht seine
  -- Positionen, und damit ist der Aufschlag von selbst wieder offen und kommt
  -- in den naechsten Lauf. Kein Rueckabwicklungspfad, der eigene Fehler
  -- mitbringt -- anders als bei der Guthabenverrechnung (PROJ-44), die genau
  -- dafuer eine zweite Funktion braucht.
  collection_item_id uuid references public.sepa_collection_items(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists subscription_surcharges_offen
  on public.subscription_surcharges (subscription_id)
  where collection_item_id is null;

alter table public.subscription_surcharges enable row level security;

-- Lesen: die eigenen Zeilen oder als Verwaltung. Geschrieben wird nur ueber die
-- Funktionen unten und vom Lauf mit dem Dienstschluessel.
create policy "Surcharges: eigene lesen oder Admin"
  on public.subscription_surcharges for select
  using ((select auth.uid()) = customer_id or public."current_role"() = 'admin');

comment on table public.subscription_surcharges is
  'PROJ-87: Einmaliger Aufschlag auf den naechsten Lastschriftlauf -- etwa die Differenz beim Upgrade auf die Flatrate. Offen, solange collection_item_id leer ist.';

-- 3. Ein neuer Benachrichtigungs-Anlass.
--
-- `event_type` hat eine CHECK-Liste; ohne diese Erweiterung scheitert das
-- Einreihen lautlos.
--
-- Die ganze Liste, nicht die aus PROJ-14: Ein erster Entwurf hier hat sie aus
-- einer alten Migration abgeschrieben und damit `kursumwandlung`, `guthaben`,
-- `zahlungserinnerung` und neun weitere Arten stillschweigend verboten -- jede
-- Benachrichtigung dieser Art waere danach beim Einreihen gescheitert.
-- Gefunden hat das `src/lib/constants/notifications.test.ts`, das die Liste
-- aus der jeweils letzten Migration liest.
alter table public.notification_queue drop constraint if exists notification_queue_event_type_check;
alter table public.notification_queue add constraint notification_queue_event_type_check
  check (event_type = any (array[
    'buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung',
    'sepa_ankuendigung', 'event_tickets', 'probestunde_nachfassung', 'newsletter',
    'neue_buchung', 'zahlungserinnerung', 'kursausfall', 'guthaben',
    'konto_existiert', 'kursumwandlung', 'zweite_stufe_zurueckgesetzt',
    'ticket_storniert', 'gasttaenzer_einladung', 'abo_upgrade'
  ]));

-- 4. Darf dieses Abo ueberhaupt upgraden?
--
-- An einer Stelle, weil die Antwort dreimal gebraucht wird: fuer den Knopf im
-- Kundenbereich, fuer die Anfrage und fuer die Bestaetigung. Drei Rechnungen
-- wuerden driften.
create or replace function public.flatrate_upgrade_moeglich(p_subscription_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from subscriptions s
    where s.id = p_subscription_id
      and s.status = 'active'
      -- Ein kursgebundenes Abo, keine Flatrate.
      and s.course_id is not null
      -- Keine ausstehende Pause oder Kuendigung: Das waere zweierlei zugleich.
      and s.pending_status is null
      -- Genau eines. Zwei Kursabos zu einer Flatrate zu verschmelzen ist eine
      -- Geldentscheidung, die niemand nebenbei treffen soll.
      and (
        select count(*) from subscriptions a
        where a.customer_id = s.customer_id and a.status = 'active' and a.course_id is not null
      ) = 1
      -- Und noch keine laufende Flatrate.
      and not exists (
        select 1 from subscriptions f
        where f.customer_id = s.customer_id and f.status = 'active' and f.course_id is null
      )
      -- Ohne gepflegten Preis gibt es nichts anzubieten.
      and (select flatrate_price from dropin_pricing limit 1) is not null
  );
$$;

comment on function public.flatrate_upgrade_moeglich(uuid) is
  'PROJ-87: Aktives Kursabo, keine ausstehende Aenderung, genau ein Kursabo, keine Flatrate, Flatrate-Preis gepflegt.';

-- 5. Anfragen -- der Kunde selbst.
create or replace function public.request_flatrate_upgrade(p_subscription_id uuid)
returns subscriptions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row subscriptions;
begin
  if not flatrate_upgrade_moeglich(p_subscription_id) then
    raise exception 'upgrade not possible';
  end if;

  update subscriptions
  set upgrade_requested_at = now()
  where id = p_subscription_id
    and customer_id = auth.uid()
  returning * into v_row;

  if not found then
    raise exception 'subscription not found';
  end if;

  return v_row;
end;
$$;

-- 6. Die Anfrage zurueckziehen.
create or replace function public.withdraw_flatrate_upgrade(p_subscription_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update subscriptions
  set upgrade_requested_at = null
  where id = p_subscription_id
    and customer_id = auth.uid()
    and upgrade_requested_at is not null;

  if not found then
    raise exception 'no open request';
  end if;

  return true;
end;
$$;

-- 7. Bestaetigen -- die Verwaltung.
--
-- Hier passiert alles zusammen oder nichts: Kurs weg, Preis neu, Kursplatz
-- daneben, Aufschlag festgehalten, Markierung geloescht, Kunde benachrichtigt.
-- Ein halb vollzogenes Upgrade waere ein Abo ohne Kurs und ohne Kursplatz --
-- der Kunde stuende in keinem Kurs mehr.
create or replace function public.confirm_flatrate_upgrade(
  p_subscription_id uuid,
  p_student boolean default false
)
returns subscriptions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_alt subscriptions;
  v_neu subscriptions;
  v_preis numeric;
  v_differenz numeric;
  v_kurs uuid;
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

  select case when p_student then flatrate_student_price else flatrate_price end
    into v_preis
    from dropin_pricing limit 1;

  if v_preis is null or v_preis <= 0 then
    raise exception 'flatrate price missing';
  end if;

  v_kurs := v_alt.course_id;
  -- Die ganze Differenz des laufenden Zyklus: ein Zyklus, ein Preis. Ist die
  -- Flatrate nicht teurer, entsteht kein Aufschlag.
  v_differenz := round(v_preis - coalesce(v_alt.price, 0), 2);

  -- `cycle_anchor_date` bleibt unberuehrt. Ein neues Abo haette keinen Einzug
  -- in der Vergangenheit und waere nach PROJ-70 sofort faellig -- der Kunde
  -- bekaeme unerwartet eine Abbuchung.
  update subscriptions
  set course_id = null,
      name = 'Flatrate',
      price = v_preis,
      upgrade_requested_at = null
  where id = p_subscription_id
  returning * into v_neu;

  -- Der bisherige Kurs steht ab heute als Kursplatz daneben (PROJ-69: ein
  -- Platz gilt ab seinem Starttermin). Die Belegung bleibt dadurch gleich --
  -- der Platz ersetzt den, den das Kursabo belegt hat.
  insert into course_memberships (customer_id, course_id, subscription_id, dance_role, started_on)
  values (v_alt.customer_id, v_kurs, p_subscription_id, null, public.heute_wien())
  on conflict do nothing;

  if v_differenz > 0 then
    insert into subscription_surcharges (subscription_id, customer_id, amount, reason)
    values (p_subscription_id, v_alt.customer_id, v_differenz, 'Upgrade auf Flatrate');
  end if;

  -- Der Kunde erfaehrt davon. Ohne diese Zeile waere das Upgrade bestaetigt,
  -- und er wuesste nichts davon -- und damit nicht, dass alle Kurse offen sind.
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

-- 8. Ablehnen.
create or replace function public.decline_flatrate_upgrade(p_subscription_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_kunde uuid;
  v_abo text;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  -- Der Name wird vorher gelesen: Die Nachricht sagt, was unveraendert
  -- weiterlaeuft, und bei einem Kursabo ist das der Kursname.
  select coalesce(c.name, s.name, 'Dein Abo')
    into v_abo
    from subscriptions s
    left join courses c on c.id = s.course_id
   where s.id = p_subscription_id;

  update subscriptions
  set upgrade_requested_at = null
  where id = p_subscription_id
    and upgrade_requested_at is not null
  returning customer_id into v_kunde;

  if not found then
    raise exception 'no open request';
  end if;

  insert into notification_queue (customer_id, event_type, payload, dedupe_key)
  values (
    v_kunde,
    'abo_upgrade',
    jsonb_build_object('entscheidung', 'abgelehnt', 'abo', coalesce(v_abo, 'Dein Abo')),
    'abo_upgrade_ab:' || p_subscription_id::text || ':' || public.heute_wien()::text
  );

  return true;
end;
$$;

-- 9. Die Rechnung nennt den Aufschlag.
--
-- Dieselbe Stelle und derselbe Satzbau wie das verrechnete Guthaben (PROJ-44):
-- Rechnungen haben hier eine Beschreibung und einen Betrag, keine Positionen.
-- Ohne diesen Zusatz stuende dort ein Betrag, der weder dem Abo-Preis noch
-- irgendetwas Erklaerbarem entspricht.
create or replace function public.create_invoices_for_collection_run(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_due_date date;
  v_year int;
  v_settings invoice_settings;
  v_item record;
  v_next_number int;
  v_credit numeric;
  v_aufschlag numeric;
  v_description text;
begin
  if "current_role"() != 'admin' then
    raise exception 'not authorized';
  end if;

  select due_date into v_due_date from sepa_collection_runs where id = p_run_id;
  if v_due_date is null then
    raise exception 'collection run not found';
  end if;

  v_year := extract(year from v_due_date)::int;
  select * into v_settings from invoice_settings limit 1;

  for v_item in
    select
      sci.id, sci.amount, sci.customer_id,
      coalesce(s.name, e.name, 'Abo') as description
    from sepa_collection_items sci
    left join subscriptions s on s.id = sci.subscription_id
    left join tickets t on t.id = sci.event_ticket_id
    left join events e on e.id = t.event_id
    where sci.run_id = p_run_id
      and not exists (select 1 from invoices i where i.collection_item_id = sci.id)
  loop
    insert into invoice_number_counters (year, last_number)
    values (v_year, 1)
    on conflict (year) do update set last_number = invoice_number_counters.last_number + 1
    returning last_number into v_next_number;

    v_description := v_item.description;

    -- PROJ-87: Steckt ein einmaliger Aufschlag in dieser Position?
    select sum(amount) into v_aufschlag
      from subscription_surcharges
      where collection_item_id = v_item.id;

    if v_aufschlag is not null and v_aufschlag > 0 then
      -- Betrag von Hand in oesterreichischer Schreibweise: to_char haengt an
      -- der Spracheinstellung der Datenbank, und die soll hier nichts
      -- entscheiden.
      v_description := v_description || ' — zzgl. ' ||
        replace(to_char(v_aufschlag, 'FM999990.00'), '.', ',') || ' € Upgrade-Differenz';
    end if;

    -- PROJ-44: Wurde fuer diese Position Guthaben verrechnet?
    select -amount into v_credit
      from customer_credits
      where collection_item_id = v_item.id and origin = 'redeemed';

    if v_credit is not null and v_credit > 0 then
      v_description := v_description || ' — ' ||
        replace(to_char(v_credit, 'FM999990.00'), '.', ',') || ' € Guthaben verrechnet';
    end if;

    insert into invoices (
      invoice_number, invoice_date, customer_id, collection_item_id,
      description, gross_amount, vat_rate
    ) values (
      v_year::text || '-' || lpad(v_next_number::text, 4, '0'),
      v_due_date,
      v_item.customer_id,
      v_item.id,
      v_description,
      v_item.amount,
      coalesce(v_settings.vat_rate, 20.00)
    );
  end loop;
end;
$function$;

-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.flatrate_upgrade_moeglich(uuid) from public, anon;
revoke all on function public.request_flatrate_upgrade(uuid) from public, anon;
revoke all on function public.withdraw_flatrate_upgrade(uuid) from public, anon;
revoke all on function public.confirm_flatrate_upgrade(uuid, boolean) from public, anon;
revoke all on function public.decline_flatrate_upgrade(uuid) from public, anon;
revoke all on function public.create_invoices_for_collection_run(uuid) from public, anon;

grant execute on function public.flatrate_upgrade_moeglich(uuid) to authenticated;
grant execute on function public.request_flatrate_upgrade(uuid) to authenticated;
grant execute on function public.withdraw_flatrate_upgrade(uuid) to authenticated;
grant execute on function public.confirm_flatrate_upgrade(uuid, boolean) to authenticated;
grant execute on function public.decline_flatrate_upgrade(uuid) to authenticated;
grant execute on function public.create_invoices_for_collection_run(uuid) to authenticated;
