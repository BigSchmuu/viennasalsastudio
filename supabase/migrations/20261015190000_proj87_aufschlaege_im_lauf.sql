-- PROJ-87, Nachtrag: Die Aufschlaege legt die Datenbank auf die Positionen,
-- nicht die Anwendung.
--
-- Der erste Entwurf hat das im Lauf-Code getan: Betrag erhoehen, dann den
-- Aufschlag mit der Positionskennung stempeln. Der Stempel traf **null
-- Zeilen** -- `subscription_surcharges` hat nur eine Leseregel, und PostgREST
-- meldet eine Aenderung ohne Treffer nicht als Fehler. Der Betrag war also
-- erhoeht, der Aufschlag galt weiter als offen, und der naechste Lauf haette
-- ihn ein zweites Mal aufgeschlagen.
--
-- Gefunden hat das der Browsertest zu PROJ-87, der den Stempel nachsieht.
-- Dieselbe Falle steht in .claude/rules/backend.md.
--
-- Jetzt macht es eine Funktion: lesen, erhoehen, stempeln -- in einem Vorgang
-- und mit den Rechten der Funktion, nicht des Aufrufers.
create or replace function public.apply_surcharges_to_run(p_run_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_anzahl integer := 0;
  v_zeile record;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  -- Je Position die Summe ihrer offenen Aufschlaege. Ein Abo kann mehrere
  -- haben; sie reisen zusammen mit.
  for v_zeile in
    select sci.id as item_id, sum(ss.amount) as betrag
    from sepa_collection_items sci
    join subscription_surcharges ss
      on ss.subscription_id = sci.subscription_id
     and ss.collection_item_id is null
    where sci.run_id = p_run_id
      and sci.subscription_id is not null
    group by sci.id
  loop
    update sepa_collection_items
    set amount = round(amount + v_zeile.betrag, 2)
    where id = v_zeile.item_id;

    -- Der Stempel macht den Aufschlag vergeben. Faellt der Entwurf weg,
    -- loescht das seine Positionen, und `on delete set null` gibt ihn frei.
    update subscription_surcharges
    set collection_item_id = v_zeile.item_id
    where subscription_id = (
            select subscription_id from sepa_collection_items where id = v_zeile.item_id
          )
      and collection_item_id is null;

    v_anzahl := v_anzahl + 1;
  end loop;

  return v_anzahl;
end;
$$;

revoke all on function public.apply_surcharges_to_run(uuid) from public, anon;
grant execute on function public.apply_surcharges_to_run(uuid) to authenticated;
