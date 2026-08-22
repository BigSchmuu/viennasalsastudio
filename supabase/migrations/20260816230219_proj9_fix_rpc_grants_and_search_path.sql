-- Postgres grants EXECUTE to PUBLIC by default on function creation (unlike tables,
-- which don't get default anon/authenticated grants at the schema level). The earlier
-- migration only ADDED a grant to authenticated without revoking the PUBLIC default,
-- leaving these callable by anon too. Practically harmless here (auth.uid() is null for
-- anon, so the ownership check inside each function always fails), but should be closed
-- explicitly rather than relying on that as the only guard.
revoke execute on function self_schedule_subscription_change(uuid, text) from public;
revoke execute on function self_undo_pending_change(uuid) from public;
revoke execute on function self_reactivate_subscription(uuid) from public;
revoke execute on function self_switch_subscription_course(uuid, uuid) from public;

grant execute on function self_schedule_subscription_change(uuid, text) to authenticated;
grant execute on function self_undo_pending_change(uuid) to authenticated;
grant execute on function self_reactivate_subscription(uuid) to authenticated;
grant execute on function self_switch_subscription_course(uuid, uuid) to authenticated;

create or replace function next_cycle_end(p_anchor date) returns date
language sql
stable
set search_path = public
as $$
  select p_anchor + (greatest(1, floor((current_date - p_anchor)::numeric / 28)::int + 1) * 28);
$$;
