
-- Extend the existing regular-booking RPC with a server-enforced prerequisite check.
-- Default false so any caller that omits the argument is treated as unconfirmed.
create or replace function public.create_regular_course_booking(
  p_course_id uuid,
  p_desired_plan text,
  p_chosen_date date,
  p_note text,
  p_prerequisite_confirmed boolean default false
)
returns course_bookings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := auth.uid();
  v_prerequisite_note text;
  v_max int;
  v_used int;
  v_row course_bookings;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  select prerequisite_note into v_prerequisite_note from courses where id = p_course_id;
  if v_prerequisite_note is not null and not p_prerequisite_confirmed then
    raise exception 'prerequisite not confirmed';
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
$function$;

-- New RPC for trial/dropin bookings (both fresh bookings and rebooks), replacing
-- the previous direct client-side .insert() into course_bookings. Enforces the
-- same prerequisite check server-side, and computes dropin price authoritatively
-- here instead of trusting a client-supplied value.
create or replace function public.create_self_service_booking(
  p_course_id uuid,
  p_type text,
  p_chosen_date date,
  p_wants_student_price boolean default false,
  p_prerequisite_confirmed boolean default false
)
returns course_bookings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := auth.uid();
  v_prerequisite_note text;
  v_status text;
  v_price numeric;
  v_row course_bookings;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  if p_type not in ('trial', 'dropin') then
    raise exception 'invalid type';
  end if;

  select prerequisite_note into v_prerequisite_note from courses where id = p_course_id;
  if v_prerequisite_note is not null and not p_prerequisite_confirmed then
    raise exception 'prerequisite not confirmed';
  end if;

  v_status := case when p_type = 'trial' then 'confirmed' else 'open' end;

  if p_type = 'dropin' then
    select case when p_wants_student_price then student_price else normal_price end
    into v_price
    from dropin_pricing
    limit 1;
  end if;

  insert into course_bookings (customer_id, course_id, type, status, chosen_date, wants_student_price, price)
  values (
    v_customer_id,
    p_course_id,
    p_type,
    v_status,
    p_chosen_date,
    case when p_type = 'dropin' then p_wants_student_price else null end,
    v_price
  )
  returning * into v_row;

  return v_row;
end;
$function$;

-- Both booking-creation paths now go exclusively through the SECURITY DEFINER
-- RPCs above, which enforce the prerequisite-confirmation check server-side
-- regardless of caller (UI or direct API call). Drop the permissive direct
-- INSERT policy so no client can route around either RPC anymore.
drop policy if exists "Course bookings: own insert" on course_bookings;
