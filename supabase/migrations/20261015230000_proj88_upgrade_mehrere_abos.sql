-- PROJ-88: Upgrade auf die Flatrate auch mit mehreren Kursabos.
--
-- PROJ-87 liess nur upgraden, wer genau ein Kursabo hatte -- also gerade den
-- Kunden nicht, fuer den eine Flatrate sich lohnt. Die Bedingung faellt; was
-- bleibt, ist die Entscheidung des Betreibers bei der Bestaetigung.
--
-- Mit der Bestaetigung wird das **angefragte** Abo zur Flatrate (sein Zyklus
-- bleibt), die anderen aktiven Kursabos werden gekuendigt, und aus allen
-- betroffenen Kursen werden Kursplaetze. Der Kunde behaelt damit seine Kurse.
--
-- Die Differenz rechnet gegen das, was im laufenden Zyklus **tatsaechlich
-- bezahlt** wurde -- nicht gegen die Summe der Listenpreise. Ein Beitrag, der
-- nie eingezogen wurde, ist nicht bezahlt.

-- 1. Was angerechnet wird, Zeile fuer Zeile.
--
-- Eine Aufstellung und keine blosse Summe: Der Betreiber soll vor dem
-- Bestaetigen sehen, was angerechnet wird und wann es einging. Die Rechnung
-- hat eine bekannte Ungenauigkeit -- Ferien verlaengern einen Zyklus (PROJ-70),
-- und ein deshalb aelterer Einzug faellt aus dem Fenster. Sichtbar statt
-- hergeleitet: Sieht es falsch aus, lehnt er ab und macht es von Hand.
create or replace function public.flatrate_upgrade_anrechnung(p_customer_id uuid)
returns table (
  subscription_id uuid,
  bezeichnung text,
  betrag numeric,
  eingang date,
  art text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if p_customer_id <> auth.uid() and "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  return query
  -- Lastschrift: ohne zurueckgebuchte. Geld, das zurueckkam, ist nicht bezahlt
  -- -- es steht als offener Posten daneben (PROJ-37).
  select
    s.id,
    coalesce(c.name, s.name, 'Abo'),
    sci.amount,
    r.due_date,
    'lastschrift'::text
  from subscriptions s
  join sepa_collection_items sci on sci.subscription_id = s.id
  join sepa_collection_runs r on r.id = sci.run_id
  left join courses c on c.id = s.course_id
  where s.customer_id = p_customer_id
    and s.status = 'active'
    and s.course_id is not null
    and sci.bounced_at is null
    and r.due_date >= public.heute_wien() - 28
    and r.due_date <= public.heute_wien()

  union all

  -- Barzahlung: Ein Barzahler hat kein Mandat und damit keinen Einzug, aber er
  -- hat bezahlt. Ohne diese Zeile zahlte er den vollen Flatrate-Preis obendrauf.
  select
    s.id,
    coalesce(c.name, s.name, 'Abo'),
    z.amount,
    z.paid_on,
    'barzahlung'::text
  from subscriptions s
  join cash_payments z on z.subscription_id = s.id
  left join courses c on c.id = s.course_id
  where s.customer_id = p_customer_id
    and s.status = 'active'
    and s.course_id is not null
    and z.paid_on >= public.heute_wien() - 28
    and z.paid_on <= public.heute_wien()

  order by 4 desc;
end;
$$;

comment on function public.flatrate_upgrade_anrechnung(uuid) is
  'PROJ-88: Was im laufenden Zyklus fuer die Kursabos dieses Kunden eingegangen ist -- Einzuege ohne Rueckbuchung und Barzahlungen der letzten 28 Tage.';

-- 2. Die Summe daraus -- dieselbe Quelle, damit nichts driftet.
create or replace function public.flatrate_upgrade_angerechnet(p_customer_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(betrag), 0) from public.flatrate_upgrade_anrechnung(p_customer_id);
$$;

comment on function public.flatrate_upgrade_angerechnet(uuid) is
  'PROJ-88: Summe der Anrechnung. Die Differenz beim Upgrade ist Flatrate-Preis minus dieser Summe, mindestens null.';

-- 3. Die Bedingung verliert die Abo-Zahl.
--
-- Was bleibt: aktiv, kursgebunden, keine ausstehende Aenderung, keine laufende
-- Flatrate, Preis gepflegt. Die Zahl der Kursabos spielt keine Rolle mehr --
-- mehrere zusammenzulegen ist genau der Fall, um den es geht.
create or replace function public.flatrate_upgrade_moeglich(p_subscription_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from subscriptions s
    where s.id = p_subscription_id
      and s.status = 'active'
      and s.course_id is not null
      and s.pending_status is null
      and not exists (
        select 1 from subscriptions f
        where f.customer_id = s.customer_id and f.status = 'active' and f.course_id is null
      )
      and (select flatrate_price from dropin_pricing limit 1) is not null
  );
$$;

-- 4. Bestaetigen -- jetzt mit allen Kursabos.
create or replace function public.confirm_flatrate_upgrade(
  p_subscription_id uuid,
  p_student boolean default false
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
  v_kurs uuid;
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

  v_kurs := v_alt.course_id;
  -- **Vor** dem Umstellen gerechnet: Die Anrechnung liest die aktiven
  -- Kursabos, und gleich gibt es keine mehr.
  v_angerechnet := flatrate_upgrade_angerechnet(v_alt.customer_id);
  v_differenz := round(v_preis - v_angerechnet, 2);

  -- Die Kursplaetze zuerst, solange die anderen Abos noch stehen: Ihre Kurse
  -- sollen der Kunde behalten. PROJ-69: ein Platz gilt ab seinem Starttermin.
  insert into course_memberships (customer_id, course_id, subscription_id, dance_role, started_on)
  select v_alt.customer_id, s.course_id, p_subscription_id, null, public.heute_wien()
  from subscriptions s
  where s.customer_id = v_alt.customer_id
    and s.status = 'active'
    and s.course_id is not null
  on conflict do nothing;

  -- Die anderen Kursabos beenden. Gekuendigt, nicht geloescht: `cancelled_at`
  -- ist die dauerhafte Spur, ueber die die Auswertung zaehlt (PROJ-79/80), und
  -- ein geloeschtes Abo naehme seine Zahlungen mit.
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

  -- `cycle_anchor_date` bleibt unberuehrt. Ein neues Abo haette keinen Einzug
  -- in der Vergangenheit und waere nach PROJ-70 sofort faellig.
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
revoke all on function public.flatrate_upgrade_anrechnung(uuid) from public, anon;
revoke all on function public.flatrate_upgrade_angerechnet(uuid) from public, anon;
revoke all on function public.flatrate_upgrade_moeglich(uuid) from public, anon;
revoke all on function public.confirm_flatrate_upgrade(uuid, boolean) from public, anon;

grant execute on function public.flatrate_upgrade_anrechnung(uuid) to authenticated;
grant execute on function public.flatrate_upgrade_angerechnet(uuid) to authenticated;
grant execute on function public.flatrate_upgrade_moeglich(uuid) to authenticated;
grant execute on function public.confirm_flatrate_upgrade(uuid, boolean) to authenticated;
