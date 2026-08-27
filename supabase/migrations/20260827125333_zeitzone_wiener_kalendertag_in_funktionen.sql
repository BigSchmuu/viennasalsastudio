-- Zeitzone: current_date in Datenbankfunktionen auf Wiener Kalendertag umstellen.
--
-- Die Datenbank laeuft in UTC (current_setting('TimeZone') = 'UTC'). current_date
-- ist damit zwischen Mitternacht und 01:00/02:00 Wiener Zeit noch der Vortag.
-- Jede Frage nach "welcher Tag ist heute" ist im Studio aber eine Frage nach dem
-- Wiener Kalendertag - dieselbe Entscheidung wie in src/lib/constants/zeitzone.ts
-- auf der Anwendungsseite (STUDIO_TIMEZONE / heuteInWien).

create or replace function public.heute_wien()
returns date
language sql
stable
set search_path to ''
as $function$
  select (now() at time zone 'Europe/Vienna')::date;
$function$;

comment on function public.heute_wien() is
  'Heutiger Kalendertag in Europe/Vienna. Gegenstueck zu heuteInWien() in src/lib/constants/zeitzone.ts. Statt current_date verwenden - die Datenbank laeuft in UTC.';

grant execute on function public.heute_wien() to anon, authenticated, service_role;

-- 1) assert_valid_terms_version: Monatsvergleich der AGB-Version.
-- Zusaetzlich immutable -> stable: die Funktion las schon vorher die Uhr, war
-- also nie immutable. Als immutable darf Postgres den Aufruf wegfalten, was die
-- Pruefung stillschweigend einfrieren wuerde.
create or replace function public.assert_valid_terms_version(p_version text)
returns text
language plpgsql
stable
as $function$
declare
  v_version text := trim(coalesce(p_version, ''));
begin
  if v_version = '' then
    raise exception 'terms version missing';
  end if;
  if v_version !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'terms version invalid';
  end if;
  if v_version > to_char(public.heute_wien(), 'YYYY-MM') then
    raise exception 'terms version invalid';
  end if;
  if v_version < '2026-01' then
    raise exception 'terms version invalid';
  end if;
  return v_version;
end;
$function$;

-- 2) cancel_event_ticket: Stornofrist. Hier waren zwei Seiten falsch - neben
-- current_date auch starts_at::date, das den timestamptz ebenfalls in UTC
-- umrechnet. Ein Event am 1.9. um 00:30 Wiener Zeit ist in UTC noch der 31.8.,
-- die Frist haette also einen Tag zu spaet gegriffen.
create or replace function public.cancel_event_ticket(p_ticket_id uuid)
returns tickets
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := auth.uid();
  v_ticket_customer_id uuid;
  v_status text;
  v_starts_at timestamptz;
  v_row tickets;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  select t.customer_id, t.status, e.starts_at
    into v_ticket_customer_id, v_status, v_starts_at
  from tickets t
  join events e on e.id = t.event_id
  where t.id = p_ticket_id;

  if v_ticket_customer_id is null then
    raise exception 'ticket not found';
  end if;
  if v_ticket_customer_id <> v_customer_id then
    raise exception 'not your ticket';
  end if;
  if v_status not in ('reserved', 'confirmed') then
    raise exception 'ticket not cancellable';
  end if;
  -- Lead-time policy: TICKET_CANCELLATION_LEAD_DAYS (currently 1) in
  -- src/lib/constants/events.ts — kept as a calendar-date comparison to
  -- mirror the app's own daysUntil() semantics as closely as SQL allows.
  -- Beide Seiten als Wiener Kalendertag, so wie daysUntil() es tut.
  if (((v_starts_at at time zone 'Europe/Vienna')::date) - public.heute_wien()) < 1 then
    raise exception 'cancellation deadline passed';
  end if;

  update tickets
  set status = 'cancelled'
  where id = p_ticket_id
  returning * into v_row;

  return v_row;
end;
$function$;

-- 5) get_my_todays_attendance: "heute" im Sinne des Studios.
create or replace function public.get_my_todays_attendance()
returns table(course_id uuid, status text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select ca.course_id, ca.status
  from course_attendance ca
  where ca.customer_id = auth.uid() and ca.occurrence_date = public.heute_wien();
$function$;

-- 7) next_cycle_end: 28-Tage-Zyklus ab Anker.
create or replace function public.next_cycle_end(p_anchor date)
returns date
language sql
stable
set search_path to 'public'
as $function$
  select p_anchor + (greatest(1, floor((public.heute_wien() - p_anchor)::numeric / 28)::int + 1) * 28);
