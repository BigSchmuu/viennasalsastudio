create table public.notification_template_overrides (
  template_key text primary key,
  email_subject text not null,
  email_body text not null,
  push_title text not null,
  push_body text not null,
  updated_at timestamptz not null default now()
);

alter table public.notification_template_overrides enable row level security;

create policy "Notification template overrides: admin read"
  on public.notification_template_overrides
  for select
  using ("current_role"() = 'admin');

create policy "Notification template overrides: admin insert"
  on public.notification_template_overrides
  for insert
  with check ("current_role"() = 'admin');

create policy "Notification template overrides: admin update"
  on public.notification_template_overrides
  for update
  using ("current_role"() = 'admin')
  with check ("current_role"() = 'admin');

create policy "Notification template overrides: admin delete"
  on public.notification_template_overrides
  for delete
  using ("current_role"() = 'admin');
