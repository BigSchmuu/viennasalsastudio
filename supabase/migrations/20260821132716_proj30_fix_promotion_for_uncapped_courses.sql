-- Bug found during live verification: a course with role_query_enabled +
-- max_role_difference but NO max_participants (unbounded capacity, purely
-- role-gated) could never promote anyone from its waitlist, because the
-- function returned early whenever max_participants was null. Fixed by only
-- short-circuiting when NEITHER capacity nor role-balance is configured
-- (the only case where join_waitlist could never have let anyone join in
-- the first place), and by only checking the capacity exit condition when
-- a capacity limit actually exists.
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
  v_role_gated boolean;
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

  v_role_gated := v_role_enabled and v_max_diff is not null;

  if v_max is null and not v_role_gated then
    return 0;
  end if;

  loop
    if v_max is not null then
      select
        (select count(*) from subscriptions where course_id = p_course_id and status = 'active')
        + (select count(*) from course_bookings where course_id = p_course_id and type = 'regular' and status = 'open')
      into v_used;

      exit when v_used >= v_max;
    end if;

    if v_role_gated then
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
