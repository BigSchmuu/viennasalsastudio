-- PROJ-42 BUG-1: Die vier Buchungsfunktionen pruefen den AGB-Stand jetzt ueber
-- assert_valid_terms_version statt nur auf "nicht leer".
--
-- Der Austausch geschieht am Quelltext der bestehenden Funktionen, statt sie
-- hier noch einmal vollstaendig hinzuschreiben: so kann sich beim Umstellen
-- kein anderer Teil des Koerpers unbemerkt aendern.
--
-- Der Block ist wiederholbar — findet er das alte Muster nicht mehr, tut er
-- nichts.
do $$
declare
  r record;
  alt text;
  neu text;
begin
  alt := '  if p_terms_version is null or trim(p_terms_version) = '''' then
    raise exception ''terms version missing'';
  end if;';
  neu := '  perform assert_valid_terms_version(p_terms_version);';

  for r in
    select p.oid, p.proname, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_regular_course_booking',
        'create_self_service_booking',
        'join_waitlist',
        'purchase_event_ticket'
      )
  loop
    if position(alt in r.def) > 0 then
      execute replace(r.def, alt, neu);
    end if;
  end loop;
end $$;
