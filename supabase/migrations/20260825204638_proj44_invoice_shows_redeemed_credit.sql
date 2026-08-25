-- PROJ-44: Wurde Guthaben verrechnet, sagt die Rechnung das auch.
--
-- Ohne diesen Zusatz stuende dort ein Betrag, der weder dem Abo-Preis noch
-- irgendetwas Erklaerbarem entspricht -- und der Kunde haette keine Moeglichkeit
-- herauszufinden, warum.
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

    -- PROJ-44: Wurde fuer diese Position Guthaben verrechnet?
    select -amount into v_credit
      from customer_credits
      where collection_item_id = v_item.id and origin = 'redeemed';

    v_description := v_item.description;
    if v_credit is not null and v_credit > 0 then
      -- Betrag von Hand in oesterreichischer Schreibweise: to_char haengt an
      -- der Spracheinstellung der Datenbank, und die soll hier nichts
      -- entscheiden.
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
