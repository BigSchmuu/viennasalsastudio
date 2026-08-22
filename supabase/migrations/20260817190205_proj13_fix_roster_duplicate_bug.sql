-- BUG-1 fix: a customer with both an active course-bound subscription AND a
-- confirmed trial/dropin booking for the same date was appearing twice in
-- the roster, because UNION only dedupes identical (customer_id, source)
-- pairs, not same-customer-different-source rows. Fixed by ranking sources
-- by priority (abo > buchung > manuell) and picking one row per customer.
create or replace function get_course_attendance_roster(p_course_id uuid, p_occurrence_date date)
returns table (
  customer_id uuid,
  full_name text,
  source text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_course_teacher(p_course_id) or "current_role"() = 'admin') then
    raise exception 'not authorized';
  end if;

  return query
  with expected_all as (
    select s.customer_id, 'abo' as source, 1 as priority
    from subscriptions s
    where s.course_id = p_course_id and s.status = 'active'
    union all
    select cb.customer_id, 'buchung' as source, 2 as priority
    from course_bookings cb
    where cb.course_id = p_course_id
      and cb.type in ('trial', 'dropin')
      and cb.status = 'confirmed'
      and cb.chosen_date = p_occurrence_date
    union all
    select ca.customer_id, 'manuell' as source, 3 as priority
    from course_attendance ca
    where ca.course_id = p_course_id and ca.occurrence_date = p_occurrence_date
      and ca.customer_id not in (
        select s2.customer_id from subscriptions s2 where s2.course_id = p_course_id and s2.status = 'active'
        union
        select cb2.customer_id from course_bookings cb2
        where cb2.course_id = p_course_id and cb2.type in ('trial', 'dropin') and cb2.status = 'confirmed'
          and cb2.chosen_date = p_occurrence_date
      )
  ),
  expected as (
    select distinct on (expected_all.customer_id) expected_all.customer_id, expected_all.source
    from expected_all
    order by expected_all.customer_id, expected_all.priority
  )
  select e.customer_id, p.full_name, e.source, ca.status
  from expected e
  join profiles p on p.id = e.customer_id
  left join course_attendance ca
    on ca.course_id = p_course_id and ca.customer_id = e.customer_id and ca.occurrence_date = p_occurrence_date
  order by p.full_name;
end;
$$;

revoke all on function get_course_attendance_roster(uuid, date) from public;
revoke all on function get_course_attendance_roster(uuid, date) from anon;
grant execute on function get_course_attendance_roster(uuid, date) to authenticated;
