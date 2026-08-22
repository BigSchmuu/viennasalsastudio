-- PROJ-13: Lehrer-Ansicht (Stundenplan, Anwesenheit, Notizen)

create table course_attendance (
  course_id uuid not null references courses(id) on delete cascade,
  customer_id uuid not null references profiles(id) on delete cascade,
  occurrence_date date not null,
  status text not null check (status in ('present', 'absent')),
  marked_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (course_id, customer_id, occurrence_date)
);

create table course_session_notes (
  course_id uuid not null references courses(id) on delete cascade,
  occurrence_date date not null,
  note text not null,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (course_id, occurrence_date)
);

-- Both tables carry attendance/notes tied to real customers — RLS is enabled
-- with NO policies at all, so every read and write is forced through the
-- SECURITY DEFINER functions below (each does its own authorization check).
-- This is stricter than the "own or admin" RLS pattern used elsewhere,
-- because unlike previous features, a teacher is a non-admin role that still
-- needs to see OTHER customers' data (who's on their roster) — something no
-- existing RLS policy in this app permits, so the authorization has to live
-- in the function, not in a table policy.
alter table course_attendance enable row level security;
alter table course_session_notes enable row level security;

create index idx_course_attendance_course_date on course_attendance(course_id, occurrence_date);
create index idx_course_session_notes_course_date on course_session_notes(course_id, occurrence_date);

-- Reusable authorization check: is the caller a teacher assigned to this course?
create or replace function is_course_teacher(p_course_id uuid)
returns boolean
language sql
stable security definer
set search_path = public
as $$
  select exists (
    select 1 from course_teachers
    where course_id = p_course_id and teacher_id = auth.uid()
  );
$$;

revoke all on function is_course_teacher(uuid) from public;
revoke all on function is_course_teacher(uuid) from anon;
grant execute on function is_course_teacher(uuid) to authenticated;

-- Returns the merged, live-computed attendance roster for one course+date:
-- active course-bound subscribers + confirmed trial/dropin bookings for that
-- exact date, left-joined with any already-saved attendance status. Bypasses
-- RLS internally (that's the whole point — a teacher can't otherwise see
-- other customers' subscriptions/bookings/profiles) but only after verifying
-- the caller is actually allowed to see this specific course's roster.
create or replace function get_course_attendance_roster(p_course_id uuid, p_occurrence_date date)
returns table (
  customer_id uuid,
  full_name text,
  source text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_course_teacher(p_course_id) or "current_role"() = 'admin') then
    raise exception 'not authorized';
  end if;

  return query
  with expected as (
    select s.customer_id, 'abo' as source
    from subscriptions s
    where s.course_id = p_course_id and s.status = 'active'
    union
    select cb.customer_id, 'buchung' as source
    from course_bookings cb
    where cb.course_id = p_course_id
      and cb.type in ('trial', 'dropin')
      and cb.status = 'confirmed'
      and cb.chosen_date = p_occurrence_date
    union
    select ca.customer_id, 'manuell' as source
    from course_attendance ca
    where ca.course_id = p_course_id and ca.occurrence_date = p_occurrence_date
      and ca.customer_id not in (
        select s2.customer_id from subscriptions s2 where s2.course_id = p_course_id and s2.status = 'active'
        union
        select cb2.customer_id from course_bookings cb2
        where cb2.course_id = p_course_id and cb2.type in ('trial', 'dropin') and cb2.status = 'confirmed'
          and cb2.chosen_date = p_occurrence_date
      )
  )
  select e.customer_id, p.full_name, e.source, ca.status
  from expected e
  join profiles p on p.id = e.customer_id
  left join course_attendance ca
    on ca.course_id = p_course_id and ca.customer_id = e.customer_id and ca.occurrence_date = p_occurrence_date
  order by p.full_name;
end;
$$;

revoke all on function get_course_attendance_roster(uuid, date) from public;
revoke all on function get_course_attendance_roster(uuid, date) from anon;
grant execute on function get_course_attendance_roster(uuid, date) to authenticated;

-- Marks (or manually adds) one customer's attendance for one course+date.
-- Future dates are rejected server-side, mirroring the app-wide pattern of
-- not trusting client-side date gating alone.
create or replace function mark_attendance(p_course_id uuid, p_customer_id uuid, p_occurrence_date date, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_course_teacher(p_course_id) or "current_role"() = 'admin') then
    raise exception 'not authorized';
  end if;
  if p_occurrence_date > current_date then
    raise exception 'cannot mark attendance for a future date';
  end if;
  if p_status not in ('present', 'absent') then
    raise exception 'invalid status';
  end if;

  insert into course_attendance (course_id, customer_id, occurrence_date, status, marked_by)
  values (p_course_id, p_customer_id, p_occurrence_date, p_status, auth.uid())
  on conflict (course_id, customer_id, occurrence_date)
  do update set status = excluded.status, marked_by = excluded.marked_by, updated_at = now();
end;
$$;

revoke all on function mark_attendance(uuid, uuid, date, text) from public;
revoke all on function mark_attendance(uuid, uuid, date, text) from anon;
grant execute on function mark_attendance(uuid, uuid, date, text) to authenticated;

create or replace function get_course_session_note(p_course_id uuid, p_occurrence_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text;
begin
  if not (is_course_teacher(p_course_id) or "current_role"() = 'admin') then
    raise exception 'not authorized';
  end if;

  select note into v_note from course_session_notes
  where course_id = p_course_id and occurrence_date = p_occurrence_date;

  return v_note;
end;
$$;

revoke all on function get_course_session_note(uuid, date) from public;
revoke all on function get_course_session_note(uuid, date) from anon;
grant execute on function get_course_session_note(uuid, date) to authenticated;

create or replace function upsert_session_note(p_course_id uuid, p_occurrence_date date, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_course_teacher(p_course_id) or "current_role"() = 'admin') then
    raise exception 'not authorized';
  end if;

  insert into course_session_notes (course_id, occurrence_date, note, updated_by)
  values (p_course_id, p_occurrence_date, p_note, auth.uid())
  on conflict (course_id, occurrence_date)
  do update set note = excluded.note, updated_by = excluded.updated_by, updated_at = now();
end;
$$;

revoke all on function upsert_session_note(uuid, date, text) from public;
revoke all on function upsert_session_note(uuid, date, text) from anon;
grant execute on function upsert_session_note(uuid, date, text) to authenticated;

-- For "Kunde hinzufügen": a minimal (id + name only, no email/billing data)
-- list of customers with some active engagement, callable by teachers too —
-- so it needs its own role check rather than relying on a calling admin
-- action, unlike every previous function that exposed customer lists.
create or replace function list_attendance_eligible_customers()
returns table (customer_id uuid, full_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if "current_role"() not in ('teacher', 'admin') then
    raise exception 'not authorized';
  end if;

  return query
  select distinct p.id, p.full_name
  from profiles p
  where p.role = 'customer'
    and (
      exists (select 1 from subscriptions s where s.customer_id = p.id and s.status = 'active')
      or exists (
        select 1 from course_bookings cb
        where cb.customer_id = p.id and cb.status in ('open', 'confirmed')
      )
    )
  order by p.full_name;
end;
$$;

revoke all on function list_attendance_eligible_customers() from public;
revoke all on function list_attendance_eligible_customers() from anon;
grant execute on function list_attendance_eligible_customers() to authenticated;
