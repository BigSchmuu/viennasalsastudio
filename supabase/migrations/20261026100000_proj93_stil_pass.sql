-- PROJ-93: Ein Pass fuer eine Stilrichtung.
--
-- Der Betreiber moechte einen Bachata-Pass: ein Monatsbeitrag fuer alle
-- Bachata-Kurse, sichtbar nur dort. Technisch ist die Flatrate heute "ein Abo
-- ohne Kurs" (`subscriptions.course_id is null`). Der Pass ist dasselbe mit
-- einer Stilgrenze -- ein Abo ohne Kurs, aber **mit** Stilrichtung.
--
-- Damit bleibt es ein Produktweg durch die Anwendung: Lastschriftzyklus,
-- Kuendigung, Pause, Kursplaetze, Self-Check-in und Anwesenheitsliste haengen
-- am Abo und am Platz, nicht an der Frage "alle Kurse oder einer". Sie bleiben
-- unberuehrt.
--
-- Was sich aendert, ist eine Annahme, die quer durch die Anwendung lief:
-- **"Wer eine Flatrate hat, hat alles."** Sie wird zur Frage: deckt das Abo
-- *diesen* Kurs? Dafuer `deckt_abo_kurs()`.
--
-- `course_members` bleibt bewusst unangetastet: Die Sicht liest **bestehende**
-- Kursplaetze. Der Pass beschraenkt, welche Plaetze entstehen duerfen -- nicht,
-- wie sie gelesen werden.

-- 1. Der Preis am Stil entscheidet, ob es den Pass gibt.
alter table public.dance_styles
  add column if not exists pass_price numeric,
  add column if not exists pass_student_price numeric;

alter table public.dance_styles
  drop constraint if exists dance_styles_pass_price_positiv;
alter table public.dance_styles
  add constraint dance_styles_pass_price_positiv
  check (
    (pass_price is null or pass_price > 0)
    and (pass_student_price is null or pass_student_price > 0)
  );

comment on column public.dance_styles.pass_price is
  'PROJ-93: Monatsbeitrag fuer einen Pass ueber diese Stilrichtung. NULL heisst: diesen Pass gibt es nicht.';
comment on column public.dance_styles.pass_student_price is
  'PROJ-93: Ermaessigter Passpreis. NULL heisst: es gilt der normale (eine fehlende Ermaessigung darf nicht zu "kein Preis" werden).';

-- 2. Das kurslose Abo bekommt seine Grenze.
alter table public.subscriptions
  add column if not exists dance_style_id uuid references public.dance_styles(id);

comment on column public.subscriptions.dance_style_id is
  'PROJ-93: Nur bei kurslosen Abos belegt. Gesetzt = Pass fuer diese Stilrichtung, NULL = volle Flatrate.';

-- 3. Die dritte Tarifwahl. Die Spalte hat eine CHECK-Liste -- ohne diese
--    Erweiterung scheitert das Einfuegen (dieselbe Falle wie bei
--    notification_queue.event_type in PROJ-14/87).
alter table public.course_bookings
  drop constraint if exists course_bookings_desired_plan_check;
alter table public.course_bookings
  add constraint course_bookings_desired_plan_check
  check (desired_plan is null or desired_plan in ('single_course', 'flatrate', 'style_pass'));

