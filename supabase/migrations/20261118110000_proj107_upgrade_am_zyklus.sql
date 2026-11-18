-- PROJ-107 Stufe 2, vierter Teil: Die Upgrade-Differenz haengt am Zyklus.
--
-- Die letzte der vier Zyklusrechnungen. Sie ist die unangenehmste, weil an ihr
-- Geld in beide Richtungen haengt: Sie entscheidet, ob ein Wechsel auf die
-- Flatrate mitten im Zyklus noch eine Differenz kostet, und was davon schon
-- bezahlt ist.
--
-- Dreimal stand bisher dieselbe Frage -- "gehoert dieser Tag zum laufenden
-- Zyklus?" -- und dreimal dieselbe Antwort:
-- `naechste_faelligkeit(tag) > heute_wien()`. Zweimal fuer Einzuege, einmal
-- fuer Barzahlungen.
--
-- Ab hier steht die Frage **einmal** da, als `zaehlt_zum_laufenden_zyklus`,
-- und die drei Stellen rufen sie auf.
--
-- WAS SICH FACHLICH AENDERT, und zwar zugunsten des Kunden:
--
--   Die alte Rechnung deckte ab einem Zahltag genau vier Unterrichtswochen ab.
--   Ein Zyklus kann aber laenger sein -- der erste des Studios ist 42 Tage
--   lang, weil die Weihnachtspause darin liegt. Wer am ersten Tag bezahlt
--   hatte, dessen Zahlung galt nach der alten Rechnung gegen Ende des Zyklus
--   als abgelaufen, und die Anrechnung fiel weg. Jetzt gilt sie fuer den
--   ganzen Zyklus, fuer den sie geleistet wurde.
--
-- Der Verweis des Laufs auf seinen Zyklus hat dabei Vorrang vor dem Datum: Ein
-- Bankfeiertag kann den Faelligkeitstag ueber die Zyklusgrenze schieben, und
-- dann gehoert der Lauf trotzdem zum gemeinten Zyklus. Ein Lauf ohne Zyklus
-- (die Zeit vor dem 30.11.2026) wird ueber sein Datum zugeordnet -- dieselbe
-- Regel wie beim Einzug selbst (`imSelbenZyklus` in src/lib/sepa/ausgelassen.ts).
--
-- Der RUECKFALL bleibt: Liegt heute in keinem eingetragenen Zyklus, gilt die
-- Rechnung aus PROJ-97 unveraendert, fuer alle drei Stellen.


-- ---------------------------------------------------------------------------
-- 1. Die Frage, einmal
-- ---------------------------------------------------------------------------
create or replace function public.zaehlt_zum_laufenden_zyklus(p_cycle_id uuid, p_tag date)
returns boolean
language plpgsql
stable
set search_path to 'public'
as $$
declare
  v_heute date := public.heute_wien();
  v_id uuid;
  v_von date;
  v_bis date;
begin
  select c.id, c.starts_on, c.ends_on into v_id, v_von, v_bis
  from public.billing_cycles c
  where v_heute between c.starts_on and c.ends_on;

  -- Rueckfall: Ohne eingetragenen Zyklus fuer heute die Rechnung aus PROJ-97.
  if v_id is null then
    return public.naechste_faelligkeit(p_tag) > v_heute;
  end if;

  -- Der Verweis hat Vorrang vor dem Datum.
  if p_cycle_id is not null then
    return p_cycle_id = v_id;
  end if;

  -- Ohne Verweis entscheidet der Tag: ein Lauf aus der Zeit vor den Zyklen,
  -- oder eine Barzahlung, die ohnehin keinen Verweis hat.
  return p_tag between v_von and v_bis;
end;
$$;

comment on function public.zaehlt_zum_laufenden_zyklus(uuid, date) is
  'PROJ-107: Gehoert dieser Tag zum Zyklus, in dem heute liegt? Der Verweis des Laufs hat Vorrang vor dem Datum. Ohne eingetragenen Zyklus gilt die Rechnung aus PROJ-97.';


