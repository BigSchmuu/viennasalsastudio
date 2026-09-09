-- PROJ-50: Kursplatz hinzufügen und entfernen.
--
-- Vollständig in der Datenbank, nicht im Anwendungscode: Die Kursgrenze
-- verlangt dieselbe Zeilensperre auf den Kurs wie eine reguläre Buchung.
-- Zwei Klicks auf den letzten Platz kämen sonst beide durch.

-- Belegung und Rollenzahlen an einer Stelle.
--
-- Fünf Vorgänge rechnen dieselbe Zahl aus: Buchen, Warteliste betreten,
-- Nachrücken, Kursplatz hinzufügen, Admin-Zuweisung. Bisher stand die Formel
-- fünfmal da — und in allen fünf Fassungen fehlte der Flatrate-Kunde.
create or replace function public.kurs_belegung(p_course_id uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    (select count(*) from course_members where course_id = p_course_id)::int
    + (select count(*) from course_bookings
       where course_id = p_course_id and type = 'regular' and status = 'open')::int;
$$;

create or replace function public.kurs_rollenanzahl(p_course_id uuid, p_rolle text)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    (select count(*) from course_members
     where course_id = p_course_id and dance_role = p_rolle)::int
    + (select count(*) from course_bookings
       where course_id = p_course_id and type = 'regular' and status = 'open'
         and dance_role = p_rolle)::int;
$$;

-- Das aktive Flatrate-Abo eines Kunden — das älteste, falls es (noch) mehrere
-- gibt. Doppelte Flatrates sind ein Altbestand, der bereinigt gehört; hier
-- wird deshalb nicht geraten, sondern immer dasselbe genommen.
create or replace function public.aktive_flatrate(p_customer_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select id from subscriptions
  where customer_id = p_customer_id and course_id is null and status = 'active'
  order by created_at asc
  limit 1;
$$;

-- Kurs zur eigenen Flatrate hinzufügen.
--
-- Dieselben Sperren wie bei einer regulären Buchung — nur ohne Abo, ohne
-- Preis und ohne Bestätigung durch den Betreiber. Die Geldfrage ist mit der
-- Flatrate bereits entschieden.
create or replace function public.add_course_to_flatrate(
  p_course_id uuid,
  p_dance_role text default null,
  p_prerequisite_confirmed boolean default false
)
returns course_memberships
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_customer_id uuid := auth.uid();
  v_subscription_id uuid;
  v_prerequisite_note text;
  v_max int;
  v_role_enabled boolean;
  v_max_diff int;
  v_leader int;
  v_follower int;
  v_row course_memberships;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  v_subscription_id := aktive_flatrate(v_customer_id);
  if v_subscription_id is null then
    raise exception 'no flatrate';
  end if;

  perform require_dance_role(p_course_id, p_dance_role);

  select prerequisite_note into v_prerequisite_note from courses where id = p_course_id;
  if v_prerequisite_note is not null and not p_prerequisite_confirmed then
    raise exception 'prerequisite not confirmed';
  end if;

  -- Über die gemeinsame Sicht, nicht über eine der beiden Tabellen: Wer ein
  -- kursgebundenes Abo für denselben Kurs hat, ist ebenfalls schon drin.
  if exists (
    select 1 from course_members
    where course_id = p_course_id and customer_id = v_customer_id
  ) then
    raise exception 'already enrolled';
  end if;

  if exists (
    select 1 from course_bookings
    where course_id = p_course_id and customer_id = v_customer_id
      and type = 'regular' and status = 'open'
  ) then
    raise exception 'already requested';
  end if;

  -- Ab hier unter Sperre: Grenze prüfen und eintragen müssen zusammen
  -- geschehen, sonst greifen zwei gleichzeitige Klicks am letzten Platz vorbei.
  select max_participants, role_query_enabled, max_role_difference
    into v_max, v_role_enabled, v_max_diff
    from courses where id = p_course_id for update;

  if v_max is not null and kurs_belegung(p_course_id) >= v_max then
    raise exception 'course is full';
  end if;

  if v_role_enabled and v_max_diff is not null and p_dance_role in ('leader', 'follower') then
    v_leader := kurs_rollenanzahl(p_course_id, 'leader');
    v_follower := kurs_rollenanzahl(p_course_id, 'follower');
    if p_dance_role = 'leader' and (v_leader + 1) - v_follower > v_max_diff then
      raise exception 'role imbalance';
    elsif p_dance_role = 'follower' and (v_follower + 1) - v_leader > v_max_diff then
      raise exception 'role imbalance';
    end if;
  end if;

  insert into course_memberships (customer_id, course_id, subscription_id, dance_role)
  values (v_customer_id, p_course_id, v_subscription_id, nullif(p_dance_role, ''))
  returning * into v_row;

  return v_row;
end;
$$;

-- Kurs aus der eigenen Flatrate entfernen.
--
-- Sofort wirksam: Es ändert nichts am Geld, es gibt keine Frist zu wahren.
-- Der Platz wird frei, und die Warteliste rückt unmittelbar nach — sonst
-- bliebe ein Platz liegen, den jemand haben will.
create or replace function public.remove_course_from_flatrate(p_course_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_customer_id uuid := auth.uid();
  v_betroffen int;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  update course_memberships
  set ended_on = public.heute_wien()
  where customer_id = v_customer_id and course_id = p_course_id and ended_on is null;
  get diagnostics v_betroffen = row_count;

  if v_betroffen = 0 then
    raise exception 'not a member';
  end if;

  perform promote_waitlist_internal(p_course_id);
  return v_betroffen;
end;
$$;

-- Dasselbe für den Betreiber, an einem fremden Kunden.
--
-- Ein Unterschied zum Kundenweg: Der Betreiber darf die Kursgrenze
-- überschreiben. Ein Kurs ist manchmal für einen Menschen voll und für einen
-- anderen nicht — diese Entscheidung gehört ihm. Dem Kunden gerade nicht,
-- sonst ist die Grenze keine.
create or replace function public.admin_add_course_membership(
  p_customer_id uuid,
  p_course_id uuid,
  p_dance_role text default null,
  p_ignore_capacity boolean default false
)
returns course_memberships
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_subscription_id uuid;
  v_max int;
  v_row course_memberships;
begin
  if public."current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  v_subscription_id := aktive_flatrate(p_customer_id);
  if v_subscription_id is null then
    raise exception 'no flatrate';
  end if;

  if exists (
    select 1 from course_members
    where course_id = p_course_id and customer_id = p_customer_id
  ) then
    raise exception 'already enrolled';
  end if;

  select max_participants into v_max from courses where id = p_course_id for update;

  if not p_ignore_capacity and v_max is not null and kurs_belegung(p_course_id) >= v_max then
    raise exception 'course is full';
  end if;

  insert into course_memberships (customer_id, course_id, subscription_id, dance_role)
  values (p_customer_id, p_course_id, v_subscription_id, nullif(p_dance_role, ''))
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.admin_remove_course_membership(
  p_customer_id uuid,
  p_course_id uuid
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_betroffen int;
begin
  if public."current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  update course_memberships
  set ended_on = public.heute_wien()
  where customer_id = p_customer_id and course_id = p_course_id and ended_on is null;
  get diagnostics v_betroffen = row_count;

  if v_betroffen > 0 then
    perform promote_waitlist_internal(p_course_id);
  end if;
  return v_betroffen;
end;
$$;

revoke all on function public.kurs_belegung(uuid) from public, anon;
revoke all on function public.kurs_rollenanzahl(uuid, text) from public, anon;
revoke all on function public.aktive_flatrate(uuid) from public, anon;
revoke all on function public.add_course_to_flatrate(uuid, text, boolean) from public, anon;
revoke all on function public.remove_course_from_flatrate(uuid) from public, anon;
revoke all on function public.admin_add_course_membership(uuid, uuid, text, boolean) from public, anon;
revoke all on function public.admin_remove_course_membership(uuid, uuid) from public, anon;

-- `kurs_belegung` beantwortet eine öffentliche Frage (freie Plätze im Katalog)
-- und darf deshalb von jedem Angemeldeten aufgerufen werden. Die drei
-- Vorgänge bringen ihren eigenen Zaun mit.
grant execute on function public.kurs_belegung(uuid) to authenticated;
grant execute on function public.add_course_to_flatrate(uuid, text, boolean) to authenticated;
grant execute on function public.remove_course_from_flatrate(uuid) to authenticated;
grant execute on function public.admin_add_course_membership(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.admin_remove_course_membership(uuid, uuid) to authenticated;
