-- PROJ-91: Die Upgrade-Differenz nur fuer einen Zyklus, der schon abgebucht ist.
--
-- Aus dem Betrieb gemeldet (2026-10-19): Ein Lastschriftlauf buchte 290 statt
-- 145 -- die Flatrate zweimal.
--
-- Die Rechnung dahinter: Fuer die beiden Kursabos der Kundin war im laufenden
-- Zyklus **nichts** eingezogen. Die Anrechnung sah also 0 und schlug als
-- Differenz den ganzen Flatrate-Preis vor (145). Der naechste Lauf nahm das Abo
-- dann regulaer mit -- noch nie eingezogen heisst faellig (PROJ-70) -- und
-- `apply_surcharges_to_run` legte die 145 obendrauf. Beides bezahlte denselben
-- Zyklus.
--
-- Die Differenz aus PROJ-87 setzt voraus, dass der laufende Zyklus **schon zum
-- alten Preis abgebucht ist**: 65 kassiert, 145 gilt, also 80 nach. Ist er noch
-- nicht abgebucht, bucht der naechste Lauf die Flatrate ohnehin voll ab, und
-- die Differenz gehoert auf 0.
--
-- Wer **kein Mandat** hat, bekommt gar keine Position. Bei ihm bleibt es bei
-- `Preis minus Eingegangenes`: Der Aufschlag ist der einzige Weg, auf dem die
-- Differenz in die Barzahler-Uebersicht kommt (PROJ-87).

-- 1. Bucht der naechste Lauf den laufenden Zyklus noch voll ab?
--
-- Zwei Bedingungen, und beide muessen stimmen: Es gibt ein Mandat (sonst gibt
-- es keine Position), und fuer **dieses** Abo wurde im laufenden Zyklus noch
-- nicht eingezogen (sonst ist es erst im naechsten Zyklus wieder faellig).
--
-- Zwei Unterschiede zur Anrechnung, beide mit Absicht:
--
-- * **Rueckbuchungen zaehlen hier mit.** Die Anrechnung fragt, welches Geld
--   angekommen ist -- zurueckgebuchtes nicht. Hier ist die Frage eine andere:
--   ob der Lauf noch einmal abbucht. Das tut er nicht, auch wenn das Geld
--   zurueckkam; der offene Betrag steht dann in den offenen Posten (PROJ-37).
-- * **Kein oberes Datumsende.** Ein freigegebener Lauf mit Faelligkeit in drei
--   Tagen ist noch nicht eingegangen, deckt den Zyklus aber schon ab.
--
-- Bekannte Ungenauigkeit, dieselbe wie bei der Anrechnung: Ferien verlaengern
-- einen Zyklus (PROJ-70), und ein deshalb aelterer Einzug faellt aus dem
-- 28-Tage-Fenster. Ein noch nicht freigegebener Entwurf zaehlt nicht mit --
-- ausgezahltes Geld ist er nicht. Deshalb steht die Zahl bei der Bestaetigung
-- zum Ueberschreiben da (PROJ-88).
create or replace function public.flatrate_upgrade_zyklus_wird_abgebucht(p_subscription_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_kunde uuid;
  v_hat_mandat boolean;
  v_schon_eingezogen boolean;
begin
  select customer_id into v_kunde from subscriptions where id = p_subscription_id;
  if v_kunde is null then
    return false;
  end if;

  if v_kunde <> auth.uid() and "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  select exists (
    select 1 from sepa_mandates m
    where m.customer_id = v_kunde and m.revoked_at is null
  ) into v_hat_mandat;

  if not v_hat_mandat then
    return false;
  end if;

  select exists (
    select 1
    from sepa_collection_items sci
    join sepa_collection_runs r on r.id = sci.run_id
    where sci.subscription_id = p_subscription_id
      and r.released_at is not null
      and r.due_date >= public.heute_wien() - 28
  ) into v_schon_eingezogen;

  return not v_schon_eingezogen;
end;
$$;

comment on function public.flatrate_upgrade_zyklus_wird_abgebucht(uuid) is
  'PROJ-91: Bucht der naechste Lastschriftlauf den laufenden Zyklus dieses Abos noch voll ab? Dann ist die Upgrade-Differenz null -- sonst zahlte der Kunde denselben Zyklus zweimal.';

