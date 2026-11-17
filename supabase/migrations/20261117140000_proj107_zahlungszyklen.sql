-- PROJ-107 Stufe 1: Zahlungszyklen des Studios -- eingetragen statt gerechnet.
--
-- Bis hierher hatte jedes Abo seinen eigenen Rhythmus: verankert an seiner
-- letzten Abbuchung, vier Wochen weit, um die eingetragenen Schliesstage
-- verlaengert. Im Studio gibt es diesen Rhythmus aber nur einmal, fuer alle.
-- Die Abweichung war ein Artefakt der Software -- und sie hat am 2026-11-17
-- fast einen Zyklus Beitrag gekostet.
--
-- Ab hier ist ein Zyklus ein Datensatz: erster Tag, letzter Tag. Vier Wochen
-- sind nur noch der Vorschlag beim Anlegen; wer schliesst, verschiebt das Ende
-- von Hand. Damit verlaesst die Ferienarithmetik die Abrechnung -- das ist der
-- eigentliche Gewinn, nicht die Vereinheitlichung.
--
-- Vier Regeln stehen deshalb **hier** und nicht im Formular. Eine Pruefung nur
-- im Formular waere wirkungslos, sobald ein Zyklus einmal anders entsteht: aus
-- einem Skript, einem Import, einer Reparatur von Hand. Vorbild ist
-- `cash_cycles` (PROJ-98), wo dieselbe Entscheidung sich getragen hat.
--
--   1. Das Ende liegt nicht vor dem Beginn.
--   2. Kein Tag gehoert zu zwei Zyklen.
--   3. Kein Tag gehoert zu keinem Zyklus: jeder neue Zyklus setzt die Kette an
--      einem Ende fort.
--   4. Ein Zyklus mit einem Lastschriftlauf ist unveraenderlich.
--
-- WAS DIESE MIGRATION NICHT TUT: Sie legt keinen Zyklus an. Der erste Zyklus
-- des Studios ist der 30.11.2026 bis 10.01.2027 (vier Kurswochen plus zwei
-- Wochen Weihnachtspause), und er wird eingetragen, nicht einmigriert -- in der
-- Testdatenbank wuerde ein Zyklus ueber dem Dezember 2026 die bestehenden
-- E2E-Laeufe (PROJ-7 zum 15.12., PROJ-9 zum 24.12.) unter die neue Sperre
-- stellen und die Suite rot faerben, ohne dass etwas kaputt ist.


-- ---------------------------------------------------------------------------
-- 1. Der Zyklus
--
-- Keine Nummer und kein Name: Das Datum ist der Name. Beide Grenzen sind
-- eindeutig, damit "der juengste Zyklus" eine Zeile ist und nicht eine Frage
-- der Sortierung -- dieselbe Ueberlegung wie bei `cash_cycles`.
-- ---------------------------------------------------------------------------
create table if not exists public.billing_cycles (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  constraint billing_cycles_zeitraum check (ends_on >= starts_on),
  constraint billing_cycles_beginn_eindeutig unique (starts_on),
  constraint billing_cycles_ende_eindeutig unique (ends_on)
);

alter table public.billing_cycles enable row level security;

-- Das Einschalten steht ohne Zwischenzeile direkt hinter der Tabelle: Die
-- Pruefung im Supabase-SQL-Editor meldet sonst "creates a table without
-- enabling Row Level Security" (gelernt in PROJ-98).
--
-- Nur die Verwaltung, in allen vier Richtungen. Der Kunde sieht sein eigenes
-- Zyklusende im Profil ueber `abo_kuendigungsfenster`, nicht ueber diese
-- Tabelle -- eine Leseregel fuer Kunden waere eine Auskunft ueber den
-- Zahlungsrhythmus des Studios, die niemand braucht.
create policy "BillingCycles: nur Admin lesen"
  on public.billing_cycles for select
  using (public."current_role"() = 'admin');

create policy "BillingCycles: nur Admin anlegen"
  on public.billing_cycles for insert
  with check (public."current_role"() = 'admin');

create policy "BillingCycles: nur Admin aendern"
  on public.billing_cycles for update
  using (public."current_role"() = 'admin');

create policy "BillingCycles: nur Admin loeschen"
  on public.billing_cycles for delete
  using (public."current_role"() = 'admin');

-- Die haeufigste Frage ist "welcher Zyklus enthaelt diesen Tag".
create index if not exists billing_cycles_zeitraum_idx
  on public.billing_cycles (starts_on, ends_on);

comment on table public.billing_cycles is
  'PROJ-107: Je Zeile ein Zahlungszyklus des Studios -- erster und letzter Tag, lueckenlos aneinander. Vier Wochen sind nur der Vorschlag beim Anlegen; Schliessungen verlaengern den Zyklus, indem der Betreiber das Ende spaeter ansetzt.';


