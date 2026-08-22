
-- Rechnungseinstellungen (singleton, analog dropin_pricing)
create table invoice_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null default '',
  address text not null default '',
  uid_number text not null default '',
  vat_rate numeric not null default 20.00,
  updated_at timestamptz not null default now()
);

insert into invoice_settings (company_name) values ('');

alter table invoice_settings enable row level security;

create policy "Invoice settings: public read"
on invoice_settings for select
to public
using (true);

create policy "Invoice settings: admin update"
on invoice_settings for update
to public
using ("current_role"() = 'admin');

-- Rechnungsnummern-Zähler (rein intern, pro Jahr, kein direkter Client-Zugriff)
create table invoice_number_counters (
  year int primary key,
  last_number int not null default 0
);

alter table invoice_number_counters enable row level security;
-- bewusst keine Policies: nur die SECURITY DEFINER Funktion darf hierauf zugreifen

-- Rechnungen
create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  invoice_date date not null,
  customer_id uuid not null references profiles(id),
  collection_item_id uuid references sepa_collection_items(id) on delete set null,
  description text not null,
  gross_amount numeric not null,
  vat_rate numeric not null,
  bounced_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_invoices_customer_id on invoices(customer_id);
create index idx_invoices_invoice_date on invoices(invoice_date);

alter table invoices enable row level security;

create policy "Invoices: customer read own"
on invoices for select
to public
using (customer_id = (select auth.uid()));

create policy "Invoices: admin read"
on invoices for select
to public
using ("current_role"() = 'admin');

create policy "Invoices: admin update"
on invoices for update
to public
using ("current_role"() = 'admin');

-- Atomare, race-condition-sichere Rechnungserstellung für einen Lastschriftlauf
create or replace function create_invoices_for_collection_run(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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
    select sci.id, sci.amount, sci.customer_id, s.name as subscription_name
    from sepa_collection_items sci
    left join subscriptions s on s.id = sci.subscription_id
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
      coalesce(v_item.subscription_name, 'Abo'),
      v_item.amount,
      coalesce(v_settings.vat_rate, 20.00)
    );
  end loop;
end;
$$;

revoke all on function create_invoices_for_collection_run(uuid) from public;
grant execute on function create_invoices_for_collection_run(uuid) to authenticated;
