-- PROJ-16: Notification preferences (per customer, per event group, per channel) and push subscriptions
create table public.notification_preferences (
  customer_id uuid not null references auth.users(id) on delete cascade,
  event_group text not null check (event_group in ('buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung')),
  channel text not null check (channel in ('email', 'push')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (customer_id, event_group, channel)
);

alter table public.notification_preferences enable row level security;

create policy "Kunden verwalten eigene Benachrichtigungs-Einstellungen"
  on public.notification_preferences
  for all
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Kunden verwalten eigene Push-Registrierungen"
  on public.push_subscriptions
  for all
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

create index idx_push_subscriptions_customer_id on public.push_subscriptions(customer_id);
