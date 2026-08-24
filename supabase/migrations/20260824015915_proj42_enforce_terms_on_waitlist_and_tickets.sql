-- PROJ-42: Zustimmung auch bei Warteliste und Ticketkauf.
--
-- Die Warteliste verpflichtet zu nichts, haelt die Zustimmung aber trotzdem
-- fest: beim Nachruecken entsteht daraus eine Anfrage, und die soll nicht ohne
-- Nachweis dastehen. Der Stand wandert dann mit.
drop function if exists public.join_waitlist(uuid, text, date, text);

create or replace function public.join_waitlist(
  p_course_id uuid,
  p_desired_plan text,
  p_chosen_date date,
  p_dance_role text default null::text,
  p_terms_accepted boolean default false,
  p_terms_version text default null
)
returns waitlist_entries
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := auth.uid();
  v_max int;
  v_used int;
  v_role_enabled boolean;
  v_max_diff int;
  v_leader_count int;
  v_follower_count int;
  v_role_blocked boolean := false;
  v_row waitlist_entries;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  if not coalesce(p_terms_accepted, false) then
    raise exception 'terms not accepted';
  end if;
  if p_terms_version is null or trim(p_terms_version) = '' then
    raise exception 'terms version missing';
  end if;

  if not exists (
    select 1 from sepa_mandates where customer_id = v_customer_id and revoked_at is null
  ) then
    raise exception 'mandate required';
  end if;

  select max_participants, role_query_enabled, max_role_difference
    into v_max, v_role_enabled, v_max_diff
    from courses where id = p_course_id;

  if v_max is not null then
    select
      (select count(*) from subscriptions where course_id = p_course_id and status = 'active')
      + (select count(*) from course_bookings where course_id = p_course_id and type = 'regular' and status = 'open')
    into v_used;
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
      v_role_blocked := true;
    elsif p_dance_role = 'follower' and (v_follower_count + 1) - v_leader_count > v_max_diff then
      v_role_blocked := true;
    end if;
  end if;

  if not v_role_blocked and (v_max is null or v_used < v_max) then
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

  insert into waitlist_entries (
    course_id, customer_id, desired_plan, chosen_date, dance_role, terms_accepted_at, terms_version
  )
  values (
    p_course_id, v_customer_id, p_desired_plan, p_chosen_date, nullif(p_dance_role, ''), now(), p_terms_version
  )
  returning * into v_row;

  return v_row;
end;
$function$;

-- Ein Ticketkauf ist ein Vertragsschluss wie eine Kursbuchung.
drop function if exists public.purchase_event_ticket(uuid, text, boolean);

create or replace function public.purchase_event_ticket(
  p_event_id uuid,
  p_payment_method text,
  p_wants_student_price boolean,
  p_terms_accepted boolean default false,
  p_terms_version text default null
)
returns tickets
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := auth.uid();
  v_event events;
  v_used int;
  v_price numeric;
  v_status text;
  v_row tickets;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  if not coalesce(p_terms_accepted, false) then
    raise exception 'terms not accepted';
  end if;
  if p_terms_version is null or trim(p_terms_version) = '' then
    raise exception 'terms version missing';
  end if;

  if p_payment_method not in ('sepa', 'onsite') then
    raise exception 'invalid payment method';
  end if;

  select * into v_event from events where id = p_event_id for update;

  if v_event is null then
    raise exception 'event not found';
  end if;
  if v_event.status <> 'geplant' then
    raise exception 'event not open';
  end if;
  if v_event.starts_at <= now() then
    raise exception 'event not open';
  end if;

  select count(*) into v_used
  from tickets
  where event_id = p_event_id and status in ('reserved', 'confirmed', 'checked_in');

  if v_used >= v_event.capacity then
    raise exception 'event is full';
  end if;

  if p_payment_method = 'sepa' then
    if not exists (
      select 1 from sepa_mandates where customer_id = v_customer_id and revoked_at is null
    ) then
      raise exception 'no active mandate';
    end if;
    v_status := 'confirmed';
  else
    v_status := 'reserved';
  end if;

  v_price := case when p_wants_student_price then v_event.price_student else v_event.price_normal end;

  insert into tickets (
    event_id, customer_id, payment_method, wants_student_price, price, status,
    terms_accepted_at, terms_version
  )
  values (
    p_event_id, v_customer_id, p_payment_method, p_wants_student_price, v_price, v_status,
    now(), p_terms_version
  )
  returning * into v_row;

  return v_row;
end;
$function$;
