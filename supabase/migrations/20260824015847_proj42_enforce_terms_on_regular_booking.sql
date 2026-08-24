-- PROJ-42: Dieselbe Bedingung fuer die regulaere Anmeldung. Der Kunde klickt
-- hier "Rechtlich verbindlich buchen" — ohne festgehaltene Zustimmung waere im
-- Streitfall nichts nachweisbar.
drop function if exists public.create_regular_course_booking(uuid, text, date, text, boolean, text, text, boolean);

create or replace function public.create_regular_course_booking(
  p_course_id uuid,
  p_desired_plan text,
  p_chosen_date date,
  p_note text,
  p_prerequisite_confirmed boolean default false,
  p_dance_role text default null::text,
  p_coupon_code text default null::text,
  p_wants_student_price boolean default false,
  p_terms_accepted boolean default false,
  p_terms_version text default null
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
  v_role_enabled boolean;
  v_max_diff int;
  v_leader_count int;
  v_follower_count int;
  v_row course_bookings;
  v_coupon_id uuid;
  v_price numeric;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  -- PROJ-42: vor allen anderen Pruefungen. Ohne Zustimmung ist die Frage nach
  -- Kapazitaet oder Rollenverhaeltnis gegenstandslos.
  if not coalesce(p_terms_accepted, false) then
    raise exception 'terms not accepted';
  end if;
  if p_terms_version is null or trim(p_terms_version) = '' then
    raise exception 'terms version missing';
  end if;

  select prerequisite_note into v_prerequisite_note from courses where id = p_course_id;
  if v_prerequisite_note is not null and not p_prerequisite_confirmed then
    raise exception 'prerequisite not confirmed';
  end if;

  -- Already enrolled: nobody needs the same course twice, and a second
  -- subscription means a second monthly debit. Checked before capacity so the
  -- customer gets the accurate reason rather than "course is full".
  if exists (
    select 1 from subscriptions
    where customer_id = v_customer_id and course_id = p_course_id and status = 'active'
  ) then
    raise exception 'already enrolled';
  end if;

  -- Lock the course row so concurrent requests for the same course are
  -- serialized around the capacity check + role-balance check + insert
  -- below, preventing two simultaneous requests from both grabbing the
  -- last free spot or both pushing the role balance over the limit.
  select max_participants, role_query_enabled, max_role_difference
    into v_max, v_role_enabled, v_max_diff
    from courses where id = p_course_id for update;

  if v_max is not null then
    select
      (select count(*) from subscriptions where course_id = p_course_id and status = 'active')
      + (select count(*) from course_bookings where course_id = p_course_id and type = 'regular' and status = 'open')
    into v_used;

    if v_used >= v_max then
      raise exception 'course is full';
    end if;
  end if;

  if v_role_enabled and v_max_diff is not null and p_dance_role in ('leader', 'follower') then
    select
      (select count(*) from subscriptions s join course_bookings cb on cb.subscription_id = s.id
        where s.course_id = p_course_id and s.status = 'active' and cb.dance_role = 'leader')
      + (select count(*) from course_bookings where course_id = p_course_id and type = 'regular' and status = 'open' and dance_role = 'leader'),
      (select count(*) from subscriptions s join course_bookings cb on cb.subscription_id = s.id
        where s.course_id = p_course_id and s.status = 'active' and cb.dance_role = 'follower')
      + (select count(*) from course_bookings where course_id = p_course_id and type = 'regular' and status = 'open' and dance_role = 'follower')
    into v_leader_count, v_follower_count;

    if p_dance_role = 'leader' and (v_leader_count + 1) - v_follower_count > v_max_diff then
      raise exception 'role imbalance';
    elsif p_dance_role = 'follower' and (v_follower_count + 1) - v_leader_count > v_max_diff then
      raise exception 'role imbalance';
    end if;
  end if;

  if exists (
    select 1 from course_bookings
    where course_id = p_course_id and customer_id = v_customer_id and type = 'regular' and status = 'open'
  ) then
    raise exception 'already requested';
  end if;

  -- PROJ-15: attach a coupon only if it currently looks valid — an
  -- invalid/expired/exhausted code (or a customer who already had a
  -- subscription before) is silently dropped rather than blocking the
  -- booking itself. The real, atomic redemption still happens later at
  -- confirm time (redeem_coupon_for_booking), this is just what gets
  -- attached for the admin to see as a hint.
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select id into v_coupon_id
    from coupons
    where upper(code) = upper(trim(p_coupon_code))
      and active
      and (expires_at is null or expires_at >= current_date)
      and redemption_count < max_redemptions
    limit 1;

    if v_coupon_id is not null and exists (select 1 from subscriptions where customer_id = v_customer_id) then
      v_coupon_id := null;
    end if;
  end if;

  -- PROJ-41: nicht der vom Client geschickte Betrag, sondern der selbst
  -- ermittelte. Bleibt null, wenn kein Preis gepflegt ist — dann traegt ihn
  -- der Betreiber beim Bestaetigen ein.
  v_price := resolve_plan_price(p_course_id, p_desired_plan, coalesce(p_wants_student_price, false));

  insert into course_bookings (
    customer_id, course_id, type, status, desired_plan, chosen_date, note, dance_role, coupon_id,
    price, wants_student_price, terms_accepted_at, terms_version
  )
  values (
    v_customer_id, p_course_id, 'regular', 'open', p_desired_plan, p_chosen_date,
    nullif(p_note, ''), nullif(p_dance_role, ''), v_coupon_id,
    v_price, coalesce(p_wants_student_price, false), now(), p_terms_version
  )
  returning * into v_row;

  return v_row;
end;
$function$;
