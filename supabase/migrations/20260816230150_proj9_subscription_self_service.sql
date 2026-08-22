-- Optional course link (empty for Flatrate subscriptions or legacy free-text ones)
alter table subscriptions add column course_id uuid references courses(id) on delete restrict;

-- Cycle anchor date, admin-maintained; backfill existing rows with created_at as a reasonable fallback
alter table subscriptions add column cycle_anchor_date date;
update subscriptions set cycle_anchor_date = created_at::date where cycle_anchor_date is null;
alter table subscriptions alter column cycle_anchor_date set not null;
alter table subscriptions alter column cycle_anchor_date set default current_date;

-- Planned pause/cancellation, effective at the next cycle end
alter table subscriptions add column pending_status text
  check (pending_status is null or pending_status in ('paused', 'cancelled'));
alter table subscriptions add column pending_effective_date date;

-- Computes the next cycle-end date (28-day cycles) strictly after today, anchored at p_anchor.
create or replace function next_cycle_end(p_anchor date) returns date
language sql
stable
as $$
  select p_anchor + (greatest(1, floor((current_date - p_anchor)::numeric / 28)::int + 1) * 28);
$$;

-- Customer self-service RPCs (SECURITY DEFINER): each does its own ownership + state check
-- and only ever touches the specific columns it's coded for, regardless of what a caller
-- might otherwise be able to reach via a raw table UPDATE. No customer-facing UPDATE policy
-- exists on subscriptions at all — this is the only write path available to customers.

create or replace function self_schedule_subscription_change(p_subscription_id uuid, p_new_pending_status text)
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row subscriptions;
begin
  if p_new_pending_status not in ('paused', 'cancelled') then
    raise exception 'invalid pending status';
  end if;

  update subscriptions
  set pending_status = p_new_pending_status,
      pending_effective_date = next_cycle_end(cycle_anchor_date)
  where id = p_subscription_id
    and customer_id = auth.uid()
    and status = 'active'
    and pending_status is null
  returning * into v_row;

  if not found then
    raise exception 'subscription not eligible for this change';
  end if;

  return v_row;
end;
$$;

create or replace function self_undo_pending_change(p_subscription_id uuid)
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row subscriptions;
begin
  update subscriptions
  set pending_status = null,
      pending_effective_date = null
  where id = p_subscription_id
    and customer_id = auth.uid()
    and pending_status is not null
  returning * into v_row;

  if not found then
    raise exception 'no pending change to undo';
  end if;

  return v_row;
end;
$$;

create or replace function self_reactivate_subscription(p_subscription_id uuid)
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row subscriptions;
begin
  update subscriptions
  set status = 'active'
  where id = p_subscription_id
    and customer_id = auth.uid()
    and status = 'paused'
  returning * into v_row;

  if not found then
    raise exception 'subscription not eligible for reactivation';
  end if;

  return v_row;
end;
$$;

create or replace function self_switch_subscription_course(p_subscription_id uuid, p_new_course_id uuid)
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row subscriptions;
  v_course_name text;
begin
  select name into v_course_name from courses where id = p_new_course_id;
  if not found then
    raise exception 'course not found';
  end if;

  update subscriptions
  set course_id = p_new_course_id,
      name = v_course_name
  where id = p_subscription_id
    and customer_id = auth.uid()
    and status = 'active'
    and course_id is not null
  returning * into v_row;

  if not found then
    raise exception 'subscription not eligible for a course switch';
  end if;

  return v_row;
end;
$$;

grant execute on function self_schedule_subscription_change(uuid, text) to authenticated;
grant execute on function self_undo_pending_change(uuid) to authenticated;
grant execute on function self_reactivate_subscription(uuid) to authenticated;
grant execute on function self_switch_subscription_course(uuid, uuid) to authenticated;
