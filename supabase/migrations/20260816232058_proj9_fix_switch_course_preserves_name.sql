create or replace function self_switch_subscription_course(p_subscription_id uuid, p_new_course_id uuid)
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row subscriptions;
begin
  perform 1 from courses where id = p_new_course_id;
  if not found then
    raise exception 'course not found';
  end if;

  update subscriptions
  set course_id = p_new_course_id
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