-- 2. Die Bestaetigung rechnet nach derselben Regel.
--
-- Nur der gerechnete Vorschlag aendert sich. Ein mitgegebener Betrag gilt
-- weiter unveraendert -- auch die Null, die "nichts dazu" heisst.
create or replace function public.confirm_flatrate_upgrade(
  p_subscription_id uuid,
  p_student boolean default false,
  p_differenz numeric default null
)
returns subscriptions
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_alt subscriptions;
  v_neu subscriptions;
  v_preis numeric;
  v_angerechnet numeric;
  v_differenz numeric;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  select * into v_alt from subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'subscription not found';
  end if;
  if v_alt.upgrade_requested_at is null then
    raise exception 'no open request';
  end if;
  if not flatrate_upgrade_moeglich(p_subscription_id) then
    raise exception 'upgrade not possible';
  end if;

  select case when p_student then flatrate_student_price else flatrate_price end
    into v_preis
    from dropin_pricing limit 1;

  if v_preis is null or v_preis <= 0 then
    raise exception 'flatrate price missing';
  end if;

  if p_differenz is null then
    if flatrate_upgrade_zyklus_wird_abgebucht(p_subscription_id) then
      -- PROJ-91: Der naechste Lauf nimmt dieses Abo regulaer mit und bucht die
      -- Flatrate voll ab. Ein Aufschlag darauf waere derselbe Zyklus zum
      -- zweiten Mal.
      v_differenz := 0;
    else
      -- **Vor** dem Umstellen gerechnet: Die Anrechnung liest die aktiven
      -- Kursabos, und gleich gibt es keine mehr.
      v_angerechnet := flatrate_upgrade_angerechnet(v_alt.customer_id);
      v_differenz := round(v_preis - v_angerechnet, 2);
    end if;
  else
    -- Null ist eine Aussage und kein fehlender Wert: "nichts dazu".
    v_differenz := round(p_differenz, 2);
    if v_differenz < 0 then
      raise exception 'difference must not be negative';
    end if;
    -- Dieselbe Obergrenze wie bei jedem Betrag, den jemand von Hand eintippt.
    if v_differenz > 10000 then
      raise exception 'difference too high';
    end if;
  end if;

  -- Die Kursplätze zuerst, solange die anderen Abos noch stehen.
  insert into course_memberships (customer_id, course_id, subscription_id, dance_role, started_on)
  select v_alt.customer_id, s.course_id, p_subscription_id, null, public.heute_wien()
  from subscriptions s
  where s.customer_id = v_alt.customer_id
    and s.status = 'active'
    and s.course_id is not null
  on conflict do nothing;

  update subscriptions
  set status = 'cancelled',
      cancelled_at = public.heute_wien(),
      pending_status = null,
      pending_effective_date = null,
      upgrade_requested_at = null
  where customer_id = v_alt.customer_id
    and status = 'active'
    and course_id is not null
    and id <> p_subscription_id;

  update subscriptions
  set course_id = null,
      name = 'Flatrate',
      price = v_preis,
      upgrade_requested_at = null
  where id = p_subscription_id
  returning * into v_neu;

  if v_differenz > 0 then
    insert into subscription_surcharges (subscription_id, customer_id, amount, reason)
    values (p_subscription_id, v_alt.customer_id, v_differenz, 'Upgrade auf Flatrate');
  end if;

  insert into notification_queue (customer_id, event_type, payload, dedupe_key)
  values (
    v_alt.customer_id,
    'abo_upgrade',
    jsonb_build_object(
      'entscheidung', 'bestaetigt',
      'abo', 'Flatrate',
      'preis', v_preis,
      'differenz', greatest(v_differenz, 0)
    ),
    'abo_upgrade:' || p_subscription_id::text || ':' || public.heute_wien()::text
  );

  return v_neu;
end;
$$;

-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.flatrate_upgrade_zyklus_wird_abgebucht(uuid) from public, anon;
revoke all on function public.confirm_flatrate_upgrade(uuid, boolean, numeric) from public, anon;

grant execute on function public.flatrate_upgrade_zyklus_wird_abgebucht(uuid) to authenticated;
grant execute on function public.confirm_flatrate_upgrade(uuid, boolean, numeric) to authenticated;
