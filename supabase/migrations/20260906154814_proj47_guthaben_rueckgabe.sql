-- PROJ-47: Der Rueckweg zu redeem_customer_credit.
--
-- Bisher gab es die Verrechnung nur in eine Richtung. Jede Korrektur an einem
-- Entwurf braucht aber den Weg zurueck: Wer einen Betrag senkt oder eine
-- Position entfernt, darf dem Kunden nicht das Guthaben nehmen, das gegen eine
-- Forderung stand, die es nicht mehr gibt.
--
-- Die Rueckgabe loescht die Verrechnungszeile, statt eine Gegenbuchung
-- anzulegen. Das ist hier richtig, weil die Verrechnung nie ein Beleg war:
-- Sie ist eine Notiz an der Lastschriftposition, und die Position selbst
-- verschwindet oder aendert sich gerade. Eine Gegenbuchung hinterliesse zwei
-- Zeilen im Kundenverlauf fuer einen Vorgang, den der Kunde nie gesehen hat --
-- die Ankuendigung geht erst bei der Freigabe raus.
create or replace function public.return_collection_item_credit(p_collection_item_id uuid)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_zurueck numeric;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  delete from customer_credits
  where collection_item_id = p_collection_item_id
    and origin = 'redeemed'
  returning -amount into v_zurueck;

  -- Nichts zu tun ist kein Fehler: Nicht jede Position hatte Guthaben.
  return coalesce(v_zurueck, 0);
end;
$function$;

comment on function public.return_collection_item_credit(uuid) is
  'PROJ-47: gibt das fuer eine Lastschriftposition verrechnete Guthaben zurueck und liefert den Betrag. Ohne Verrechnung: 0.';

revoke execute on function public.return_collection_item_credit(uuid) from public, anon;
grant execute on function public.return_collection_item_credit(uuid) to authenticated, service_role;
