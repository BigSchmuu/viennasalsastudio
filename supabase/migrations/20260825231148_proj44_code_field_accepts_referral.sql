-- PROJ-44: Dasselbe Feld nimmt Gutschein- und Empfehlungscodes.
--
-- Der Rueckgabetyp waechst um eine Spalte, deshalb drop statt replace: Ein
-- "create or replace" mit anderem Rueckgabetyp scheitert, und ein Wechsel der
-- Signatur wuerde eine zweite Fassung danebenstellen statt die alte zu
-- ersetzen (PROJ-15).
drop function if exists public.check_coupon_code(text);

create function public.check_coupon_code(p_code text)
returns table(valid boolean, code_kind text, discount_type text, discount_amount numeric, rate_limited boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := auth.uid();
  v_coupon coupons;
  v_recent_attempts int;
  v_referrer_id uuid;
  v_referee_reward numeric;
  v_has_subscription boolean;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  -- Opportunistic cleanup so this table can't grow unbounded.
  delete from coupon_check_attempts where attempted_at < now() - interval '1 day';

  select count(*) into v_recent_attempts
  from coupon_check_attempts
  where customer_id = v_customer_id
    and attempted_at > now() - interval '15 minutes';

  -- Generous for a real customer fixing a typo, prohibitive for enumeration.
  -- Gilt jetzt auch fuer Empfehlungscodes -- die sind genau das, was jemand
  -- durchprobieren wuerde, um sich Guthaben zu verschaffen.
  if v_recent_attempts >= 10 then
    return query select false, null::text, null::text, null::numeric, true;
    return;
  end if;

  insert into coupon_check_attempts (customer_id) values (v_customer_id);

  select exists (select 1 from subscriptions where customer_id = v_customer_id)
    into v_has_subscription;

  select * into v_coupon
  from coupons
  where upper(code) = upper(trim(p_code))
    and active
    and (expires_at is null or expires_at >= current_date)
    and redemption_count < max_redemptions
  limit 1;

  if v_coupon.id is not null then
    if v_has_subscription then
      return query select false, null::text, null::text, null::numeric, false;
    else
      return query select true, 'coupon'::text, v_coupon.discount_type, v_coupon.discount_amount, false;
    end if;
    return;
  end if;

  -- Kein Gutschein -- dann vielleicht ein Empfehlungscode.
  select id into v_referrer_id
  from profiles
  where upper(referral_code) = upper(trim(p_code))
    and role = 'customer'
  limit 1;

  select referral_reward_referee into v_referee_reward from dropin_pricing limit 1;

  -- Der eigene Code zaehlt nicht, ein Bestandskunde bekommt nichts, und wer
  -- bereits jemandem zugeordnet ist, wird nicht neu zugeordnet. Alle drei
  -- Faelle sehen fuer den Kunden gleich aus: der Code wird nicht anerkannt.
  if v_referrer_id is null
     or v_referrer_id = v_customer_id
     or v_has_subscription
     or coalesce(v_referee_reward, 0) <= 0
     or exists (select 1 from profiles where id = v_customer_id and referred_by is not null)
  then
    return query select false, null::text, null::text, null::numeric, false;
  else
    return query select true, 'referral'::text, null::text, v_referee_reward, false;
  end if;
end;
$function$;
