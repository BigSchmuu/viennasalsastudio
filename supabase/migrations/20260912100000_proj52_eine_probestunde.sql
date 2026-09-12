-- PROJ-52: Eine Probestunde je Kunde.
--
-- Bisher war die Probestunde unbegrenzt: ein Kunde konnte in jedem Kurs an
-- jedem Termin eine buchen. Geprüft wurde nur die Doppelbuchung desselben
-- Termins und die Missbrauchsbremse aus PROJ-39 (zehn Selbstbuchungen je
-- Stunde). Wer wollte, konnte wochenlang gratis tanzen.
--
-- Die Regel steht hier und nicht nur in der Oberfläche: Genau dieser Weg war
-- bei PROJ-39 der Missbrauchspfad — der Aufruf kam an der Oberfläche vorbei.
--
-- „Verbraucht" heißt: Der Termin liegt in der Vergangenheit. Eine stornierte
-- oder abgelehnte Probestunde zählt nicht (Entscheidung des Betreibers): Eine
-- Erkältung darf die Probestunde nicht kosten. Nebeneffekt, bewusst
-- mitgenommen: Der Betreiber gibt eine Probestunde frei, indem er die Buchung
-- storniert — dafür braucht es keinen eigenen Knopf.

-- Die Signatur bekommt `p_dance_role` — deshalb erst weg mit der alten.
-- `create or replace` würde eine zweite Überladung anlegen statt sie zu
-- ersetzen, und der Aufruf mit benannten Argumenten wäre dann mehrdeutig
-- (Lehre aus PROJ-15).
drop function if exists public.create_self_service_booking(uuid, text, date, boolean, boolean, boolean, text);

create or replace function public.create_self_service_booking(
  p_course_id uuid,
  p_type text,
  p_chosen_date date,
  p_wants_student_price boolean default false,
  p_prerequisite_confirmed boolean default false,
  p_terms_accepted boolean default false,
  p_terms_version text default null,
  p_dance_role text default ''
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
  v_offene_probestunde date;
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

  -- PROJ-52: Eine Probestunde je Kunde. Die beiden Fälle werden unterschieden,
  -- weil die Oberfläche daraus zwei verschiedene Sätze macht: „verbraucht" ist
  -- endgültig, „schon gebucht" führt zum Umbuchen.
  --
  -- `heute_wien()` statt `current_date`: Die Datenbank läuft in UTC, und eine
  -- Probestunde von gestern Abend wäre dort um Mitternacht noch von heute.
  if p_type = 'trial' then
    select max(chosen_date) into v_offene_probestunde
    from course_bookings
    where customer_id = v_customer_id
      and type = 'trial'
      and status in ('open', 'confirmed');

    if v_offene_probestunde is not null then
      if v_offene_probestunde < public.heute_wien() then
        raise exception 'trial already used';
      else
        raise exception 'trial already booked';
      end if;
    end if;
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

  -- Die Tanzrolle wird jetzt auch bei Probestunde und Drop-in festgehalten.
  --
  -- Vorher verlangte der Dialog sie und warf sie weg: Gespeichert wurde sie nur
  -- bei der regulären Anmeldung. Für den Lehrer ist sie aber gerade beim Gast
  -- interessant — die Anwesenheitsliste und die Rollenbalance lesen sie
  -- (PROJ-49, PROJ-50).
  insert into course_bookings (
    customer_id, course_id, type, status, chosen_date, wants_student_price, price,
    terms_accepted_at, terms_version, dance_role
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
    p_terms_version,
    nullif(trim(coalesce(p_dance_role, '')), '')
  )
  returning * into v_row;

  return v_row;
end;
$function$;

-- `create or replace function` setzt die Rechte zurück, und die
-- Standardvorgaben von Supabase geben `anon` wieder ein Ausführungsrecht.
revoke all on function public.create_self_service_booking(uuid, text, date, boolean, boolean, boolean, text, text)
  from public, anon;
grant execute on function public.create_self_service_booking(uuid, text, date, boolean, boolean, boolean, text, text)
  to authenticated;

-- Umbuchen als **ein** Vorgang.
--
-- Bisher lief es in zwei Schritten: neue Buchung anlegen, dann die alte
-- stornieren. Mit der Regel von oben hätte sich das selbst blockiert — beim
-- Einfügen ist die alte Probestunde ja noch aktiv. Und schon vorher steckte
-- darin ein Fehler: Schlug der zweite Schritt fehl, hatte der Kunde zwei
-- Buchungen.
--
-- In einer Funktion ist beides eine Transaktion. Erst stornieren, dann
-- einfügen: Scheitert das Einfügen, ist die Stornierung mit zurückgenommen,
-- und der Kunde behält seine ursprüngliche Probestunde. Nie beides, nie
-- keines.
create or replace function public.rebook_self_service_booking(
  p_booking_id uuid,
  p_course_id uuid,
  p_chosen_date date,
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
  v_alt course_bookings;
  v_neu course_bookings;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  -- Die eigene Buchung, gesperrt: Zwei gleichzeitige Umbuchungen derselben
  -- Buchung würden sonst zwei neue erzeugen.
  select * into v_alt
  from course_bookings
  where id = p_booking_id and customer_id = v_customer_id
  for update;

  if v_alt is null then
    raise exception 'booking not found';
  end if;
  if v_alt.type not in ('trial', 'dropin') then
    raise exception 'not rebookable';
  end if;
  if v_alt.status not in ('open', 'confirmed') then
    raise exception 'booking not active';
  end if;

  update course_bookings set status = 'cancelled' where id = v_alt.id;

  -- Dieselbe Funktion wie beim ersten Buchen, mit allen ihren Prüfungen: Eine
  -- zweite Fassung der Regeln liefe früher oder später auseinander. Die
  -- Zustimmung wird auch hier verlangt (PROJ-42) — jede Buchung trägt ihre
  -- eigene.
  v_neu := public.create_self_service_booking(
    p_course_id,
    v_alt.type,
    p_chosen_date,
    coalesce(v_alt.wants_student_price, false),
    p_prerequisite_confirmed,
    p_terms_accepted,
    p_terms_version,
    -- Die Tanzrolle wandert mit: Beim Verschieben eines Termins ändert sich
    -- nicht, ob jemand führt oder folgt.
    coalesce(v_alt.dance_role, '')
  );

  return v_neu;
end;
$function$;

comment on function public.rebook_self_service_booking(uuid, uuid, date, boolean, boolean, text) is
  'PROJ-52: Verschiebt eine Probestunde oder ein Drop-in auf einen anderen Termin oder Kurs — Stornierung und Neubuchung in einer Transaktion.';

revoke all on function public.rebook_self_service_booking(uuid, uuid, date, boolean, boolean, text)
  from public, anon;
grant execute on function public.rebook_self_service_booking(uuid, uuid, date, boolean, boolean, text)
  to authenticated;

-- Die Probestunden-Prüfung fragt „hat dieser Kunde eine aktive Probestunde?".
create index if not exists idx_course_bookings_probestunde
  on course_bookings (customer_id, chosen_date desc)
  where type = 'trial' and status in ('open', 'confirmed');
