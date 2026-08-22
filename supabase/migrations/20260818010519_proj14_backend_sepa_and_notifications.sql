-- PROJ-14 backend: (1) let SEPA-confirmed tickets ride the existing
-- collection-run mechanism, (2) add the "event_tickets" notification type.

-- 1) sepa_collection_items: subscription_id becomes optional, add an
-- optional ticket link — exactly one of the two must be set.
alter table public.sepa_collection_items alter column subscription_id drop not null;
alter table public.sepa_collection_items add column event_ticket_id uuid references public.tickets(id);
alter table public.sepa_collection_items add constraint sepa_collection_items_source_check
  check (
    (subscription_id is not null and event_ticket_id is null)
    or (subscription_id is null and event_ticket_id is not null)
  );

-- Extend invoice generation to describe ticket-based items too.
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

    insert into invoices (
      invoice_number, invoice_date, customer_id, collection_item_id,
      description, gross_amount, vat_rate
    ) values (
      v_year::text || '-' || lpad(v_next_number::text, 4, '0'),
      v_due_date,
      v_item.customer_id,
      v_item.id,
      v_item.description,
      v_item.amount,
      coalesce(v_settings.vat_rate, 20.00)
    );
  end loop;
end;
$function$;

-- 2) Notification type + settings group for event tickets.
alter table public.notification_queue drop constraint notification_queue_event_type_check;
alter table public.notification_queue add constraint notification_queue_event_type_check
  check (event_type in ('buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung', 'sepa_ankuendigung', 'event_ticket'));

alter table public.notification_preferences drop constraint notification_preferences_event_group_check;
alter table public.notification_preferences add constraint notification_preferences_event_group_check
  check (event_group in ('buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung', 'event_tickets'));
