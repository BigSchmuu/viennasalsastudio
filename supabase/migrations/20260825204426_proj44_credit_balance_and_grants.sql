-- PROJ-44: Kontostand und die beiden Wege, ihn zu veraendern.

-- Der Kontostand ist die Summe des Verlaufs.
create or replace function public.customer_credit_balance(p_customer_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(amount), 0) from customer_credits where customer_id = p_customer_id;
$$;

comment on function public.customer_credit_balance(uuid) is
  'PROJ-44: Kontostand eines Kunden als Summe seines Guthaben-Verlaufs.';

-- Gutschreiben oder abziehen -- beides von Hand durch den Betreiber.
--
-- Das Abziehen gehoert dazu: Wer vergeben kann, vertippt sich irgendwann, und
-- ohne Gegenstueck bliebe der Fehler stehen.
--
-- Ein negatives Guthaben ist ausgeschlossen. Es waere eine Forderung an den
-- Kunden, und dafuer gibt es die Rechnung, nicht das Guthabenkonto.
create or replace function public.grant_customer_credit(
  p_customer_id uuid,
  p_amount numeric,
  p_reason text
)
returns customer_credits
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid := auth.uid();
  v_balance numeric;
  v_row customer_credits;
begin
  if public.current_role() <> 'admin' then
    raise exception 'not authorized';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'amount required';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'reason required';
  end if;

  select customer_credit_balance(p_customer_id) into v_balance;
  if v_balance + p_amount < 0 then
    raise exception 'balance would go negative';
  end if;

  insert into customer_credits (customer_id, amount, origin, reason, created_by)
  values (p_customer_id, p_amount, 'manual', trim(p_reason), v_actor)
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.grant_customer_credit(uuid, numeric, text) is
  'PROJ-44: Guthaben von Hand vergeben (positiv) oder abziehen (negativ). Verlangt einen Grund und laesst den Kontostand nie unter null fallen.';

-- Beim SEPA-Lauf verrechnen: so viel wie moeglich, hoechstens bis auf null.
--
-- Gibt den tatsaechlich verrechneten Betrag zurueck (0, wenn kein Guthaben da
-- ist). Der eindeutige Index auf collection_item_id sorgt dafuer, dass ein
-- wiederholter Lauf dieselbe Abbuchung nicht zweimal mindert.
create or replace function public.redeem_customer_credit(
  p_customer_id uuid,
  p_collection_item_id uuid,
  p_max_amount numeric
)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_balance numeric;
  v_use numeric;
begin
  if public.current_role() <> 'admin' then
    raise exception 'not authorized';
  end if;

  select customer_credit_balance(p_customer_id) into v_balance;
  v_use := least(greatest(v_balance, 0), greatest(coalesce(p_max_amount, 0), 0));
  if v_use <= 0 then
    return 0;
  end if;

  insert into customer_credits (customer_id, amount, origin, reason, collection_item_id)
  values (p_customer_id, -v_use, 'redeemed', 'Mit Lastschrift verrechnet', p_collection_item_id)
  on conflict (collection_item_id) where origin = 'redeemed' do nothing;

  -- Kam die Zeile nicht zustande, war diese Abbuchung schon verrechnet.
  if not found then
    return 0;
  end if;

  return v_use;
end;
$$;

comment on function public.redeem_customer_credit(uuid, uuid, numeric) is
  'PROJ-44: Verrechnet Guthaben mit einer Abbuchung, hoechstens bis auf null. Gibt den verrechneten Betrag zurueck.';
