-- PROJ-44: Die beiden Belohnungsbetraege stehen dort, wo der Betreiber die
-- Preise ohnehin pflegt. Ein zweiter Ort waere eine weitere Stelle zum
-- Vergessen.
--
-- Anders als die Abo-Preise sind diese beiden nicht nullable: Ein Preis, den
-- niemand gepflegt hat, ist etwas anderes als ein Preis von 0 -- bei einer
-- Belohnung dagegen ist 0 die Aussage "das Programm ist aus", und die soll
-- moeglich sein, ohne dass es dafuer einen eigenen Schalter braucht.
alter table public.dropin_pricing
  add column if not exists referral_reward_referrer numeric not null default 15,
  add column if not exists referral_reward_referee numeric not null default 15;

alter table public.dropin_pricing drop constraint if exists dropin_pricing_referral_rewards_not_negative;
alter table public.dropin_pricing
  add constraint dropin_pricing_referral_rewards_not_negative
  check (referral_reward_referrer >= 0 and referral_reward_referee >= 0);
