-- PROJ-41: Der Preis, den der Kunde in der Kachel sieht, wird hier noch einmal
-- bestimmt — die Anzeige im Browser ist eine Behauptung des Clients und darf
-- nicht in die Buchung gelangen. Dieselbe Regel wie in src/lib/pricing.ts:
-- ein eigener Kurspreis schlaegt den Standard, ein leeres Feld heisst
-- "Standard" und nicht "kostenlos".
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
begin
  select price into v_course_price from courses where id = p_course_id;

  select course_price, course_student_price, flatrate_price, flatrate_student_price
    into v_std_course, v_std_course_student, v_std_flatrate, v_std_flatrate_student
    from dropin_pricing limit 1;

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

comment on function public.resolve_plan_price(uuid, text, boolean) is
  'PROJ-41: Serverseitige Preisermittlung fuer Kursabo und Flatrate. Spiegelt planPrice() aus src/lib/pricing.ts.';
