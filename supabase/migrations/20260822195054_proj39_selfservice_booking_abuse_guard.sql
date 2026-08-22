-- PROJ-39 BUG-1: self-service bookings had no duplicate check and no rate
-- limit, so one customer could create unlimited identical drop-in requests.
-- Each one counts towards the admin's open-bookings badge and fires a push
-- notification, turning a data-hygiene gap into a notification flood.
--
-- The guard lives in the database, not the server action: the abuse path
-- found during QA called this RPC directly with the anon key, bypassing
-- Next.js entirely. Same reasoning as the PROJ-15 coupon rate limit.
--
-- Signature is unchanged on purpose — altering it would create a second
-- overload rather than replacing this function (lesson from PROJ-15).
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
  v_recent int;
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

  -- Same customer, same course, same date, same type, still active: that is a
  -- duplicate, never a legitimate second booking. Cancelled and rejected ones
  -- are deliberately excluded so a customer can rebook after cancelling.
  if exists (
    select 1 from course_bookings
    where customer_id = v_customer_id
      and course_id = p_course_id
      and type = p_type
      and chosen_date = p_chosen_date
      and status in ('open', 'confirmed')
  ) then
    raise exception 'already booked';
  end if;

  -- Second layer: the duplicate check alone would not stop a flood, because an
  -- attacker can simply vary course and date. Cancelled bookings still count
  -- towards the budget — otherwise cancelling would reset it and the limit
  -- could be sidestepped entirely.
  select count(*) into v_recent
  from course_bookings
  where customer_id = v_customer_id
    and type in ('trial', 'dropin')
    and created_at > now() - interval '1 hour';

  if v_recent >= 10 then
    raise exception 'booking rate limit';
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

-- The two new checks and the badge query all filter course_bookings by
-- customer/status; the table has had no index beyond its primary key.
create index if not exists idx_course_bookings_customer_created
  on course_bookings (customer_id, created_at desc);
create index if not exists idx_course_bookings_open
  on course_bookings (status) where status = 'open';
