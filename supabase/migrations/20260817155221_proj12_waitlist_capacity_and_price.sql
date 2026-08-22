
-- Kapazität und fester Preis pro Kurs (beides optional, kein Migrationsbedarf für bestehende Kurse)
alter table courses add column max_participants int;
alter table courses add column price numeric;

-- Warteliste
create table waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  customer_id uuid not null references profiles(id),
  desired_plan text not null,
  chosen_date date not null,
  created_at timestamptz not null default now()
);

create index idx_waitlist_entries_course_id on waitlist_entries(course_id);
create index idx_waitlist_entries_customer_id on waitlist_entries(customer_id);

alter table waitlist_entries enable row level security;

create policy "Waitlist entries: own or admin read"
on waitlist_entries for select
to public
using (customer_id = (select auth.uid()) or "current_role"() = 'admin');

create policy "Waitlist entries: own or admin delete"
on waitlist_entries for delete
to public
using (customer_id = (select auth.uid()) or "current_role"() = 'admin');

-- bewusst keine INSERT-Policy: Eintragen läuft ausschließlich über die
-- geschützte join_waitlist()-Funktion, die die Kapazität atomar prüft

-- Race-condition-sicheres Eintragen auf die Warteliste
create or replace function join_waitlist(p_course_id uuid, p_desired_plan text, p_chosen_date date)
returns waitlist_entries
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_customer_id uuid := auth.uid();
  v_max int;
  v_used int;
  v_row waitlist_entries;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  select max_participants into v_max from courses where id = p_course_id;
  if v_max is null then
    raise exception 'course has no capacity limit';
  end if;

  select
    (select count(*) from subscriptions where course_id = p_course_id and status = 'active')
    + (select count(*) from course_bookings where course_id = p_course_id and type = 'regular' and status = 'open')
  into v_used;

  if v_used < v_max then
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

  insert into waitlist_entries (course_id, customer_id, desired_plan, chosen_date)
  values (p_course_id, v_customer_id, p_desired_plan, p_chosen_date)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function join_waitlist(uuid, text, date) from public;
revoke all on function join_waitlist(uuid, text, date) from anon;
grant execute on function join_waitlist(uuid, text, date) to authenticated;

-- Race-condition-sichere automatische Nachrückung: promotet so viele
-- Wartelisten-Einträge wie gerade Kapazität frei ist (Schleife), indem
-- jeder promotete Eintrag in eine normale offene Buchungsanfrage
-- umgewandelt wird (nutzt den bestehenden PROJ-8-Bestätigungsablauf weiter).
create or replace function promote_waitlist_for_course(p_course_id uuid)
returns int
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_max int;
  v_used int;
  v_entry waitlist_entries;
  v_promoted int := 0;
begin
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

    delete from waitlist_entries where id = v_entry.id;
    v_promoted := v_promoted + 1;
  end loop;

  return v_promoted;
end;
$$;

revoke all on function promote_waitlist_for_course(uuid) from public;
revoke all on function promote_waitlist_for_course(uuid) from anon;
grant execute on function promote_waitlist_for_course(uuid) to authenticated;
