-- PROJ-30: Leader/Follower-Auswahl bei Kursbuchung mit Balance-Warteliste

alter table courses add column role_query_enabled boolean not null default false;
alter table courses add column max_role_difference integer;

alter table course_bookings add column dance_role text check (dance_role in ('leader', 'follower', 'both'));
alter table waitlist_entries add column dance_role text check (dance_role in ('leader', 'follower', 'both'));

comment on column courses.role_query_enabled is 'PROJ-30: whether the booking dialog asks for Leader/Follower/Both';
comment on column courses.max_role_difference is 'PROJ-30: max allowed |leader_count - follower_count| for this course; null = no balance limit';
comment on column course_bookings.dance_role is 'PROJ-30: customer''s chosen dance role for this booking, only meaningful when the course has role_query_enabled';
comment on column waitlist_entries.dance_role is 'PROJ-30: role the customer wants to be promoted for, carried over from the booking attempt that led to joining the waitlist';

-- Capacity check + role-balance check + insert, all atomically under the
-- same row lock used for capacity today (see original comment in this
-- function) so a role-balance check can't be raced any more than capacity
-- can.
create or replace function public.create_regular_course_booking(
  p_course_id uuid,
  p_desired_plan text,
  p_chosen_date date,
  p_note text,
  p_prerequisite_confirmed boolean default false,
  p_dance_role text default null
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
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  select prerequisite_note into v_prerequisite_note from courses where id = p_course_id;
  if v_prerequisite_note is not null and not p_prerequisite_confirmed then
    raise exception 'prerequisite not confirmed';
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

  insert into course_bookings (customer_id, course_id, type, status, desired_plan, chosen_date, note, dance_role)
  values (v_customer_id, p_course_id, 'regular', 'open', p_desired_plan, p_chosen_date, nullif(p_note, ''), nullif(p_dance_role, ''))
  returning * into v_row;

  return v_row;
end;
$function$;

-- Allow joining the waitlist either when the course is at capacity (as
-- before) or when the customer's chosen role alone would exceed the
-- configured role-balance limit, even if seats are otherwise free.
create or replace function public.join_waitlist(
  p_course_id uuid,
  p_desired_plan text,
  p_chosen_date date,
  p_dance_role text default null
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

  insert into waitlist_entries (course_id, customer_id, desired_plan, chosen_date, dance_role)
  values (p_course_id, v_customer_id, p_desired_plan, p_chosen_date, nullif(p_dance_role, ''))
  returning * into v_row;

  return v_row;
end;
$function$;

-- Promotion now searches the waitlist (still FIFO-first) for the oldest
-- entry whose role wouldn't re-violate the balance limit, instead of
-- always taking the single oldest entry — so a course can't get stuck
-- behind a front-of-queue entry with the "wrong" role. When role-balance
-- isn't configured for the course, behavior is unchanged (oldest entry,
-- no role filtering).
create or replace function public.promote_waitlist_for_course(p_course_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_max int;
  v_role_enabled boolean;
  v_max_diff int;
  v_used int;
  v_leader_count int;
  v_follower_count int;
  v_entry waitlist_entries;
  v_promoted int := 0;
begin
  if public.current_role() <> 'admin' then
    raise exception 'not authorized';
  end if;

  select max_participants, role_query_enabled, max_role_difference
    into v_max, v_role_enabled, v_max_diff
    from courses where id = p_course_id;

  if v_max is null then
    return 0;
  end if;

  loop
    select
      (select count(*) from subscriptions where course_id = p_course_id and status = 'active')
      + (select count(*) from course_bookings where course_id = p_course_id and type = 'regular' and status = 'open')
    into v_used;

    exit when v_used >= v_max;

    if v_role_enabled and v_max_diff is not null then
      select
        (select count(*) from subscriptions s join course_bookings cb on cb.subscription_id = s.id
          where s.course_id = p_course_id and s.status = 'active' and cb.dance_role = 'leader')
        + (select count(*) from course_bookings where course_id = p_course_id and type = 'regular' and status = 'open' and dance_role = 'leader'),
        (select count(*) from subscriptions s join course_bookings cb on cb.subscription_id = s.id
          where s.course_id = p_course_id and s.status = 'active' and cb.dance_role = 'follower')
        + (select count(*) from course_bookings where course_id = p_course_id and type = 'regular' and status = 'open' and dance_role = 'follower')
      into v_leader_count, v_follower_count;

      select * into v_entry
      from waitlist_entries
      where course_id = p_course_id
        and (
          dance_role is null
          or dance_role = 'both'
          or (dance_role = 'leader' and (v_leader_count + 1) - v_follower_count <= v_max_diff)
          or (dance_role = 'follower' and (v_follower_count + 1) - v_leader_count <= v_max_diff)
        )
      order by created_at asc
      limit 1;
    else
      select * into v_entry
      from waitlist_entries
      where course_id = p_course_id
      order by created_at asc
      limit 1;
    end if;

    exit when v_entry is null;

    insert into course_bookings (customer_id, course_id, type, status, desired_plan, chosen_date, dance_role)
    values (v_entry.customer_id, p_course_id, 'regular', 'open', v_entry.desired_plan, v_entry.chosen_date, v_entry.dance_role);

    perform enqueue_notification(
      v_entry.customer_id,
      'warteliste',
      jsonb_build_object('course_id', p_course_id, 'chosen_date', v_entry.chosen_date),
      'waitlist_promote:' || v_entry.id
    );

    delete from waitlist_entries where id = v_entry.id;
    v_promoted := v_promoted + 1;
  end loop;

  return v_promoted;
end;
$function$;
