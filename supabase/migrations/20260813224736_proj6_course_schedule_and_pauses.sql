
create table course_schedule (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null unique references courses(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint course_schedule_end_after_start check (end_time > start_time)
);
create index idx_course_schedule_weekday on course_schedule(weekday);

create table course_schedule_pauses (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references course_schedule(id) on delete cascade,
  pause_date date not null,
  created_at timestamptz not null default now(),
  unique (schedule_id, pause_date)
);
create index idx_course_schedule_pauses_schedule_id on course_schedule_pauses(schedule_id);

alter table course_schedule enable row level security;
alter table course_schedule_pauses enable row level security;

create policy "CourseSchedule: public read" on course_schedule for select using (true);
create policy "CourseSchedule: admin insert" on course_schedule for insert with check ("current_role"() = 'admin');
create policy "CourseSchedule: admin update" on course_schedule for update using ("current_role"() = 'admin');
create policy "CourseSchedule: admin delete" on course_schedule for delete using ("current_role"() = 'admin');

create policy "CourseSchedulePauses: public read" on course_schedule_pauses for select using (true);
create policy "CourseSchedulePauses: admin insert" on course_schedule_pauses for insert with check ("current_role"() = 'admin');
create policy "CourseSchedulePauses: admin update" on course_schedule_pauses for update using ("current_role"() = 'admin');
create policy "CourseSchedulePauses: admin delete" on course_schedule_pauses for delete using ("current_role"() = 'admin');
