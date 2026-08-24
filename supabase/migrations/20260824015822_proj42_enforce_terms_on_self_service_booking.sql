-- PROJ-42: Ohne Zustimmung entsteht keine Buchung. Das Haekchen im Browser ist
-- eine Behauptung des Browsers; hier wird sie zur Bedingung.
--
-- Der AGB-Stand kommt als Parameter, aber nicht vom Kunden: die Server Action
-- setzt ihn aus AGB_VERSION (src/lib/legal.ts) ein. Der Browser schickt nur,
-- ob zugestimmt wurde — das ist seine Handlung, alles andere waere faelschbar.
--
-- ACHTUNG: p_carry_terms_from wird von der spaeteren Migration
-- 20260824020414_proj42_close_carry_terms_bypass wieder entfernt. Er war eine
-- Hintertuer; siehe dort.
--
-- Alte Signatur ausdruecklich entfernen: create or replace mit zusaetzlichen
-- Parametern legt eine Ueberladung an statt zu ersetzen (Lehre aus PROJ-15).
drop function if exists public.create_self_service_booking(uuid, text, date, boolean, boolean);

create or replace function public.create_self_service_booking(
  p_course_id uuid,
  p_type text,
  p_chosen_date date,
  p_wants_student_price boolean default false,
  p_prerequisite_confirmed boolean default false,
  p_terms_accepted boolean default false,
  p_terms_version text default null,
  p_carry_terms_from uuid default null
)
returns course_bookings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := auth.uid();
  v_prerequisite_note text;
  v_status text;
  v_price numeric;
  v_recent int;
  v_row course_bookings;
  v_terms_at timestamptz;
  v_terms_version text;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  if p_carry_terms_from is not null then
    -- Nur aus einer eigenen Buchung uebernehmen. Ohne diese Bedingung koennte
    -- jemand die Zustimmung eines fremden Kunden auf sich buchen.
    select terms_accepted_at, terms_version
      into v_terms_at, v_terms_version
      from course_bookings
      where id = p_carry_terms_from and customer_id = v_customer_id;
    -- Bleibt leer, wenn die Ursprungsbuchung von vor der Einfuehrung stammt.
    -- Das ist gewollt: Umbuchen darf daran nicht scheitern, denn es entsteht
    -- keine neue Verpflichtung.
  else
    if not coalesce(p_terms_accepted, false) then
      raise exception 'terms not accepted';
    end if;
    if p_terms_version is null or trim(p_terms_version) = '' then
      raise exception 'terms version missing';
    end if;
    v_terms_at := now();
    v_terms_version := p_terms_version;
  end if;

  if p_type not in ('trial', 'dropin') then
    raise exception 'invalid type';
  end if;

  select prerequisite_note into v_prerequisite_note from courses where id = p_course_id;
  if v_prerequisite_note is not null and not p_prerequisite_confirmed then
    raise exception 'prerequisite not confirmed';
  end if;

  -- Same customer, same course, same date, same type, still active: that is a
  -- duplicate, never a legitimate second booking. Cancelled and rejected ones
  -- are deliberately excluded so a customer can rebook after cancelling.
  if exists (
    select 1 from course_bookings
    where customer_id = v_customer_id
      and course_id = p_course_id
      and type = p_type
      and chosen_date = p_chosen_date
      and status in ('open', 'confirmed')
  ) then
    raise exception 'already booked';
  end if;

  -- Second layer: the duplicate check alone would not stop a flood, because an
  -- attacker can simply vary course and date. Cancelled bookings still count
  -- towards the budget — otherwise cancelling would reset it and the limit
  -- could be sidestepped entirely.
  select count(*) into v_recent
  from course_bookings
  where customer_id = v_customer_id
    and type in ('trial', 'dropin')
    and created_at > now() - interval '1 hour';

  if v_recent >= 10 then
    raise exception 'booking rate limit';
  end if;

  v_status := case when p_type = 'trial' then 'confirmed' else 'open' end;

  if p_type = 'dropin' then
    select case when p_wants_student_price then student_price else normal_price end
    into v_price
    from dropin_pricing
    limit 1;
  end if;

  insert into course_bookings (
    customer_id, course_id, type, status, chosen_date, wants_student_price, price,
    terms_accepted_at, terms_version
  )
  values (
    v_customer_id,
    p_course_id,
    p_type,
    v_status,
    p_chosen_date,
    case when p_type = 'dropin' then p_wants_student_price else null end,
    v_price,
    v_terms_at,
    v_terms_version
  )
  returning * into v_row;

  return v_row;
end;
$function$;
