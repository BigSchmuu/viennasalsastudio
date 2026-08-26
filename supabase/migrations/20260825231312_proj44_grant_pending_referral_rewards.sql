-- PROJ-44: Die Belohnung entsteht beim naechsten Lauf, nicht am Einzugstag.
--
-- Ob eine Lastschrift durchgeht, weiss am Tag des Einzugs niemand: Eine
-- Ruecklastschrift meldet die Bank Tage spaeter. Geprueft wird deshalb erst,
-- wenn der Einzug in der Vergangenheit liegt und nicht zurueckkam.
--
-- referral_rewarded_at ist die Sperre gegen die zweite Gutschrift: Sie wird
-- im selben update gesetzt, das die Faelle auswaehlt. Ein zweiter Lauf findet
-- denselben Kunden dann nicht mehr.
create or replace function public.grant_pending_referral_rewards()
returns table(referrer_id uuid, referee_id uuid, referrer_amount numeric, referee_amount numeric, referrer_balance numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_referrer_reward numeric;
  v_referee_reward numeric;
  v_fall record;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  select referral_reward_referrer, referral_reward_referee
    into v_referrer_reward, v_referee_reward
    from dropin_pricing limit 1;

  v_referrer_reward := coalesce(v_referrer_reward, 0);
  v_referee_reward := coalesce(v_referee_reward, 0);

  -- Beide Betraege auf 0 heisst: das Programm ist aus. Dann wird auch nichts
  -- als belohnt markiert -- wer es spaeter wieder einschaltet, soll die
  -- wartenden Faelle noch vorfinden.
  if v_referrer_reward <= 0 and v_referee_reward <= 0 then
    return;
  end if;

  for v_fall in
    update profiles p
    set referral_rewarded_at = now()
    where p.referred_by is not null
      and p.referral_rewarded_at is null
      and coalesce(
        (
          select i.bounced_at is null and i.amount > 0
          from sepa_collection_items i
          join sepa_collection_runs r on r.id = i.run_id
          where i.customer_id = p.id
            and i.subscription_id is not null
            and r.due_date < current_date
          order by r.due_date, i.created_at
          limit 1
        ),
        false
      )
    returning p.id as referee, p.referred_by as referrer
  loop
    if v_referrer_reward > 0 then
      insert into customer_credits (customer_id, amount, origin)
      values (v_fall.referrer, v_referrer_reward, 'referral');
    end if;

    if v_referee_reward > 0 then
      insert into customer_credits (customer_id, amount, origin)
      values (v_fall.referee, v_referee_reward, 'referral');
    end if;

    referrer_id := v_fall.referrer;
    referee_id := v_fall.referee;
    referrer_amount := v_referrer_reward;
    referee_amount := v_referee_reward;
    referrer_balance := customer_credit_balance(v_fall.referrer);
    return next;
  end loop;
end;
$function$;