-- ---------------------------------------------------------------------------
-- 2. Ist der laufende Zyklus schon abgebucht?
--
-- Unveraendert bis auf die eine Zeile. Die Rechte- und Mandatspruefungen
-- bleiben Wort fuer Wort, damit beim Lesen auffaellt, dass nur die
-- Zyklusfrage ersetzt wurde.
-- ---------------------------------------------------------------------------
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
      -- PROJ-107: Deckt dieser Einzug den laufenden Zyklus ab?
      and public.zaehlt_zum_laufenden_zyklus(r.cycle_id, r.due_date)
  ) into v_schon_eingezogen;

  return not v_schon_eingezogen;
end;
$$;

comment on function public.flatrate_upgrade_zyklus_wird_abgebucht(uuid) is
  'PROJ-91/97/107: Bucht der naechste Lastschriftlauf den laufenden Zyklus dieses Abos noch voll ab? Der Zyklus kommt aus billing_cycles, sonst aus der Rechnung von PROJ-97.';


-- ---------------------------------------------------------------------------
-- 3. Was fuer den laufenden Zyklus schon bezahlt ist
--
-- Fuenf Spalten im Kopf, fuenf in jedem Zweig des `union all`, jede
-- Auswahlzeile mit dem Namen ihrer Spalte -- unveraendert aus PROJ-97. Genau
-- hier ist PROJ-95 umgefallen, weil eine Spalte aus der Liste fiel und
-- PL/pgSQL das erst beim Aufruf merkt.
-- ---------------------------------------------------------------------------
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
  select
    s.id,                                      -- subscription_id
    coalesce(c.name, s.name, 'Abo'),           -- bezeichnung
    sci.amount,                                -- betrag
    r.due_date,                                -- eingang
    'lastschrift'::text                        -- art
  from subscriptions s
  join sepa_collection_items sci on sci.subscription_id = s.id
  join sepa_collection_runs r on r.id = sci.run_id
  left join courses c on c.id = s.course_id
  where s.customer_id = p_customer_id
    and s.status = 'active'
    and s.course_id is not null
    -- Nur freigegebene Laeufe. Ein Entwurf ist eine Absicht, kein Geld.
    and r.released_at is not null
    -- Zurueckgebuchtes zaehlt nicht: Geld, das zurueckkam, ist nicht bezahlt.
    and sci.bounced_at is null
    -- PROJ-107: Gehoert dieser Einzug zum laufenden Zyklus?
    and public.zaehlt_zum_laufenden_zyklus(r.cycle_id, r.due_date)
    and r.due_date <= public.heute_wien()

  union all

  -- Barzahlung: Ein Barzahler hat kein Mandat und damit keinen Einzug, aber er
  -- hat bezahlt. Ohne diese Zeile zahlte er den vollen Flatrate-Preis obendrauf.
  select
    s.id,                                      -- subscription_id
    coalesce(c.name, s.name, 'Abo'),           -- bezeichnung
    z.amount,                                  -- betrag
    z.paid_on,                                 -- eingang
    'barzahlung'::text                         -- art
  from subscriptions s
  join cash_payments z on z.subscription_id = s.id
  left join courses c on c.id = s.course_id
  where s.customer_id = p_customer_id
    and s.status = 'active'
    and s.course_id is not null
    -- PROJ-107: Dieselbe Frage wie oben. Eine Barzahlung hat keinen Verweis
    -- auf einen Lauf, also entscheidet ihr Zahltag.
    and public.zaehlt_zum_laufenden_zyklus(null, z.paid_on)
    and z.paid_on <= public.heute_wien()

  order by 4 desc;
end;
$$;

comment on function public.flatrate_upgrade_anrechnung(uuid) is
  'PROJ-88/97/107: Was fuer den laufenden Zyklus schon bezahlt ist -- Einzuege und Barzahlungen, zugeordnet ueber billing_cycles.';


-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.zaehlt_zum_laufenden_zyklus(uuid, date) from public, anon;
revoke all on function public.flatrate_upgrade_zyklus_wird_abgebucht(uuid) from public, anon;
revoke all on function public.flatrate_upgrade_anrechnung(uuid) from public, anon;

grant execute on function public.flatrate_upgrade_zyklus_wird_abgebucht(uuid) to authenticated;
grant execute on function public.flatrate_upgrade_anrechnung(uuid) to authenticated;
