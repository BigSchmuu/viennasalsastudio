-- PROJ-1: Core schema foundation (profiles, locations, rooms, courses skeleton,
-- class_sessions, bookings, subscriptions) + roles + RLS

-- ============================================================
-- profiles
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'teacher', 'admin')),
  phone text,
  birthdate date,
  gender text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper: fetch a user's role bypassing RLS (avoids recursive policy checks)
create or replace function public.current_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Prevent non-admins from changing their own (or anyone's) role via direct UPDATE
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and public.current_role() is distinct from 'admin' then
    raise exception 'Only admins can change a user role';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_role_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();

create policy "Profiles: select own or admin" on public.profiles
  for select using (auth.uid() = id or public.current_role() = 'admin');

create policy "Profiles: admin insert" on public.profiles
  for insert with check (public.current_role() = 'admin');

create policy "Profiles: update own or admin" on public.profiles
  for update using (auth.uid() = id or public.current_role() = 'admin');

create policy "Profiles: admin delete" on public.profiles
  for delete using (public.current_role() = 'admin');

-- Auto-create a customer profile whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'customer');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- locations
-- ============================================================
create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  description text,
  created_at timestamptz not null default now()
);

alter table public.locations enable row level security;

create policy "Locations: public read" on public.locations
  for select using (true);

create policy "Locations: admin write" on public.locations
  for insert with check (public.current_role() = 'admin');

create policy "Locations: admin update" on public.locations
  for update using (public.current_role() = 'admin');

create policy "Locations: admin delete" on public.locations
  for delete using (public.current_role() = 'admin');

-- ============================================================
-- rooms
-- ============================================================
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now()
);

create index idx_rooms_location_id on public.rooms(location_id);

alter table public.rooms enable row level security;

create policy "Rooms: public read" on public.rooms
  for select using (true);

create policy "Rooms: admin write" on public.rooms
  for insert with check (public.current_role() = 'admin');

create policy "Rooms: admin update" on public.rooms
  for update using (public.current_role() = 'admin');

create policy "Rooms: admin delete" on public.rooms
  for delete using (public.current_role() = 'admin');

-- ============================================================
-- courses (skeleton — full fields added by PROJ-3/PROJ-5)
-- ============================================================
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dance_style text,
  level text,
  room_id uuid not null references public.rooms(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index idx_courses_room_id on public.courses(room_id);

alter table public.courses enable row level security;

create policy "Courses: public read" on public.courses
  for select using (true);

create policy "Courses: admin write" on public.courses
  for insert with check (public.current_role() = 'admin');

create policy "Courses: admin update" on public.courses
  for update using (public.current_role() = 'admin');

create policy "Courses: admin delete" on public.courses
  for delete using (public.current_role() = 'admin');

-- ============================================================
-- course_teachers (n:m join — a course can have multiple teachers)
-- ============================================================
create table public.course_teachers (
  course_id uuid not null references public.courses(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, teacher_id)
);

create index idx_course_teachers_teacher_id on public.course_teachers(teacher_id);

alter table public.course_teachers enable row level security;

create policy "CourseTeachers: public read" on public.course_teachers
  for select using (true);

create policy "CourseTeachers: admin write" on public.course_teachers
  for insert with check (public.current_role() = 'admin');

create policy "CourseTeachers: admin update" on public.course_teachers
  for update using (public.current_role() = 'admin');

create policy "CourseTeachers: admin delete" on public.course_teachers
  for delete using (public.current_role() = 'admin');

-- ============================================================
-- course_materials (private teaching content — e.g. instructional video)
-- Separate table from `courses` so the video link is never exposed by the
-- public "courses" read policy.
-- ============================================================
create table public.course_materials (
  course_id uuid primary key references public.courses(id) on delete cascade,
  content_video_url text,
  updated_at timestamptz not null default now()
);

alter table public.course_materials enable row level security;

create policy "CourseMaterials: assigned teacher or admin read" on public.course_materials
  for select using (
    public.current_role() = 'admin'
    or exists (
      select 1 from public.course_teachers ct
      where ct.course_id = course_materials.course_id
        and ct.teacher_id = auth.uid()
    )
  );

create policy "CourseMaterials: admin write" on public.course_materials
  for insert with check (public.current_role() = 'admin');

create policy "CourseMaterials: admin update" on public.course_materials
  for update using (public.current_role() = 'admin');

create policy "CourseMaterials: admin delete" on public.course_materials
  for delete using (public.current_role() = 'admin');

-- ============================================================
-- class_sessions (skeleton — full scheduling logic added by PROJ-6)
-- ============================================================
create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_class_sessions_course_id on public.class_sessions(course_id);
create index idx_class_sessions_starts_at on public.class_sessions(starts_at);

alter table public.class_sessions enable row level security;

create policy "ClassSessions: public read" on public.class_sessions
  for select using (true);

create policy "ClassSessions: admin write" on public.class_sessions
  for insert with check (public.current_role() = 'admin');

create policy "ClassSessions: admin update" on public.class_sessions
  for update using (public.current_role() = 'admin');

create policy "ClassSessions: admin delete" on public.class_sessions
  for delete using (public.current_role() = 'admin');

-- ============================================================
-- bookings (skeleton — full booking logic added by PROJ-8)
-- ============================================================
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_bookings_customer_id on public.bookings(customer_id);
create index idx_bookings_session_id on public.bookings(session_id);

alter table public.bookings enable row level security;

create policy "Bookings: own or admin read" on public.bookings
  for select using (auth.uid() = customer_id or public.current_role() = 'admin');

create policy "Bookings: own insert" on public.bookings
  for insert with check (auth.uid() = customer_id or public.current_role() = 'admin');

create policy "Bookings: own or admin update" on public.bookings
  for update using (auth.uid() = customer_id or public.current_role() = 'admin');

create policy "Bookings: own or admin delete" on public.bookings
  for delete using (auth.uid() = customer_id or public.current_role() = 'admin');

-- ============================================================
-- subscriptions (skeleton — full billing logic added by PROJ-7/PROJ-9)
-- ============================================================
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  created_at timestamptz not null default now()
);

create index idx_subscriptions_customer_id on public.subscriptions(customer_id);

alter table public.subscriptions enable row level security;

create policy "Subscriptions: own or admin read" on public.subscriptions
  for select using (auth.uid() = customer_id or public.current_role() = 'admin');

create policy "Subscriptions: admin write" on public.subscriptions
  for insert with check (public.current_role() = 'admin');

create policy "Subscriptions: admin update" on public.subscriptions
  for update using (public.current_role() = 'admin');

create policy "Subscriptions: admin delete" on public.subscriptions
  for delete using (public.current_role() = 'admin');