-- 4. Deckt ein kursloses Abo **diesen** Kurs?
--
-- Die Frage, die die Buchungssperre und das Hinzufügen wirklich stellen.
-- `aktive_flatrate()` bleibt daneben bestehen und beantwortet weiterhin "hat
-- ueberhaupt ein kursloses Abo" -- das ist die richtige Frage fuer die
-- Upgrade-Sperre (PROJ-87) und die Preisanzeige.
--
-- Ein Kurs ohne Stilrichtung wird von keinem Pass gedeckt, auch nicht
-- versehentlich: `c.dance_style_id = s.dance_style_id` ist mit NULL niemals
-- wahr.
create or replace function public.deckt_abo_kurs(p_customer_id uuid, p_course_id uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select s.id
  from subscriptions s
  left join courses c on c.id = p_course_id
  where s.customer_id = p_customer_id
    and s.course_id is null
    and s.status = 'active'
    and (s.dance_style_id is null or s.dance_style_id = c.dance_style_id)
  order by s.created_at asc
  limit 1;
$$;

comment on function public.deckt_abo_kurs(uuid, uuid) is
  'PROJ-93: Welches kurslose Abo deckt diesen Kurs -- die volle Flatrate jeden, ein Pass nur Kurse seiner Stilrichtung. NULL = keines.';

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
  v_style_id uuid;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  -- PROJ-50: Wer pauschal zahlt, bucht nicht mehr — er trägt sich ein.
  -- PROJ-93: Nicht mehr "hat eine Flatrate", sondern "ist dieser Kurs
  -- gedeckt". Ein Bachata-Pass deckt Salsa nicht -- und darf den Kunden
  -- deshalb auch nicht aus dem Salsa-Kurs aussperren.
  if deckt_abo_kurs(v_customer_id, p_course_id) is not null then
    raise exception 'flatrate covers this';
  end if;

  -- PROJ-93: Ein Pass braucht eine Stilrichtung mit Preis, und es gibt
  -- hoechstens ein kursloses Abo je Kunde (Pass oder Flatrate, nicht beides).
  if p_desired_plan = 'style_pass' then
    select c.dance_style_id into v_style_id from courses c where c.id = p_course_id;
    if v_style_id is null then
      raise exception 'course has no dance style';
    end if;
    if (select s.pass_price from dance_styles s where s.id = v_style_id) is null then
      raise exception 'no pass for this style';
    end if;
  end if;

  if p_desired_plan in ('style_pass', 'flatrate')
     and exists (
       select 1 from subscriptions
       where customer_id = v_customer_id and course_id is null and status = 'active'
     )
  then
    raise exception 'already has open plan';
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

  -- PROJ-93: Das kurslose Abo muss **diesen** Kurs decken. Zwei
  -- unterscheidbare Fehler, damit die Oberflaeche den Unterschied erklaeren
  -- kann: gar kein Pass, oder ein Pass fuer eine andere Stilrichtung.
  v_subscription_id := deckt_abo_kurs(v_customer_id, p_course_id);
  if v_subscription_id is null then
    if aktive_flatrate(v_customer_id) is null then
      raise exception 'no flatrate';
    end if;
    raise exception 'pass does not cover';
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

create or replace function public.resolve_plan_price(
  p_course_id uuid,
  p_desired_plan text,
  p_wants_student_price boolean default false
)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_course_price numeric;
  v_std_course numeric;
  v_std_course_student numeric;
  v_std_flatrate numeric;
  v_std_flatrate_student numeric;
  v_pass numeric;
  v_pass_student numeric;
begin
  select price into v_course_price from courses where id = p_course_id;

  select course_price, course_student_price, flatrate_price, flatrate_student_price
    into v_std_course, v_std_course_student, v_std_flatrate, v_std_flatrate_student
    from dropin_pricing limit 1;

  -- PROJ-93: Der Passpreis haengt an der Stilrichtung des Kurses. Kein Preis
  -- dort heisst "diesen Pass gibt es nicht" -- dann kommt null zurueck, und
  -- die Kachel erscheint gar nicht.
  if p_desired_plan = 'style_pass' then
    select s.pass_price, s.pass_student_price
      into v_pass, v_pass_student
      from dance_styles s
      join courses c on c.dance_style_id = s.id
     where c.id = p_course_id;

    if p_wants_student_price then
      return coalesce(v_pass_student, v_pass);
    end if;
    return v_pass;
  end if;

  if p_desired_plan = 'flatrate' then
    -- Fehlt der ermaessigte Satz, gilt der normale: eine fehlende Ermaessigung
    -- darf nicht dazu fuehren, dass gar kein Preis zustande kommt.
    if p_wants_student_price then
      return coalesce(v_std_flatrate_student, v_std_flatrate);
    end if;
    return v_std_flatrate;
  end if;

  -- Der Kurs-Einzelpreis gilt nur fuer den Normalpreis. Ein abweichender
  -- Kurspreis ist eine Aussage ueber diesen Kurs, keine ueber die Ermaessigung.
  if p_wants_student_price then
    return coalesce(v_std_course_student, v_std_course, v_course_price);
  end if;
  return coalesce(v_course_price, v_std_course);
end;
$$;

-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.deckt_abo_kurs(uuid, uuid) from public, anon;
revoke all on function public.resolve_plan_price(uuid, text, boolean) from public, anon;
revoke all on function public.add_course_to_flatrate(uuid, text, boolean) from public, anon;
revoke all on function public.create_regular_course_booking(uuid, text, date, text, boolean, text, text, boolean, boolean, text) from public, anon;

grant execute on function public.deckt_abo_kurs(uuid, uuid) to authenticated;
grant execute on function public.resolve_plan_price(uuid, text, boolean) to authenticated;
grant execute on function public.add_course_to_flatrate(uuid, text, boolean) to authenticated;
grant execute on function public.create_regular_course_booking(uuid, text, date, text, boolean, text, text, boolean, boolean, text) to authenticated;