-- ---------------------------------------------------------------------------
-- 2. Die Kette: keine Ueberschneidung, keine Luecke
--
-- Der erste Zyklus darf frei liegen. Jeder weitere muss an einem Ende
-- anschliessen -- vorne oder hinten, damit auch Historie nachgetragen werden
-- kann. Zusammen mit dem Ueberschneidungsverbot bleibt die Menge genau eine
-- zusammenhaengende Kette.
-- ---------------------------------------------------------------------------
create or replace function public.billing_cycles_kette_pruefen()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_andere integer;
begin
  if exists (
    select 1
    from public.billing_cycles c
    where c.id <> new.id
      and new.starts_on <= c.ends_on
      and new.ends_on >= c.starts_on
  ) then
    raise exception 'billing cycle overlaps an existing one';
  end if;

  select count(*) into v_andere from public.billing_cycles c where c.id <> new.id;

  if v_andere > 0
     and not exists (
       select 1 from public.billing_cycles c
       where c.id <> new.id and c.ends_on = new.starts_on - 1
     )
     and not exists (
       select 1 from public.billing_cycles c
       where c.id <> new.id and c.starts_on = new.ends_on + 1
     )
  then
    raise exception 'billing cycle must adjoin an existing one';
  end if;

  return new;
end;
$$;

drop trigger if exists billing_cycles_kette on public.billing_cycles;
create trigger billing_cycles_kette
  before insert or update on public.billing_cycles
  for each row execute function public.billing_cycles_kette_pruefen();

comment on function public.billing_cycles_kette_pruefen() is
  'PROJ-107: Haelt die Zyklen als eine lueckenlose, nicht ueberschneidende Kette.';


-- ---------------------------------------------------------------------------
-- 3. Die Sperre: ein Zyklus mit Lauf ist unveraenderlich
--
-- Sonst aendert sich im Nachhinein, wofuer jemand bezahlt hat. Der Weg zurueck
-- ist, den Entwurf zu verwerfen -- und der ist in der Fehlermeldung benannt,
-- damit niemand im SQL-Editor nachsehen muss.
--
-- Beim Loeschen zusaetzlich: nur ein Zyklus am Rand der Kette darf gehen. Ein
-- Zyklus aus der Mitte wuerde eine Luecke hinterlassen, und die Kettenpruefung
-- oben greift beim Loeschen nicht.
-- ---------------------------------------------------------------------------
create or replace function public.billing_cycles_sperre_pruefen()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if exists (select 1 from public.sepa_collection_runs r where r.cycle_id = old.id) then
    raise exception 'billing cycle has collection runs';
  end if;

  if tg_op = 'DELETE'
     and exists (select 1 from public.billing_cycles c where c.ends_on = old.starts_on - 1)
     and exists (select 1 from public.billing_cycles c where c.starts_on = old.ends_on + 1)
  then
    raise exception 'billing cycle is not at the end of the chain';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists billing_cycles_sperre on public.billing_cycles;
create trigger billing_cycles_sperre
  before update or delete on public.billing_cycles
  for each row execute function public.billing_cycles_sperre_pruefen();

comment on function public.billing_cycles_sperre_pruefen() is
  'PROJ-107: Schuetzt Zyklen mit Lastschriftlauf vor Aenderung und die Kette vor Luecken beim Loeschen.';


-- ---------------------------------------------------------------------------
-- 4. Der Lauf zeigt auf den Zyklus
--
-- Nicht aus dem Faelligkeitstag erraten: Verschiebt ein Bankfeiertag den
-- Einzug um einen Tag ueber die Zyklusgrenze, soll der Lauf trotzdem zum
-- gemeinten Zyklus gehoeren. Ein Datumsvergleich beantwortet das falsch.
--
-- `null` ist erlaubt und bedeutet "aus der Zeit vor den Zyklen". Fuer solche
-- Laeufe gilt weiter die Vier-Wochen-Rechnung aus PROJ-70. Alle bestehenden
-- Laeufe bleiben damit, was sie sind -- es wird nichts rueckwirkend behauptet.
-- ---------------------------------------------------------------------------
alter table public.sepa_collection_runs
  add column if not exists cycle_id uuid references public.billing_cycles(id) on delete restrict;

create index if not exists sepa_collection_runs_cycle_idx
  on public.sepa_collection_runs (cycle_id);

comment on column public.sepa_collection_runs.cycle_id is
  'PROJ-107: Der Zahlungszyklus, fuer den dieser Lauf einzieht. NULL = Lauf aus der Zeit vor den Zyklen; dann gilt die Vier-Wochen-Rechnung aus PROJ-70.';


-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.billing_cycles_kette_pruefen() from public, anon;
revoke all on function public.billing_cycles_sperre_pruefen() from public, anon;
