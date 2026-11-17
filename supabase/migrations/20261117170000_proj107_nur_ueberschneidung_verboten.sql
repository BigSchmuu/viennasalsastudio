-- PROJ-107, Korrektur derselben Stunde: Die Datenbank verbietet nur noch die
-- Ueberschneidung. Die Lueckenlosigkeit wandert ins Formular.
--
-- Die erste Fassung verlangte, dass jeder neue Zyklus die bestehende Kette an
-- einem Ende fortsetzt. Eine Probe gegen die Testdatenbank hat gezeigt, was das
-- in der Praxis bedeutet: Die echte Kette des Studios beginnt am 30.11.2026 --
-- ein Test (oder eine Nachtragung) fuer einen Zyklus im Jahr 2032 muesste
-- achtzig Zyklen lueckenlos dazwischen anlegen. Die Regel machte das Feature
-- unpruefbar, und eine Regel, die Tests verhindert, schuetzt kein Geld.
--
-- Die Abwaegung dahinter:
--
--   Eine **Ueberschneidung** darf niemals entstehen. Dann gehoert ein Tag zu
--   zwei Zyklen, und "zu welchem Zyklus gehoert dieser Lauf" hat zwei
--   Antworten. Das bleibt in der Datenbank.
--
--   Eine **Luecke** ist unerwuenscht, aber beherrschbar: Ein Faelligkeitstag
--   ohne Zyklus faellt auf die Vier-Wochen-Rechnung zurueck, und zwar nicht
--   stillschweigend -- der Betreiber wird darauf hingewiesen. Das Formular
--   belegt den ersten Tag mit "Tag nach dem letzten Zyklus" vor und warnt, wenn
--   der Betreiber davon abweicht. Vorschlagen statt verbieten, wie beim
--   Zyklusende selbst.
--
-- Nebenbei behoben: Ein BEFORE-Trigger laeuft **vor** den CHECK-Bedingungen.
-- Deshalb beantwortete die Kettenpruefung ein "Ende vor Beginn" mit der
-- Meldung 'must adjoin an existing one' -- richtig abgelehnt, falsch begruendet.
-- Die Zeitraumpruefung steht jetzt als erste im Trigger, damit die Meldung die
-- Ursache nennt.


create or replace function public.billing_cycles_ueberschneidung_pruefen()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- Zuerst, damit die Meldung stimmt: Der CHECK mit demselben Inhalt kaeme erst
  -- nach dem Trigger und wuerde hier nie mehr erreicht.
  if new.ends_on < new.starts_on then
    raise exception 'billing cycle ends before it starts';
  end if;

  if exists (
    select 1
    from public.billing_cycles c
    where c.id <> new.id
      and new.starts_on <= c.ends_on
      and new.ends_on >= c.starts_on
  ) then
    raise exception 'billing cycle overlaps an existing one';
  end if;

  return new;
end;
$$;

comment on function public.billing_cycles_ueberschneidung_pruefen() is
  'PROJ-107: Kein Tag gehoert zu zwei Zyklen. Luecken sind erlaubt -- dafuer warnt das Formular, siehe Migration 20261117170000.';

drop trigger if exists billing_cycles_kette on public.billing_cycles;
create trigger billing_cycles_ueberschneidung
  before insert or update on public.billing_cycles
  for each row execute function public.billing_cycles_ueberschneidung_pruefen();

drop function if exists public.billing_cycles_kette_pruefen();


-- Die Sperre behaelt ihren Kern -- ein Zyklus mit Lauf ist unveraenderlich --
-- und verliert die Randbedingung beim Loeschen: Sie sollte eine Luecke
-- verhindern, und Luecken sind jetzt erlaubt.
create or replace function public.billing_cycles_sperre_pruefen()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if exists (select 1 from public.sepa_collection_runs r where r.cycle_id = old.id) then
    raise exception 'billing cycle has collection runs';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

comment on function public.billing_cycles_sperre_pruefen() is
  'PROJ-107: Ein Zyklus mit Lastschriftlauf ist unveraenderlich -- sonst aendert sich im Nachhinein, wofuer jemand bezahlt hat.';

revoke all on function public.billing_cycles_ueberschneidung_pruefen() from public, anon;
revoke all on function public.billing_cycles_sperre_pruefen() from public, anon;
