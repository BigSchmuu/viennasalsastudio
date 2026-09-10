-- PROJ-50: Die Lesestellen benutzen die gemeinsame Antwort.
--
-- Bis hierher gab es die Sicht `course_members`, aber niemand las sie: Die
-- Kursplätze existierten und blieben unsichtbar. Diese Migration dreht die
-- sieben Stellen um, die bisher `subscriptions.course_id` befragt haben.
--
-- Erst danach ist der Flatrate-Kunde im Kursbetrieb wirklich vorhanden — in der
-- Anwesenheitsliste, in der Kursgrenze, in der Rollenbalance, beim
-- Selbst-Check-in und in den Ausfall-Benachrichtigungen.
--
-- Hinweis für später: `create or replace function` setzt die Rechte jeder
-- Funktion zurück, und Supabase vergibt EXECUTE per Default-Privileg neu an
-- `anon`. Deshalb steht am Ende dieser Datei ein Block, der das für **jede**
-- angefasste Funktion zurücknimmt. Siehe .claude/rules/backend.md.

-- 1. Freie Plätze im Katalog.
create or replace function public.get_course_occupancy()
returns table (course_id uuid, occupied_count integer)
language sql
stable
security definer
set search_path to 'public'
as $$
  select course_id, count(*)::int as occupied_count
  from (
    select cm.course_id from course_members cm
    union all
    select cb.course_id from course_bookings cb
    where cb.type = 'regular' and cb.status = 'open'
  ) occupants
  group by course_id;
$$;

