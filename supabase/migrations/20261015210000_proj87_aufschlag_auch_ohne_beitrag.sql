-- PROJ-87, zweiter Nachtrag: Der Aufschlag kommt in den naechsten Lauf, auch
-- wenn der Beitrag selbst nicht mitkommt.
--
-- Vorher hing der Aufschlag an einer Position, die es geben musste. Faellt das
-- Abo aus dem Lauf, gab es keine -- und der Aufschlag blieb liegen. Der Fall,
-- der das sichtbar gemacht hat: Jemand upgradet am 15.10. und kuendigt zum
-- 11.11. Der Lauf zum 11.11. nimmt gekuendigte Abos nicht mit
-- (`pending_effective_date > due_date` in actions/admin/sepa-collections.ts),
-- das Abo geht danach auf `cancelled` und kommt in keinen Lauf mehr. Die
-- Differenz war damit lautlos weg -- und der Hinweis in der
-- Barzahler-Uebersicht greift nicht, weil der Kunde ein Mandat hat.
--
-- Dasselbe gilt, wenn der Beitrag in diesem Lauf einfach nicht faellig ist
-- (PROJ-70, vier Wochen Abstand): Auch dann ist dies der naechste Lauf, und
-- der Aufschlag gehoert hinein.
--
-- Wer kein Mandat hat, bekommt weiterhin keine Position -- er steht in der
-- Barzahler-Uebersicht, und dort wird das Geld eingesammelt.
create or replace function public.apply_surcharges_to_run(p_run_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_anzahl integer := 0;
  v_zeile record;
  v_mandat sepa_mandates;
  v_item uuid;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  -- Schritt 1: Positionen, die es in diesem Lauf schon gibt -- aufschlagen.
  for v_zeile in
    select sci.id as item_id, sci.subscription_id, sum(ss.amount) as betrag
    from sepa_collection_items sci
    join subscription_surcharges ss
      on ss.subscription_id = sci.subscription_id
     and ss.collection_item_id is null
    where sci.run_id = p_run_id
      and sci.subscription_id is not null
    group by sci.id, sci.subscription_id
  loop
    update sepa_collection_items
    set amount = round(amount + v_zeile.betrag, 2)
    where id = v_zeile.item_id;

    -- Der Stempel macht den Aufschlag vergeben. Faellt der Entwurf weg,
    -- loescht das seine Positionen, und `on delete set null` gibt ihn frei.
    update subscription_surcharges
    set collection_item_id = v_zeile.item_id
    where subscription_id = v_zeile.subscription_id
      and collection_item_id is null;

    v_anzahl := v_anzahl + 1;
  end loop;

  -- Schritt 2: Abos mit offenem Aufschlag, die in diesem Lauf keine Position
  -- haben -- eine eigene Position ueber genau den Aufschlag.
  --
  -- Ohne Statusfilter: Ein gekuendigtes Abo schuldet den Betrag genauso wie
  -- ein pausiertes. Was zaehlt, ist das Mandat.
  for v_zeile in
    select ss.subscription_id, s.customer_id, sum(ss.amount) as betrag
    from subscription_surcharges ss
    join subscriptions s on s.id = ss.subscription_id
    where ss.collection_item_id is null
      and not exists (
        select 1 from sepa_collection_items sci
        where sci.run_id = p_run_id and sci.subscription_id = ss.subscription_id
      )
    group by ss.subscription_id, s.customer_id
  loop
    select * into v_mandat
      from sepa_mandates m
     where m.customer_id = v_zeile.customer_id
       and m.revoked_at is null
     order by m.consented_at desc
     limit 1;

    -- Kein Mandat: Der Aufschlag bleibt offen und steht in der
    -- Barzahler-Uebersicht. Eine Lastschrift ohne Mandat gibt es nicht.
    if not found then
      continue;
    end if;

    insert into sepa_collection_items (
      run_id, customer_id, subscription_id, amount,
      iban, account_holder_name, mandate_reference
    ) values (
      p_run_id, v_zeile.customer_id, v_zeile.subscription_id, round(v_zeile.betrag, 2),
      v_mandat.iban, v_mandat.account_holder_name, v_mandat.mandate_reference
    )
    returning id into v_item;

    update subscription_surcharges
    set collection_item_id = v_item
    where subscription_id = v_zeile.subscription_id
      and collection_item_id is null;

    v_anzahl := v_anzahl + 1;
  end loop;

  return v_anzahl;
end;
$$;

revoke all on function public.apply_surcharges_to_run(uuid) from public, anon;
grant execute on function public.apply_surcharges_to_run(uuid) to authenticated;