$function$;

-- Zyklusanker eines neuen Abos: ein um 00:30 Wiener Zeit angelegtes Abo bekam
-- den Vortag als Anker und damit einen um einen Tag verschobenen Abrechnungslauf.
alter table public.subscriptions alter column cycle_anchor_date set default public.heute_wien();
-- 3) check_coupon_code: Ablaufdatum des Gutscheins.
create or replace function public.check_coupon_code(p_code text)
returns table(valid boolean, code_kind text, discount_type text, discount_amount numeric, rate_limited boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := auth.uid();
  v_coupon coupons;
  v_recent_attempts int;
  v_referrer_id uuid;
  v_referee_reward numeric;
  v_has_subscription boolean;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  -- Opportunistic cleanup so this table can't grow unbounded.
  delete from coupon_check_attempts where attempted_at < now() - interval '1 day';

  select count(*) into v_recent_attempts
  from coupon_check_attempts
  where customer_id = v_customer_id
    and attempted_at > now() - interval '15 minutes';

  -- Generous for a real customer fixing a typo, prohibitive for enumeration.
  -- Gilt jetzt auch fuer Empfehlungscodes -- die sind genau das, was jemand
  -- durchprobieren wuerde, um sich Guthaben zu verschaffen.
  if v_recent_attempts >= 10 then
    return query select false, null::text, null::text, null::numeric, true;
    return;
  end if;

  insert into coupon_check_attempts (customer_id) values (v_customer_id);

  select exists (select 1 from subscriptions where customer_id = v_customer_id)
    into v_has_subscription;

  select * into v_coupon
  from coupons
  where upper(code) = upper(trim(p_code))
    and active
    and (expires_at is null or expires_at >= public.heute_wien())
    and redemption_count < max_redemptions
  limit 1;

  if v_coupon.id is not null then
    if v_has_subscription then
      return query select false, null::text, null::text, null::numeric, false;
    else
      return query select true, 'coupon'::text, v_coupon.discount_type, v_coupon.discount_amount, false;
    end if;
    return;
  end if;

  -- Kein Gutschein -- dann vielleicht ein Empfehlungscode.
  select id into v_referrer_id
  from profiles
  where upper(referral_code) = upper(trim(p_code))
    and role = 'customer'
  limit 1;

  select referral_reward_referee into v_referee_reward from dropin_pricing limit 1;

  -- Der eigene Code zaehlt nicht, ein Bestandskunde bekommt nichts, und wer
  -- bereits jemandem zugeordnet ist, wird nicht neu zugeordnet. Alle drei
  -- Faelle sehen fuer den Kunden gleich aus: der Code wird nicht anerkannt.
  if v_referrer_id is null
     or v_referrer_id = v_customer_id
     or v_has_subscription
     or coalesce(v_referee_reward, 0) <= 0
     or exists (select 1 from profiles where id = v_customer_id and referred_by is not null)
  then
    return query select false, null::text, null::text, null::numeric, false;
  else
    return query select true, 'referral'::text, null::text, v_referee_reward, false;
  end if;
end;
$function$;

-- 6) grant_pending_referral_rewards: "die erste Lastschrift liegt in der
-- Vergangenheit". Am Faelligkeitstag selbst darf noch nicht belohnt werden.
create or replace function public.grant_pending_referral_rewards()
returns table(referrer_id uuid, referee_id uuid, referrer_amount numeric, referee_amount numeric, referrer_balance numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_referrer_reward numeric;
  v_referee_reward numeric;
  v_fall record;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  select referral_reward_referrer, referral_reward_referee
    into v_referrer_reward, v_referee_reward
    from dropin_pricing limit 1;

  v_referrer_reward := coalesce(v_referrer_reward, 0);
  v_referee_reward := coalesce(v_referee_reward, 0);

  -- Beide Betraege auf 0 heisst: das Programm ist aus. Dann wird auch nichts
  -- als belohnt markiert -- wer es spaeter wieder einschaltet, soll die
  -- wartenden Faelle noch vorfinden.
  if v_referrer_reward <= 0 and v_referee_reward <= 0 then
    return;
  end if;

  for v_fall in
    update profiles p
    set referral_rewarded_at = now()
    where p.referred_by is not null
      and p.referral_rewarded_at is null
      and coalesce(
        (
          select i.bounced_at is null and i.amount > 0
          from sepa_collection_items i
          join sepa_collection_runs r on r.id = i.run_id
          where i.customer_id = p.id
            and i.subscription_id is not null
            and r.due_date < public.heute_wien()
          order by r.due_date, i.created_at
          limit 1
        ),
        false
      )
    returning p.id as referee, p.referred_by as referrer
  loop
    if v_referrer_reward > 0 then
      insert into customer_credits (customer_id, amount, origin)
      values (v_fall.referrer, v_referrer_reward, 'referral');
    end if;

    if v_referee_reward > 0 then
      insert into customer_credits (customer_id, amount, origin)
      values (v_fall.referee, v_referee_reward, 'referral');
    end if;

    referrer_id := v_fall.referrer;
    referee_id := v_fall.referee;
    referrer_amount := v_referrer_reward;
    referee_amount := v_referee_reward;
    referrer_balance := customer_credit_balance(v_fall.referrer);
    return next;
  end loop;
end;
$function$;

-- 8) redeem_coupon_for_booking: Ablaufdatum beim Einloesen.
create or replace function public.redeem_coupon_for_booking(p_booking_id uuid)
returns table(discount_type text, discount_amount numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_coupon_id uuid;
  v_customer_id uuid;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  select coupon_id, customer_id into v_coupon_id, v_customer_id
  from course_bookings where id = p_booking_id;

  if v_coupon_id is null then
    return;
  end if;

  -- Re-check eligibility fresh at confirm time (not just at request time) —
  -- called before the subscription is inserted, so this still correctly
  -- sees "no subscription yet" for a genuinely-first-time customer.
  if exists (select 1 from subscriptions where customer_id = v_customer_id) then
    return;
  end if;

  return query
  update coupons
  set redemption_count = redemption_count + 1
  where id = v_coupon_id
    and active
    and (expires_at is null or expires_at >= public.heute_wien())
    and redemption_count < max_redemptions
  returning coupons.discount_type, coupons.discount_amount;
end;
$function$;
-- 9) self_toggle_attendance: der Kurstag. Das Zeitfenster selbst rechnete schon
-- richtig in Wiener Zeit - nur der Tag, auf den es sich bezieht, kam aus UTC.
create or replace function public.self_toggle_attendance(p_course_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := auth.uid();
  v_occurrence_date date := public.heute_wien();
  v_weekday int;
  v_start_time time;
  v_end_time time;
  v_is_paused boolean;
  v_has_active_sub boolean;
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

  select exists (
    select 1 from subscriptions
    where course_id = p_course_id and customer_id = v_customer_id and status = 'active'
  ) into v_has_active_sub;
  if not v_has_active_sub then
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
$function$;
-- 4) create_regular_course_booking: Ablaufdatum des Gutscheins beim Buchen.
--
-- Diese Funktion ist rund 180 Zeilen Buchungslogik. Sie hier vollstaendig
-- auszuschreiben hiesse, sie abzuschreiben - jedes Zeichen davon eine
-- Gelegenheit fuer einen stillen Fehler in Preis-, Kapazitaets- und
-- Rollenlogik. Stattdessen wird die bestehende Definition gelesen und genau
-- ein Ausdruck ersetzt. Kommt er nicht genau einmal vor, bricht die Migration
-- ab, statt etwas Halbes zu hinterlassen.
do $migration$
declare
  v_def text;
  v_treffer int;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_regular_course_booking';

  if v_def is null then
    raise exception 'create_regular_course_booking nicht gefunden';
  end if;

  v_treffer := (length(v_def) - length(replace(v_def, 'expires_at >= current_date', ''))) / length('expires_at >= current_date');
  if v_treffer <> 1 then
    raise exception 'erwartet: genau ein Vorkommen von "expires_at >= current_date", gefunden: %', v_treffer;
  end if;

  v_def := replace(v_def, 'expires_at >= current_date', 'expires_at >= public.heute_wien()');
  execute v_def;
end;
$migration$;
