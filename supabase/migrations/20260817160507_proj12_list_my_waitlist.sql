create or replace function list_my_waitlist()
returns table (
  id uuid,
  course_id uuid,
  desired_plan text,
  chosen_date date,
  created_at timestamptz,
  "position" bigint
)
language sql
security definer
set search_path = public
as $$
  select
    w.id,
    w.course_id,
    w.desired_plan,
    w.chosen_date,
    w.created_at,
    (
      select count(*) + 1
      from waitlist_entries w2
      where w2.course_id = w.course_id
        and w2.created_at < w.created_at
    ) as "position"
  from waitlist_entries w
  where w.customer_id = auth.uid()
  order by w.created_at asc;
$$;

revoke all on function list_my_waitlist() from public;
revoke all on function list_my_waitlist() from anon;
grant execute on function list_my_waitlist() to authenticated;
