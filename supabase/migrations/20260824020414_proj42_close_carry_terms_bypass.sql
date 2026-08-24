-- PROJ-42 Sicherheitsfix: p_carry_terms_from war eine Hintertuer.
--
-- Gedacht war er fuers Umbuchen: dort entsteht keine neue Verpflichtung, also
-- sollte die Zustimmung der Ursprungsbuchung mitwandern. Zeigte der Parameter
-- aber auf eine fremde oder erfundene Buchung, lieferte das SELECT keine Zeile,
-- die Variablen blieben NULL — und die Buchung entstand ganz ohne Zustimmung.
-- Der Aufruf war fuer jeden eingeloggten Kunden frei zugaenglich.
--
-- Geflickt haette man die fremde Kennung; offen geblieben waere, dass jeder mit
-- einer eigenen Altbuchung ohne Zustimmung beliebig viele weitere ohne
-- Zustimmung erzeugen kann. In einem Feature, dessen einziger Zweck die
-- Nachweisbarkeit ist, ist eine schmale Luecke immer noch eine Luecke.
--
-- Deshalb faellt der Sonderweg ganz weg: Auch beim Umbuchen wird zugestimmt.
-- Das kostet ein Haekchen in einem selten benutzten Dialog und macht die Regel
-- ausnahmslos — jede Buchung traegt ihre eigene Zustimmung.
drop function if exists public.create_self_service_booking(uuid, text, date, boolean, boolean, boolean, text, uuid);

create or replace function public.create_self_service_booking(
  p_course_id uuid,
  p_type text,
  p_chosen_date date,
  p_wants_student_price boolean default false,
  p_prerequisite_confirmed boolean default false,
  p_terms_accepted boolean default false,
  p_terms_version text default null
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
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  if not coalesce(p_terms_accepted, false) then
    raise exception 'terms not accepted';
  end if;
  if p_terms_version is null or trim(p_terms_version) = '' then
    raise exception 'terms version missing';
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
    now(),
    p_terms_version
  )
  returning * into v_row;

  return v_row;
end;
$function$;
