-- SEPA mandate per customer (at most one active/non-revoked at a time)
create table sepa_mandates (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  iban text not null,
  account_holder_name text not null,
  mandate_reference text not null unique,
  consented_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index sepa_mandates_one_active_per_customer
  on sepa_mandates (customer_id)
  where revoked_at is null;

alter table sepa_mandates enable row level security;

create policy "Sepa mandates: own or admin read"
  on sepa_mandates for select
  using ((select auth.uid()) = customer_id or "current_role"() = 'admin');

create policy "Sepa mandates: own insert"
  on sepa_mandates for insert
  with check ((select auth.uid()) = customer_id);

create policy "Sepa mandates: own update"
  on sepa_mandates for update
  using ((select auth.uid()) = customer_id);

-- SEPA collection run: one batch export for a given due date
create table sepa_collection_runs (
  id uuid primary key default gen_random_uuid(),
  due_date date not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table sepa_collection_runs enable row level security;

create policy "Sepa collection runs: admin read"
  on sepa_collection_runs for select
  using ("current_role"() = 'admin');

create policy "Sepa collection runs: admin insert"
  on sepa_collection_runs for insert
  with check ("current_role"() = 'admin');

-- SEPA collection item: one line item (one subscription) within a run, snapshotting
-- amount/IBAN/mandate reference as they were at export time
create table sepa_collection_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references sepa_collection_runs(id) on delete cascade,
  customer_id uuid not null references profiles(id),
  subscription_id uuid not null references subscriptions(id),
  amount numeric not null check (amount > 0),
  iban text not null,
  account_holder_name text not null,
  mandate_reference text not null,
  bounced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table sepa_collection_items enable row level security;

create policy "Sepa collection items: admin read"
  on sepa_collection_items for select
  using ("current_role"() = 'admin');

create policy "Sepa collection items: admin insert"
  on sepa_collection_items for insert
  with check ("current_role"() = 'admin');

create policy "Sepa collection items: admin update"
  on sepa_collection_items for update
  using ("current_role"() = 'admin');
