-- Referral source, captured once per customer on their first booking
alter table profiles add column referral_source text
  check (referral_source is null or referral_source in ('google', 'social_media', 'empfehlung', 'website', 'werbung', 'sonstiges'));

-- Admin-defined enrollment start dates per course (regular bookings only)
create table course_entry_dates (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  entry_date date not null,
  created_at timestamptz not null default now(),
  unique (course_id, entry_date)
);

alter table course_entry_dates enable row level security;

create policy "Course entry dates: public read"
  on course_entry_dates for select
  using (true);

create policy "Course entry dates: admin write"
  on course_entry_dates for insert
  with check ("current_role"() = 'admin');

create policy "Course entry dates: admin delete"
  on course_entry_dates for delete
  using ("current_role"() = 'admin');

-- Single-row drop-in pricing, admin-editable
create table dropin_pricing (
  id uuid primary key default gen_random_uuid(),
  normal_price numeric not null check (normal_price > 0),
  student_price numeric not null check (student_price > 0),
  updated_at timestamptz not null default now()
);

insert into dropin_pricing (normal_price, student_price) values (20, 15);

alter table dropin_pricing enable row level security;

create policy "Dropin pricing: public read"
  on dropin_pricing for select
  using (true);

create policy "Dropin pricing: admin update"
  on dropin_pricing for update
  using ("current_role"() = 'admin');

-- Unified booking table: regular request, trial (Probestunde), or dropin
create table course_bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete restrict,
  type text not null check (type in ('regular', 'trial', 'dropin')),
  desired_plan text check (desired_plan is null or desired_plan in ('single_course', 'flatrate')),
  chosen_date date not null,
  status text not null default 'open' check (status in ('open', 'confirmed', 'rejected', 'cancelled')),
  note text,
  wants_student_price boolean,
  price numeric,
  subscription_id uuid references subscriptions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table course_bookings enable row level security;

create policy "Course bookings: own or admin read"
  on course_bookings for select
  using ((select auth.uid()) = customer_id or "current_role"() = 'admin');

create policy "Course bookings: own insert"
  on course_bookings for insert
  with check ((select auth.uid()) = customer_id);

create policy "Course bookings: own cancel"
  on course_bookings for update
  using ((select auth.uid()) = customer_id)
  with check ((select auth.uid()) = customer_id and status = 'cancelled');

create policy "Course bookings: admin update"
  on course_bookings for update
  using ("current_role"() = 'admin');
