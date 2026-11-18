-- PROJ-107 Stufe 2, dritter Teil: Die Rechnung nennt den Leistungszeitraum.
--
-- Bis hierher stand in der Position nur der Name des Abos -- "Flatrate",
-- "Salsa Mittelstufe". Bei einem Mitgliedsbeitrag ist aber der **Zeitraum**
-- die Angabe, auf die es ankommt: Er beantwortet "wofuer war das?" und ist bei
-- einer Rueckfrage das Dokument, das man vorlegt.
--
-- Moeglich ist das erst, seit der Lauf auf einen eingetragenen Zyklus zeigt
-- (`sepa_collection_runs.cycle_id`, PROJ-107 Stufe 1). Vorher haette der
-- Zeitraum aus der alten Rechnung stammen muessen -- also aus einer Formel,
-- die je Abo ein anderes Ergebnis lieferte. Ein erfundener Zeitraum auf einer
-- Rechnung waere schlimmer als gar keiner.
--
-- Drei Grenzen, bewusst gezogen:
--
--   * **Nur Abo-Positionen.** Ein Ticket gilt fuer einen Abend, nicht fuer
--     einen Zeitraum; dort waere die Angabe falsch.
--   * **Nur mit Zyklus.** Haengt der Lauf an keinem (die Zeit vor dem
--     30.11.2026, oder eine Luecke), bleibt die Position wie bisher.
--   * **Vor den Zusaetzen.** Der Zeitraum gehoert zum Abo, der Aufschlag und
--     das verrechnete Guthaben gehoeren zur Abrechnung. Also:
--     "Flatrate (30.11.2026 - 10.01.2027) -- 15,00 EUR Guthaben verrechnet".
--
-- Bestehende Rechnungen bleiben unberuehrt: Die Funktion laeuft nur fuer
-- Positionen, zu denen es noch keine Rechnung gibt.

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
  v_zeitraum text;
begin
  if "current_role"() != 'admin' then
    raise exception 'not authorized';
  end if;

  select due_date into v_due_date from sepa_collection_runs where id = p_run_id;
  if v_due_date is null then
    raise exception 'collection run not found';
  end if;

  -- PROJ-107: Der Zeitraum, fuer den dieser Lauf einzieht. NULL, solange der
  -- Lauf an keinem eingetragenen Zyklus haengt.
  --
  -- `to_char` mit einem rein numerischen Muster haengt nicht an der
  -- Spracheinstellung -- anders als bei Betraegen, wo das Dezimaltrennzeichen
  -- daran haengt und weiter von Hand gesetzt wird (siehe unten).
  select to_char(c.starts_on, 'DD.MM.YYYY') || ' – ' || to_char(c.ends_on, 'DD.MM.YYYY')
    into v_zeitraum
  from sepa_collection_runs r
  join billing_cycles c on c.id = r.cycle_id
  where r.id = p_run_id;

  v_year := extract(year from v_due_date)::int;
  select * into v_settings from invoice_settings limit 1;

  for v_item in
    select
      sci.id, sci.amount, sci.customer_id, sci.subscription_id,
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

    -- PROJ-107: Der Zeitraum, und nur am Abo. Ein Ticket gilt fuer einen
    -- Abend; dort waere er eine falsche Angabe.
    if v_zeitraum is not null and v_item.subscription_id is not null then
      v_description := v_description || ' (' || v_zeitraum || ')';
    end if;

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

comment on function public.create_invoices_for_collection_run(uuid) is
  'PROJ-107: Erzeugt die Rechnungen eines Laufs. Abo-Positionen tragen den Leistungszeitraum aus billing_cycles, sofern der Lauf an einem Zyklus haengt.';

-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.create_invoices_for_collection_run(uuid) from public, anon;
