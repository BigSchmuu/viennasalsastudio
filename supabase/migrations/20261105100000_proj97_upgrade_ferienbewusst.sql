-- PROJ-97: Die Upgrade-Differenz rechnet mit Unterrichtswochen.
--
-- Aus der offenen Frage in PROJ-96: Im Upgrade steckte dasselbe starre
-- 28-Tage-Fenster, das die Kuendigung dort verloren hat. Drei Befunde:
--
-- 1) `flatrate_upgrade_zyklus_wird_abgebucht` verschenkt die Differenz.
--    Eine Ferienwoche verlaengert den Zyklus auf 35 Tage (PROJ-70). Ein Einzug
--    von vor 30 Tagen deckt dann den laufenden Zyklus -- das Fenster sieht ihn
--    nicht mehr und meldet "noch nicht eingezogen". Folge: Differenz 0, der
--    Kunde tanzt den Rest des Zyklus zum Kurspreis Flatrate, dem Studio fehlen
--    80.
--
-- 2) Am Rand kippt es in die andere Richtung. Liegt der Einzug **genau** 28
--    Tage zurueck, sagt `>= heute_wien() - 28` noch "schon eingezogen" -- also
--    wird aufgeschlagen. Zugleich ist das Abo nach `istFaellig` an genau diesem
--    Tag wieder faellig, der Lauf bucht die Flatrate also voll ab. 145 plus 80:
--    derselbe Fehler, gegen den PROJ-91 angetreten ist, geschrumpft auf einen
--    Tag -- und zwar auf den Tag, an dem Laeufe angelegt werden.
--
-- 3) `flatrate_upgrade_anrechnung` hat dasselbe Fenster, zweimal, und liefert
--    den **Betrag**. Darum darf 1) nicht allein behoben werden: Mit richtiger
--    Ja/Nein-Antwort und altem Anrechnungsfenster waere die Differenz 145
--    statt 80 -- aus dem Verlust des Studios wuerde eine Ueberzahlung des
--    Kunden. Beide wandern zusammen.
--
-- Die neue Grenze: Ein Einzug oder eine Barzahlung gehoert zum laufenden
-- Zyklus, solange `naechste_faelligkeit(Tag) > heute_wien()`. Das ist die
-- Rechnung, nach der der Lauf selbst entscheidet (PROJ-70), seit PROJ-96 in
-- SQL. Ohne Ferien ist sie identisch mit den alten 28 Tagen -- bis auf den
-- Randtag aus Befund 2.
--
-- Keine neue Rechnung also, nur ein vierter Aufrufer von
-- `naechste_faelligkeit`. Ihre Paritaet zur TypeScript-Fassung prueft
-- tests/PROJ-96-kuendigungsfrist-db.test.ts.
--
-- Nicht angefasst: der Doppelschutz bei Barzahlungen
-- (`cash_payment_nicht_doppelt`, PROJ-81). Er ist dort mit Begruendung starr --
-- ein Netz gegen den zweiten Druck auf den Knopf, keine Fachregel. Ferienbewusst
-- gemacht, blockierte er eine Zahlung, die ein paar Tage zu frueh kommt.


-- 1) Bucht der naechste Lauf den laufenden Zyklus noch voll ab?
--
-- Unveraendert bis auf die Zeitgrenze. Die beiden Eigenheiten dieser Funktion
-- bleiben, beide aus PROJ-91: Rueckbuchungen zaehlen mit (der Lauf bucht
-- deshalb nicht noch einmal ab), und es gibt kein oberes Datumsende (ein
-- freigegebener Lauf mit Faelligkeit in drei Tagen deckt den Zyklus schon).
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
      -- PROJ-97: Deckt dieser Einzug heute noch ab? Vorher `r.due_date >=
      -- heute_wien() - 28` -- blind gegen Ferien in beide Richtungen.
      and public.naechste_faelligkeit(r.due_date) > public.heute_wien()
  ) into v_schon_eingezogen;

  return not v_schon_eingezogen;
end;
$$;

comment on function public.flatrate_upgrade_zyklus_wird_abgebucht(uuid) is
  'PROJ-91/97: Bucht der naechste Lastschriftlauf den laufenden Zyklus dieses Abos noch voll ab? Gerechnet nach Unterrichtswochen (naechste_faelligkeit), nicht nach starren 28 Tagen.';


-- 2) Die Anrechnung -- was fuer den laufenden Zyklus schon bezahlt ist.
--
-- ACHTUNG, Spalten: `returns table` ist positionsbasiert, und PL/pgSQL prueft
-- die Struktur erst beim **Aufruf**. Fuenf Spalten sind deklariert, beide
-- Zweige des `union all` liefern fuenf in derselben Reihenfolge, und jede
-- Auswahlzeile tragt ihren Spaltennamen als Kommentar. Genau hier ist PROJ-95
-- umgefallen: Eine verlorene Spalte machte die Liste lautlos unbenutzbar.
--
-- Unveraendert bleiben die fachlichen Grenzen aus PROJ-88: nur freigegebene
-- Laeufe (ein Entwurf ist eine Absicht, kein Geld), kein zurueckgebuchtes Geld,
-- und keine Faelligkeit in der Zukunft (`due_date <= heute_wien()`).
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
    -- PROJ-97: Gehoert dieser Einzug zum laufenden Zyklus? Vorher
    -- `r.due_date >= heute_wien() - 28` -- eine Ferienwoche liess ihn
    -- herausfallen, und das zu Lasten des Kunden.
    and public.naechste_faelligkeit(r.due_date) > public.heute_wien()
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
    -- PROJ-97: Dieselbe Grenze wie oben. Eine Barzahlung deckt vier
    -- Unterrichtswochen ab -- das ist auch die Regel, die der Lehrkraft
    -- angezeigt wird (PROJ-81).
    and public.naechste_faelligkeit(z.paid_on) > public.heute_wien()
    and z.paid_on <= public.heute_wien()

  order by 4 desc;
end;
$$;

comment on function public.flatrate_upgrade_anrechnung(uuid) is
  'PROJ-88/97: Was fuer den laufenden Zyklus schon bezahlt ist -- Einzuege und Barzahlungen, gerechnet nach Unterrichtswochen (naechste_faelligkeit).';


-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
--
-- `flatrate_upgrade_angerechnet` summiert nur diese Liste und wird nicht
-- angefasst -- also auch nicht neu berechtigt.
revoke all on function public.flatrate_upgrade_zyklus_wird_abgebucht(uuid) from public, anon;
revoke all on function public.flatrate_upgrade_anrechnung(uuid) from public, anon;

grant execute on function public.flatrate_upgrade_zyklus_wird_abgebucht(uuid) to authenticated;
grant execute on function public.flatrate_upgrade_anrechnung(uuid) to authenticated;
