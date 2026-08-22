create or replace function create_regular_course_booking(
  p_course_id uuid,
  p_desired_plan text,
  p_chosen_date date,
  p_note text
)
returns course_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_max int;
  v_used int;
  v_row course_bookings;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  -- Lock the course row so concurrent requests for the same course are
  -- serialized around the capacity check + insert below, preventing two
  -- simultaneous requests from both grabbing the last free spot.
  select max_participants into v_max from courses where id = p_course_id for update;

  if v_max is not null then
    select
      (select count(*) from subscriptions where course_id = p_course_id and status = 'active')
      + (select count(*) from course_bookings where course_id = p_course_id and type = 'regular' and status = 'open')
    into v_used;

    if v_used >= v_max then
      raise exception 'course is full';
    end if;
  end if;

  if exists (
    select 1 from course_bookings
    where course_id = p_course_id and customer_id = v_customer_id and type = 'regular' and status = 'open'
  ) then
    raise exception 'already requested';
  end if;

  insert into course_bookings (customer_id, course_id, type, status, desired_plan, chosen_date, note)
  values (v_customer_id, p_course_id, 'regular', 'open', p_desired_plan, p_chosen_date, nullif(p_note, ''))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function create_regular_course_booking(uuid, text, date, text) from public;
revoke all on function create_regular_course_booking(uuid, text, date, text) from anon;
grant execute on function create_regular_course_booking(uuid, text, date, text) to authenticated;
