create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_amount numeric not null check (discount_amount > 0),
  max_redemptions int not null check (max_redemptions > 0),
  redemption_count int not null default 0,
  expires_at date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint coupons_percent_max check (discount_type <> 'percent' or discount_amount <= 100)
);

create unique index coupons_code_upper_idx on public.coupons (upper(code));

alter table public.coupons enable row level security;

create policy "Coupons: admin read"
  on public.coupons
  for select
  using ("current_role"() = 'admin');

create policy "Coupons: admin insert"
  on public.coupons
  for insert
  with check ("current_role"() = 'admin');

create policy "Coupons: admin update"
  on public.coupons
  for update
  using ("current_role"() = 'admin')
  with check ("current_role"() = 'admin');

alter table public.course_bookings
  add column coupon_id uuid references public.coupons(id) on delete set null;
