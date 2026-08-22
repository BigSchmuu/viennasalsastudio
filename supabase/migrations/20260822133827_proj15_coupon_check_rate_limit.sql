-- PROJ-15 BUG-1: brute-force protection for coupon code guessing.
-- Deliberately enforced inside the SECURITY DEFINER function rather than in
-- the Next.js layer: the demonstrated attack calls this RPC directly with an
-- anon key, bypassing the app entirely, so an app-side limiter would not see it.
create table public.coupon_check_attempts (
  id bigserial primary key,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index coupon_check_attempts_customer_time_idx
  on public.coupon_check_attempts (customer_id, attempted_at desc);

alter table public.coupon_check_attempts enable row level security;
-- No policies: only the SECURITY DEFINER function below touches this table,
-- so customers can neither read their own attempt history nor clear it.

-- Explicit drop (not CREATE OR REPLACE): the return type gains a column, and
-- a replace with a changed signature is what created the duplicate-overload
-- bug caught earlier in this feature.
drop function public.check_coupon_code(text);

create function public.check_coupon_code(p_code text)
returns table(valid boolean, discount_type text, discount_amount numeric, rate_limited boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := auth.uid();
  v_coupon coupons;
  v_recent_attempts int;
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
  if v_recent_attempts >= 10 then
    return query select false, null::text, null::numeric, true;
    return;
  end if;

  insert into coupon_check_attempts (customer_id) values (v_customer_id);

  select * into v_coupon
  from coupons
  where upper(code) = upper(trim(p_code))
    and active
    and (expires_at is null or expires_at >= current_date)
    and redemption_count < max_redemptions
  limit 1;

  if v_coupon.id is null or exists (select 1 from subscriptions where customer_id = v_customer_id) then
    return query select false, null::text, null::numeric, false;
  else
    return query select true, v_coupon.discount_type, v_coupon.discount_amount, false;
  end if;
end;
$function$;
