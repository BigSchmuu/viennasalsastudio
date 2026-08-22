
create or replace function public.promote_waitlist_for_course(p_course_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_max int;
  v_used int;
  v_entry waitlist_entries;
  v_promoted int := 0;
begin
  if public.current_role() <> 'admin' then
    raise exception 'not authorized';
  end if;

  select max_participants into v_max from courses where id = p_course_id;
  if v_max is null then
    return 0;
  end if;

  loop
    select
      (select count(*) from subscriptions where course_id = p_course_id and status = 'active')
      + (select count(*) from course_bookings where course_id = p_course_id and type = 'regular' and status = 'open')
    into v_used;

    exit when v_used >= v_max;

    select * into v_entry
    from waitlist_entries
    where course_id = p_course_id
    order by created_at asc
    limit 1;

    exit when v_entry is null;

    insert into course_bookings (customer_id, course_id, type, status, desired_plan, chosen_date)
    values (v_entry.customer_id, p_course_id, 'regular', 'open', v_entry.desired_plan, v_entry.chosen_date);

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
