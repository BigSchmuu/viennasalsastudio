-- PROJ-107 Stufe 2, erster Teil: Die Kuendigung haengt am eingetragenen Zyklus.
--
-- Bis hierher rechnete `abo_kuendigungsfenster` selbst: letzter Einzug plus
-- vier Unterrichtswochen, Ferientage mitgezaehlt, Frist am letzten Sonntag
-- davor. Dieselbe Rechnung stand damit zweimal im Projekt -- hier in SQL und
-- in `src/lib/sepa/faelligkeit.ts` fuer den Einzug -- und die Migration zu
-- PROJ-96 warnte im Kommentar selbst davor.
--
-- Ab hier liest sie den Zyklus, in dem **heute** liegt, und gibt dessen Ende
-- heraus. Damit ist die Rechnung nur noch einmal im Projekt, und sie steht
-- dort, wo der Betreiber sie sehen und aendern kann.
--
-- ZWEI AENDERUNGEN AN DER FACHLICHKEIT, beide vom Betreiber entschieden
-- (2026-11-17):
--
-- 1. **Die Frist entfaellt.** Alle Zyklen beginnen montags und enden sonntags;
--    damit fiel "letzter Sonntag am oder vor dem Zyklusschluss" mit dem
--    Zyklusende zusammen und liess null Tage Vorlauf -- genau das Problem, das
--    PROJ-96 loesen sollte. Statt die Frist neu zu legen, hat der Betreiber sie
--    gestrichen: Eine Kuendigung bis zum **letzten Tag** des Zyklus wirkt zum
--    Ende dieses Zyklus.
--
--    Daraus folgt eine Betriebsregel: Ein Lastschriftlauf wird am ersten Tag
--    des Zyklus oder spaeter angelegt, nicht vorher. Wer am 8.1. den Lauf fuer
--    den Zyklus ab 11.1. freigibt, hat eine Kuendigung vom 10.1. nicht darin.
--
-- 2. **Wirksam ist der Tag nach dem Zyklusende.** Der letzte bezahlte Tag ist
--    `ends_on`, der erste unbezahlte `ends_on + 1`. Genau dieses Datum
--    vergleicht der Lauf (`pending_effective_date <= faelligkeitsdatum`), und
--    genau dort beginnt der Folgezyklus.
--
-- Die Spalten `frist` und `frist_abgelaufen` bleiben in der Signatur: `frist`
-- traegt jetzt das Zyklusende -- "kuendigen bis" ist damit eine wahre Angabe --,
-- und `frist_abgelaufen` ist immer falsch. Die Signatur zu aendern hiesse,
-- Profil und Oberflaeche in einem Zug mitzuziehen; das kommt getrennt, damit
-- diese Migration allein zurueckgenommen werden kann.
--
-- Der RUECKFALL bleibt: Liegt heute in keinem eingetragenen Zyklus, gilt die
-- alte Rechnung unveraendert. Das deckt die Zeit vor dem 30.11.2026 und jede
-- Luecke, die der Betreiber bewusst gelassen hat.


create or replace function public.abo_kuendigungsfenster(p_subscription_id uuid)
returns table (
  zyklusschluss date,
  frist date,
  wirksam_zum date,
  frist_abgelaufen boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_abo subscriptions;
  v_start date;
  v_heute date := public.heute_wien();
  v_schluss date;
  v_frist date;
  v_zyklus_ende date;
begin
  select * into v_abo from subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'subscription not found';
  end if;

  -- Das eigene Abo, oder die Verwaltung. Unveraendert aus PROJ-96: Ohne diese
  -- Pruefung waere das Fenster eines fremden Abos fuer jeden Angemeldeten
  -- lesbar -- harmlos im Inhalt, aber eine Auskunft darueber, wer ueberhaupt
  -- ein Abo hat.
  if not (v_abo.customer_id = auth.uid() or "current_role"() = 'admin') then
    raise exception 'not authorized';
  end if;

  -- PROJ-107: Der eingetragene Zyklus, in dem heute liegt.
  select c.ends_on into v_zyklus_ende
  from public.billing_cycles c
  where v_heute between c.starts_on and c.ends_on;

  if v_zyklus_ende is not null then
    return query
    select
      v_zyklus_ende,            -- zyklusschluss
      v_zyklus_ende,            -- frist: es gibt keine eigene mehr, "kuendigen bis" ist das Zyklusende
      v_zyklus_ende + 1,        -- wirksam_zum: der erste nicht mehr bezahlte Tag
      false;                    -- frist_abgelaufen
    return;
  end if;

  -- Rueckfall auf die Rechnung aus PROJ-96, solange fuer heute kein Zyklus
  -- eingetragen ist. Wort fuer Wort die bisherige Fassung -- wer sie liest,
  -- soll sehen, dass hier nichts nebenbei geaendert wurde.
  select max(r.due_date) into v_start
  from sepa_collection_items i
  join sepa_collection_runs r on r.id = i.run_id
  where i.subscription_id = p_subscription_id;

  v_start := coalesce(v_start, v_abo.cycle_anchor_date);

  v_schluss := public.naechste_faelligkeit(v_start);
  while v_schluss < v_heute loop
    v_schluss := public.naechste_faelligkeit(v_schluss);
  end loop;

  v_frist := v_schluss - (extract(isodow from v_schluss)::int % 7);

  return query
  select
    v_schluss,                                                    -- zyklusschluss
    v_frist,                                                      -- frist
    case when v_heute <= v_frist
      then v_schluss
      else public.naechste_faelligkeit(v_schluss)
    end,                                                          -- wirksam_zum
    (v_heute > v_frist);                                          -- frist_abgelaufen
end;
$$;

comment on function public.abo_kuendigungsfenster(uuid) is
  'PROJ-107: Zyklusende und Wirksamkeitsdatum einer Kuendigung, gelesen aus billing_cycles. Eine Kuendigung bis zum letzten Tag des Zyklus wirkt zum Tag danach; eine eigene Frist gibt es nicht mehr. Ohne eingetragenen Zyklus gilt die Rechnung aus PROJ-96.';

-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.abo_kuendigungsfenster(uuid) from public, anon;