-- 2. Die Anwesenheitsliste.
--
-- Der Flatrate-Kunde stand hier nie drin; der Lehrer musste ihn in jeder Stunde
-- über „Kunde hinzufügen" nachtragen. Als Quelle gilt weiterhin „abo" — ob der
-- Platz aus einem kursgebundenen Abo oder einer Flatrate stammt, ändert für den
-- Lehrer nichts.
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
    select cm.customer_id, 'abo' as source, 1 as priority from course_members cm
    where cm.course_id = p_course_id
    union all
    select cb.customer_id, 'buchung' as source, 2 as priority from course_bookings cb
    where cb.course_id = p_course_id and cb.type in ('trial', 'dropin') and cb.status = 'confirmed'
      and cb.chosen_date = p_occurrence_date
    union all
    select ca.customer_id, 'manuell' as source, 3 as priority from course_attendance ca
    where ca.course_id = p_course_id and ca.occurrence_date = p_occurrence_date
      and ca.customer_id not in (
        select cm2.customer_id from course_members cm2 where cm2.course_id = p_course_id
        union
        select cb2.customer_id from course_bookings cb2
        where cb2.course_id = p_course_id and cb2.type in ('trial', 'dropin') and cb2.status = 'confirmed'
          and cb2.chosen_date = p_occurrence_date
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

-- 3. Der Selbst-Check-in.
--
-- Bisher: „hast du ein Abo für genau diesen Kurs?" — ein Flatrate-Kunde bekam
-- „no active subscription", obwohl er zahlt.
--
-- Bis auf diese eine Prüfung ist der Rumpf wortgleich mit dem bisherigen. Beim
-- ersten Versuch hatte ich ihn aus dem Gedächtnis nachgebaut und dabei still
-- eine Regel erfunden („nach Stundenende kein Check-in") sowie die echte
-- verloren („nach Stundenende nicht mehr zurücknehmen"). Deshalb hier das
-- Original, minimal geändert.
create or replace function public.self_toggle_attendance(p_course_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_customer_id uuid := auth.uid();
  v_occurrence_date date := public.heute_wien();
  v_weekday int;
  v_start_time time;
  v_end_time time;
  v_is_paused boolean;
  v_ist_teilnehmer boolean;
  v_class_opens timestamptz;
  v_class_ends timestamptz;
  v_existing_status text;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  select cs.weekday, cs.start_time, cs.end_time
    into v_weekday, v_start_time, v_end_time
  from course_schedule cs
  where cs.course_id = p_course_id;

  if v_weekday is null then
    raise exception 'no schedule';
  end if;

  -- App-wide weekday convention: 0=Montag..6=Sonntag (jsDayToWeekday).
  -- Postgres isodow: 1=Monday..7=Sunday.
  if v_weekday <> (extract(isodow from v_occurrence_date)::int - 1) then
    raise exception 'not today';
  end if;

  select exists (
    select 1
    from course_schedule_pauses p
    join course_schedule cs2 on cs2.id = p.schedule_id
    where cs2.course_id = p_course_id and p.pause_date = v_occurrence_date
  ) into v_is_paused;
  if v_is_paused then
    raise exception 'course paused today';
  end if;

  -- HIER die einzige Änderung: über die gemeinsame Antwort statt über
  -- `subscriptions.course_id`.
  select exists (
    select 1 from course_members
    where course_id = p_course_id and customer_id = v_customer_id
  ) into v_ist_teilnehmer;
  if not v_ist_teilnehmer then
    raise exception 'no active subscription';
  end if;

  -- start_time/end_time are entered and displayed as Vienna wall-clock time
  -- everywhere else in the app; interpret them as such here too (not as
  -- naive UTC), otherwise the 30-minute window would be off by the
  -- Vienna/UTC offset (1-2h depending on DST).
  v_class_opens := ((v_occurrence_date::text || ' ' || v_start_time::text)::timestamp at time zone 'Europe/Vienna') - interval '30 minutes';
  v_class_ends := (v_occurrence_date::text || ' ' || v_end_time::text)::timestamp at time zone 'Europe/Vienna';

  if now() < v_class_opens then
    raise exception 'too early';
  end if;

  select status into v_existing_status
  from course_attendance
  where course_id = p_course_id and customer_id = v_customer_id and occurrence_date = v_occurrence_date;

  if v_existing_status = 'present' then
    if now() >= v_class_ends then
      raise exception 'cannot undo after class end';
    end if;
    delete from course_attendance
    where course_id = p_course_id and customer_id = v_customer_id and occurrence_date = v_occurrence_date;
    return 'removed';
  else
    insert into course_attendance (course_id, customer_id, occurrence_date, status, marked_by)
    values (p_course_id, v_customer_id, v_occurrence_date, 'present', v_customer_id)
    on conflict (course_id, customer_id, occurrence_date)
    do update set status = 'present', marked_by = v_customer_id, updated_at = now();
    return 'present';
  end if;
end;
$$;

-- 4. Teilnehmer und Geburtstage im Lehrer-Bereich (PROJ-49).
create or replace function public.get_course_active_subscribers(p_course_ids uuid[])
returns table (course_id uuid, customer_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $$
  select cm.course_id, cm.customer_id
  from course_members cm
  where cm.course_id = any(p_course_ids)
    and (is_course_teacher(cm.course_id) or "current_role"() = 'admin');
$$;

create or replace function public.get_course_participants(p_course_ids uuid[])
returns table (customer_id uuid, full_name text, birthdate date)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  return query
  select distinct p.id, p.full_name, p.birthdate
  from profiles p
  where p.id in (
    select cm.customer_id from course_members cm
    where cm.course_id = any(p_course_ids)
      and (is_course_teacher(cm.course_id) or "current_role"() = 'admin')
    union
    select b.customer_id from course_bookings b
    where b.course_id = any(p_course_ids)
      and b.status not in ('cancelled', 'rejected')
      and (is_course_teacher(b.course_id) or "current_role"() = 'admin')
  );
end;
$$;

-- 5. Die Tanzrollen im Lehrer-Bereich und in der Anwesenheitsliste.
--
-- Neue Form: eine Zeile je Teilnehmer statt einer je Buchung. Die Rolle steht
-- jetzt am Kursplatz, und dort gibt es sie genau einmal — die frühere
-- „die jüngste Buchung gewinnt"-Auswertung beim Aufrufer entfällt damit.
drop function if exists public.get_course_dance_roles(uuid[]);
create function public.get_course_dance_roles(p_course_ids uuid[])
returns table (course_id uuid, customer_id uuid, dance_role text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select cm.course_id, cm.customer_id, cm.dance_role
  from course_members cm
  where cm.course_id = any(p_course_ids)
    and cm.dance_role is not null
    and (is_course_teacher(cm.course_id) or "current_role"() = 'admin');
$$;

-- 6. Wer bei Kursausfall benachrichtigt wird.
--
-- Der Flatrate-Kunde erfuhr nichts und stand vor verschlossener Tür. Der
-- Vorgang läuft im Anwendungscode; er braucht eine Funktion, weil die Sicht
-- absichtlich für niemanden direkt lesbar ist.
create or replace function public.get_course_member_ids(p_course_id uuid)
returns table (customer_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $$
  select cm.customer_id
  from course_members cm
  where cm.course_id = p_course_id
    and (is_course_teacher(p_course_id) or "current_role"() = 'admin');
$$;

-- 7. Buchung und Warteliste.
--
-- Drei Rechnungen je Vorgang: „bin ich schon drin?", die Kursgrenze und das
-- Rollenverhältnis. Alle drei lasen `subscriptions.course_id` und zählten den
-- Flatrate-Kunden nicht mit — ein Kurs mit zwölf Plätzen konnte faktisch mehr
-- Leute haben.
--
-- Neu ist außerdem die Sperre am Anfang: Wer eine Flatrate hat, kann keine
-- reguläre Buchung mehr auslösen. Genau darüber entstand das zweite Abo. Die
-- Oberfläche bietet es ihm längst nicht mehr an — der Riegel gehört aber
-- dorthin, wo er nicht zu umgehen ist.
create or replace function public.create_regular_course_booking(
  p_course_id uuid,
  p_desired_plan text,
  p_chosen_date date,
  p_note text,
  p_prerequisite_confirmed boolean default false,
  p_dance_role text default null,
  p_coupon_code text default null,
  p_wants_student_price boolean default false,
  p_terms_accepted boolean default false,
  p_terms_version text default null
)
returns course_bookings
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_customer_id uuid := auth.uid();
  v_prerequisite_note text;
  v_max int;
  v_role_enabled boolean;
  v_max_diff int;
  v_leader_count int;
  v_follower_count int;
  v_row course_bookings;
  v_coupon_id uuid;
  v_price numeric;
  v_referrer_id uuid;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  -- PROJ-50: Wer pauschal zahlt, bucht nicht mehr — er trägt sich ein.
  if aktive_flatrate(v_customer_id) is not null then
    raise exception 'flatrate covers this';
  end if;

  -- PROJ-42: vor allen anderen Pruefungen. Ohne Zustimmung ist die Frage nach
  -- Kapazitaet oder Rollenverhaeltnis gegenstandslos.
  if not coalesce(p_terms_accepted, false) then
    raise exception 'terms not accepted';
  end if;
  perform assert_valid_terms_version(p_terms_version);

  perform require_dance_role(p_course_id, p_dance_role);

  select prerequisite_note into v_prerequisite_note from courses where id = p_course_id;
  if v_prerequisite_note is not null and not p_prerequisite_confirmed then
    raise exception 'prerequisite not confirmed';
  end if;

  -- Already enrolled: nobody needs the same course twice, and a second
  -- subscription means a second monthly debit. Seit PROJ-50 über die
  -- gemeinsame Antwort.
  if exists (
    select 1 from course_members
    where customer_id = v_customer_id and course_id = p_course_id
  ) then
    raise exception 'already enrolled';
  end if;

  -- Lock the course row so concurrent requests for the same course are
  -- serialized around the capacity check + role-balance check + insert below.
  select max_participants, role_query_enabled, max_role_difference
    into v_max, v_role_enabled, v_max_diff
    from courses where id = p_course_id for update;

  if v_max is not null and kurs_belegung(p_course_id) >= v_max then
    raise exception 'course is full';
  end if;

  if v_role_enabled and v_max_diff is not null and p_dance_role in ('leader', 'follower') then
    v_leader_count := kurs_rollenanzahl(p_course_id, 'leader');
    v_follower_count := kurs_rollenanzahl(p_course_id, 'follower');

    if p_dance_role = 'leader' and (v_leader_count + 1) - v_follower_count > v_max_diff then
      raise exception 'role imbalance';
    elsif p_dance_role = 'follower' and (v_follower_count + 1) - v_leader_count > v_max_diff then
      raise exception 'role imbalance';
    end if;
  end if;

  if exists (
    select 1 from course_bookings
    where course_id = p_course_id and customer_id = v_customer_id and type = 'regular' and status = 'open'
  ) then
    raise exception 'already requested';
  end if;

  -- PROJ-15: attach a coupon only if it currently looks valid — the real,
  -- atomic redemption still happens later at confirm time.
  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select id into v_coupon_id
    from coupons
    where upper(code) = upper(trim(p_coupon_code))
      and active
      and (expires_at is null or expires_at >= public.heute_wien())
      and redemption_count < max_redemptions
    limit 1;

    if v_coupon_id is not null and exists (select 1 from subscriptions where customer_id = v_customer_id) then
      v_coupon_id := null;
    end if;

    -- PROJ-44: War es kein Gutschein, kann es ein Empfehlungscode sein.
    if v_coupon_id is null then
      select id into v_referrer_id
      from profiles
      where upper(referral_code) = upper(trim(p_coupon_code))
        and role = 'customer'
      limit 1;

      if v_referrer_id is not null
         and v_referrer_id <> v_customer_id
         and not exists (select 1 from subscriptions where customer_id = v_customer_id)
      then
        update profiles
        set referred_by = v_referrer_id
        where id = v_customer_id and referred_by is null;
      end if;
    end if;
  end if;

  -- PROJ-41: nicht der vom Client geschickte Betrag, sondern der selbst
  -- ermittelte.
  v_price := resolve_plan_price(p_course_id, p_desired_plan, coalesce(p_wants_student_price, false));

  insert into course_bookings (
    customer_id, course_id, type, status, desired_plan, chosen_date, note, dance_role, coupon_id,
    price, wants_student_price, terms_accepted_at, terms_version
  )
  values (
    v_customer_id, p_course_id, 'regular', 'open', p_desired_plan, p_chosen_date,
    nullif(p_note, ''), nullif(p_dance_role, ''), v_coupon_id,
    v_price, coalesce(p_wants_student_price, false), now(), p_terms_version
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.join_waitlist(
  p_course_id uuid,
  p_desired_plan text,
  p_chosen_date date,
  p_dance_role text default null,
  p_terms_accepted boolean default false,
  p_terms_version text default null
)
returns waitlist_entries
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_customer_id uuid := auth.uid();
  v_max int;
  v_role_enabled boolean;
  v_max_diff int;
  v_leader_count int;
  v_follower_count int;
  v_role_blocked boolean := false;
  v_row waitlist_entries;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  if not coalesce(p_terms_accepted, false) then
    raise exception 'terms not accepted';
  end if;
  perform assert_valid_terms_version(p_terms_version);

  perform require_dance_role(p_course_id, p_dance_role);

  -- Ein Flatrate-Kunde braucht kein Mandat: Die Zahlungspflicht besteht schon,
  -- es entsteht keine neue. Für alle anderen bleibt die Regel.
  if aktive_flatrate(v_customer_id) is null and not exists (
    select 1 from sepa_mandates where customer_id = v_customer_id and revoked_at is null
  ) then
    raise exception 'mandate required';
  end if;

  select max_participants, role_query_enabled, max_role_difference
    into v_max, v_role_enabled, v_max_diff
    from courses where id = p_course_id;

  if v_role_enabled and v_max_diff is not null and p_dance_role in ('leader', 'follower') then
    v_leader_count := kurs_rollenanzahl(p_course_id, 'leader');
    v_follower_count := kurs_rollenanzahl(p_course_id, 'follower');

    if p_dance_role = 'leader' and (v_leader_count + 1) - v_follower_count > v_max_diff then
      v_role_blocked := true;
    elsif p_dance_role = 'follower' and (v_follower_count + 1) - v_leader_count > v_max_diff then
      v_role_blocked := true;
    end if;
  end if;

  if not v_role_blocked and (v_max is null or kurs_belegung(p_course_id) < v_max) then
    raise exception 'course is not full';
  end if;

  if exists (
    select 1 from course_members
    where course_id = p_course_id and customer_id = v_customer_id
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

  insert into waitlist_entries (
    course_id, customer_id, desired_plan, chosen_date, dance_role, terms_accepted_at, terms_version
  )
  values (
    p_course_id, v_customer_id, p_desired_plan, p_chosen_date, nullif(p_dance_role, ''), now(), p_terms_version
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.get_course_occupancy() from public, anon;
revoke all on function public.get_course_attendance_roster(uuid, date) from public, anon;
revoke all on function public.self_toggle_attendance(uuid) from public, anon;
revoke all on function public.get_course_active_subscribers(uuid[]) from public, anon;
revoke all on function public.get_course_participants(uuid[]) from public, anon;
revoke all on function public.get_course_dance_roles(uuid[]) from public, anon;
revoke all on function public.get_course_member_ids(uuid) from public, anon;
revoke all on function public.create_regular_course_booking(uuid, text, date, text, boolean, text, text, boolean, boolean, text) from public, anon;
revoke all on function public.join_waitlist(uuid, text, date, text, boolean, text) from public, anon;

grant execute on function public.get_course_occupancy() to authenticated, anon;
grant execute on function public.get_course_attendance_roster(uuid, date) to authenticated;
grant execute on function public.self_toggle_attendance(uuid) to authenticated;
grant execute on function public.get_course_active_subscribers(uuid[]) to authenticated;
grant execute on function public.get_course_participants(uuid[]) to authenticated;
grant execute on function public.get_course_dance_roles(uuid[]) to authenticated;
grant execute on function public.get_course_member_ids(uuid) to authenticated;
grant execute on function public.create_regular_course_booking(uuid, text, date, text, boolean, text, text, boolean, boolean, text) to authenticated;
grant execute on function public.join_waitlist(uuid, text, date, text, boolean, text) to authenticated;
