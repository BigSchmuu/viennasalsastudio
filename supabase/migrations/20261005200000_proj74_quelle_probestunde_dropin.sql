-- PROJ-74: Die Anwesenheitsliste benennt Probestunde und Drop-In getrennt.
--
-- Bisher hiess beides "buchung". Fuer die Lehrkraft am Kursabend ist das der
-- entscheidende Unterschied: Eine Probestunde ist jemand, der zum ersten Mal da
-- ist, ein Drop-In zahlt pro Besuch. Ein Gast (PROJ-60) war schon vorher
-- getrennt benannt.
--
-- Der Rueckgabetyp bleibt unveraendert — nur die Werte in `source` werden
-- genauer. Deshalb genuegt `create or replace`.
--
-- Alles andere ist Wort fuer Wort aus der Fassung von PROJ-69 uebernommen:
-- `gilt_ab` an beiden Stellen (Erwartungsliste und Ausschlussliste), die
-- Rangfolge der Quellen und die Rechtepruefung.
create or replace function public.get_course_attendance_roster(p_course_id uuid, p_occurrence_date date)
returns table (customer_id uuid, full_name text, source text, status text, self_checked_in boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not (is_course_teacher(p_course_id) or "current_role"() = 'admin') then
    raise exception 'not authorized';
  end if;
  return query
  with expected_all as (
    select cm.customer_id, 'abo'::text as source, 1 as priority from course_members cm
    where cm.course_id = p_course_id and cm.gilt_ab <= p_occurrence_date
    union all
    -- PROJ-74: hier die einzige inhaltliche Aenderung.
    select cb.customer_id,
      case when cb.type = 'trial' then 'probestunde' else 'dropin' end as source,
      2 as priority
    from course_bookings cb
    where cb.course_id = p_course_id and cb.type in ('trial', 'dropin') and cb.status = 'confirmed'
      and cb.chosen_date = p_occurrence_date
    union all
    select cb.customer_id, 'gast'::text as source, 2 as priority from course_bookings cb
    where cb.course_id = p_course_id and cb.type = 'guest' and cb.status = 'confirmed'
      and cb.chosen_date = p_occurrence_date
    union all
    select ca.customer_id, 'manuell'::text as source, 3 as priority from course_attendance ca
    where ca.course_id = p_course_id and ca.occurrence_date = p_occurrence_date
      and ca.customer_id not in (
        select cm2.customer_id from course_members cm2
        where cm2.course_id = p_course_id and cm2.gilt_ab <= p_occurrence_date
        union
        select cb2.customer_id from course_bookings cb2
        where cb2.course_id = p_course_id and cb2.type in ('trial', 'dropin', 'guest')
          and cb2.status = 'confirmed' and cb2.chosen_date = p_occurrence_date
      )
  ),
  expected as (
    select distinct on (expected_all.customer_id) expected_all.customer_id, expected_all.source
    from expected_all order by expected_all.customer_id, expected_all.priority
  )
  select e.customer_id, p.full_name, e.source, ca.status,
    (ca.marked_by is not null and ca.marked_by = e.customer_id) as self_checked_in
  from expected e
  join profiles p on p.id = e.customer_id
  left join course_attendance ca
    on ca.course_id = p_course_id and ca.customer_id = e.customer_id and ca.occurrence_date = p_occurrence_date
  order by p.full_name;
end;
$$;

-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.get_course_attendance_roster(uuid, date) from public, anon;
grant execute on function public.get_course_attendance_roster(uuid, date) to authenticated;
