-- PROJ-30: Die beiden Funktionen, die eine regulaere Anfrage bzw. einen
-- Wartelisten-Eintrag anlegen, pruefen jetzt die Tanzrolle.
--
-- Der Austausch geschieht am Quelltext der bestehenden Funktionen, statt sie
-- hier noch einmal vollstaendig hinzuschreiben: so kann sich beim Umstellen
-- kein anderer Teil des Koerpers unbemerkt aendern. Der Block ist
-- wiederholbar -- findet er das Muster nicht mehr, tut er nichts.
do $$
declare
  r record;
  alt text;
  neu text;
begin
  alt := '  select prerequisite_note into v_prerequisite_note from courses where id = p_course_id;';
  neu := '  perform require_dance_role(p_course_id, p_dance_role);

  select prerequisite_note into v_prerequisite_note from courses where id = p_course_id;';
  for r in select p.oid, pg_get_functiondef(p.oid) as def from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'create_regular_course_booking'
  loop
    if position(alt in r.def) > 0 and position('require_dance_role' in r.def) = 0 then
      execute replace(r.def, alt, neu);
    end if;
  end loop;

  alt := '  if not exists (
    select 1 from sepa_mandates where customer_id = v_customer_id and revoked_at is null
  ) then
    raise exception ''mandate required'';
  end if;';
  neu := '  perform require_dance_role(p_course_id, p_dance_role);

' || alt;
  for r in select p.oid, pg_get_functiondef(p.oid) as def from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'join_waitlist'
  loop
    if position(alt in r.def) > 0 and position('require_dance_role' in r.def) = 0 then
      execute replace(r.def, alt, neu);
    end if;
  end loop;
end $$;
