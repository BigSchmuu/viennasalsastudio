-- PROJ-107, Nachtrag aus dem vollen Prueflauf vom 2026-11-18: Ein Zyklus hat
-- eine plausible Laenge -- mindestens vier Kurswochen, hoechstens zwoelf.
--
-- ANLASS, und er ist kein gedachter. Im Prueflauf hat die Oberflaeche einen
-- Zyklus **18.11.2026 - 16.04.2034** angelegt: 2707 Tage. Die Datenbank hat ihn
-- widerspruchslos angenommen, denn sie prueft bisher nur zwei Dinge -- Ende
-- nicht vor Beginn, keine Ueberschneidung. Eine Laenge gab es nicht.
--
-- Die Folge war kein Schoenheitsfehler. Weil der Zyklus **heute** deckte, hat
-- ab diesem Augenblick jede Geldrechnung daraus abgeleitet:
--
--   * Im Profil stand "Kuendigung oder Pause bis 16.04.2034 -- wirkt dann zum
--     17.04.2034". Dem Kunden waere damit zugesagt, acht Jahre nicht kuendigen
--     zu muessen und zugleich acht Jahre lang nichts zu zahlen.
--   * Die Sperre "ein Einzug je Abo je Zyklus" liess keinen weiteren
--     Lastschriftlauf mehr zu -- bis 2034.
--   * Die Umstellung des Studierendenpreises (PROJ-102) rechnet ebenso am
--     Zyklus.
--
-- Im Testlauf kostete das 25 rote Pruefungen in acht Dateien. Im Betrieb
-- genuegte dafuer **ein vertippter Jahreswert** im Formular.
--
-- Der Betreiber hat die Grenze am 2026-11-18 auf **28 bis 84 Tage** festgelegt.
-- Vier Kurswochen sind 28 Tage und damit der kuerzeste wirkliche Zyklus; der
-- echte erste Zyklus (30.11.2026 - 10.01.2027) ist mit 42 Tagen die Mitte, weil
-- zwei Ferienwochen darin liegen. Zwoelf Wochen lassen Raum fuer eine
-- aussergewoehnlich lange Pause und fangen den vertippten Jahreswert trotzdem.
--
-- Die Pruefung steht an zwei Stellen, mit Absicht:
--
--   1. Im Trigger, **vor** der Ueberschneidung -- ein BEFORE-Trigger laeuft vor
--      den CHECK-Bedingungen, also waere die CHECK-Meldung sonst nie zu sehen,
--      und der Betreiber laese einen Postgres-Code statt eines Satzes.
--   2. Als CHECK -- damit die Regel auch dann gilt, wenn jemand den Trigger
--      abschaltet oder eine Zeile per SQL einfuegt.


-- Zuerst sagen, was im Weg steht: Ein CHECK prueft die bestehenden Zeilen mit,
-- und 'violates check constraint' allein nennt die Zeile nicht.
do $$
declare
  v_liste text;
begin
  select string_agg(format('%s bis %s (%s Tage)', starts_on, ends_on, ends_on - starts_on + 1), '; ')
  into v_liste
  from public.billing_cycles
  where (ends_on - starts_on) + 1 not between 28 and 84;

  if v_liste is not null then
    raise exception
      'Diese bestehenden Zyklen liegen ausserhalb von 28 bis 84 Tagen: %. Bitte zuerst richtigstellen -- danach laeuft diese Migration durch.',
      v_liste;
  end if;
end;
$$;


create or replace function public.billing_cycles_ueberschneidung_pruefen()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_tage integer;
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

  -- PROJ-107 Nachtrag: die Laenge -- und zwar **nach** der Ueberschneidung.
  -- Umgekehrt bekaeme ein kurzer Zeitraum, der mitten in einem bestehenden
  -- Zyklus liegt, die Laengenmeldung statt der wahren Ursache. Wer sich in
  -- einen bestehenden Zyklus hinein verlegt, soll "kein Tag gehoert zu zwei
  -- Zyklen" lesen; die Laenge ist dann das kleinere seiner Probleme.
  --
  -- Der erste und der letzte Tag zaehlen beide mit -- ein Zyklus vom 30.11. bis
  -- 10.01. ist 42 Tage lang, nicht 41.
  v_tage := (new.ends_on - new.starts_on) + 1;

  if v_tage < 28 then
    raise exception 'billing cycle shorter than four course weeks (% days)', v_tage;
  end if;

  if v_tage > 84 then
    raise exception 'billing cycle longer than twelve weeks (% days)', v_tage;
  end if;

  return new;
end;
$$;

comment on function public.billing_cycles_ueberschneidung_pruefen() is
  'PROJ-107: Kein Tag gehoert zu zwei Zyklen, und ein Zyklus ist 28 bis 84 Tage lang. Luecken sind erlaubt -- dafuer warnt das Formular, siehe Migrationen 20261117170000 und 20261118190000.';


alter table public.billing_cycles
  drop constraint if exists billing_cycles_laenge_plausibel;

alter table public.billing_cycles
  add constraint billing_cycles_laenge_plausibel
  check ((ends_on - starts_on) + 1 between 28 and 84);

comment on constraint billing_cycles_laenge_plausibel on public.billing_cycles is
  'PROJ-107: 28 bis 84 Tage. Vier Kurswochen sind das Mindeste, zwoelf Wochen das Aeusserste. Fing am 2026-11-18 einen Zyklus ueber 2707 Tage ab, aus dem jede Kuendigungsfrist und jede Einzugssperre abgeleitet worden waere.';
