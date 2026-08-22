-- BUG-1 fix: public/customer-facing pages need accurate per-course occupancy
-- counts to show "Ausgebucht"/waitlist correctly, but subscriptions and
-- course_bookings are RLS-scoped to "own row or admin". This function
-- exposes ONLY aggregate counts (no customer PII), so it's safe to grant to
-- anon as well as authenticated — unlike every other SECURITY DEFINER
-- function in this project, which are deliberately authenticated-only.
create or replace function get_course_occupancy()
returns table (course_id uuid, occupied_count int)
language sql
security definer
set search_path = public
as $$
  select course_id, count(*)::int as occupied_count
  from (
    select course_id from subscriptions where status = 'active' and course_id is not null
    union all
    select course_id from course_bookings where type = 'regular' and status = 'open'
  ) occupants
  group by course_id;
$$;

revoke all on function get_course_occupancy() from public;
grant execute on function get_course_occupancy() to anon;
grant execute on function get_course_occupancy() to authenticated;

-- BUG-3 fix: join_waitlist must enforce the SEPA-mandate requirement itself,
-- not only in the calling Next.js action, so it can't be bypassed via a
-- direct RPC call. Mirrors how capacity/duplicate checks are already
-- enforced at the DB layer.
create or replace function join_waitlist(p_course_id uuid, p_desired_plan text, p_chosen_date date)
returns waitlist_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_max int;
  v_used int;
  v_row waitlist_entries;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from sepa_mandates where customer_id = v_customer_id and revoked_at is null
  ) then
    raise exception 'mandate required';
  end if;

  select max_participants into v_max from courses where id = p_course_id;
  if v_max is null then
    raise exception 'course has no capacity limit';
  end if;

  select
    (select count(*) from subscriptions where course_id = p_course_id and status = 'active')
    + (select count(*) from course_bookings where course_id = p_course_id and type = 'regular' and status = 'open')
  into v_used;

  if v_used < v_max then
    raise exception 'course is not full';
  end if;

  if exists (
    select 1 from subscriptions
    where course_id = p_course_id and customer_id = v_customer_id and status = 'active'
  ) then
    raise exception 'already enrolled';
  end if;

  if exists (
    select 1 from course_bookings
    where course_id = p_course_id and customer_id = v_customer_id and type = 'regular' and status = 'open'
  ) then
    raise exception 'already requested';
  end if;

  if exists (
    select 1 from waitlist_entries where course_id = p_course_id and customer_id = v_customer_id
  ) then
    raise exception 'already on waitlist';
  end if;

  insert into waitlist_entries (course_id, customer_id, desired_plan, chosen_date)
  values (p_course_id, v_customer_id, p_desired_plan, p_chosen_date)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function join_waitlist(uuid, text, date) from public;
revoke all on function join_waitlist(uuid, text, date) from anon;
grant execute on function join_waitlist(uuid, text, date) to authenticated;
