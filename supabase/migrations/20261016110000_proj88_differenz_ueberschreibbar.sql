-- PROJ-88, Nachtrag: Die Differenz laesst sich beim Bestaetigen ueberschreiben.
--
-- Die Anrechnung rechnet, was im laufenden Zyklus eingegangen ist. Das stimmt
-- meistens -- aber nicht immer: Zwei Abos mit verschiedenen Zyklen, ein durch
-- Ferien verlaengerter Zyklus, eine Absprache. Bisher konnte der Betreiber die
-- Zahl dann nirgends korrigieren; "dann von Hand" bedeutete drei Schritte mit
-- der Kursplatz-Falle.
--
-- Also ein Feld: vorbelegt mit dem gerechneten Wert, ueberschreibbar. Fuer den
-- haeufigen Fall aendert sich nichts -- ohne Angabe rechnet die Funktion wie
-- bisher.
--
-- Ein dritter Parameter mit Standardwert macht den zweistelligen Aufruf
-- zweideutig ("function is not unique"), deshalb loeschen und neu anlegen.
drop function if exists public.confirm_flatrate_upgrade(uuid, boolean);

create function public.confirm_flatrate_upgrade(
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
    -- **Vor** dem Umstellen gerechnet: Die Anrechnung liest die aktiven
    -- Kursabos, und gleich gibt es keine mehr.
    v_angerechnet := flatrate_upgrade_angerechnet(v_alt.customer_id);
    v_differenz := round(v_preis - v_angerechnet, 2);
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

revoke all on function public.confirm_flatrate_upgrade(uuid, boolean, numeric) from public, anon;
grant execute on function public.confirm_flatrate_upgrade(uuid, boolean, numeric) to authenticated;
