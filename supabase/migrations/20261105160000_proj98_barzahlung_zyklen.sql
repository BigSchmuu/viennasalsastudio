-- PROJ-98: Zahlungszyklen bei den Barzahlern -- Archiv und Abschluss mit Datum.
--
-- Anlass: Ein Zyklus war in der Datenbank nichts. `cash_entries` *war* der
-- laufende Zyklus, trug kein Datum, und "Zyklus abschliessen" loeschte die
-- ganze Liste. Die Zahlungen ueberlebten, verloren aber ihren Bezug
-- (`entry_id` wird NULL). Daraus folgen beide Beschwerden aus dem Betrieb:
--
-- 1. "Fuer welchen Zyklus hat der Kunde gezahlt?" war nicht beantwortbar.
-- 2. Wer in den Tagen zwischen Zyklusende und Abschluss zahlte, zahlte fuer
--    den *neuen* Zyklus -- sein Eintrag wurde beim Abschliessen aber mit
--    geloescht, und auf der neuen Liste stand er wieder als offen.
--
-- Ab hier gilt eine einzige Regel: Beim Abschliessen waehlt die Verwaltung das
-- Enddatum, die Liste wird abgeschrieben, und von der Liste verschwindet
-- genau, wer bis einschliesslich Enddatum voll bezahlt hat. Alles andere
-- bleibt stehen -- die Offenen und die, die nach dem Enddatum gezahlt haben.
--
-- Zu welchem Zyklus eine Zahlung gehoert, sagt ihr Zahltag: Sie faellt in
-- genau einen Zeitraum. Keine Spalte an den Zahlungen, die neben den
-- Zeitraeumen eine zweite Wahrheit waere.
--
-- Was PROJ-84 ausgeschlossen hat, bleibt ausgeschlossen: Der Betrag kommt von
-- Hand, wer auf der Liste steht kommt von Hand, nichts rechnet selbstaendig
-- ein Soll aus. Hinzu kommt nur ein Datum, das der Betreiber selbst eintippt.

-- ---------------------------------------------------------------------------
-- 1. Der Zyklus als Datensatz.
--
-- Nur **abgeschlossene** Zyklen sind Zeilen. Der laufende ist "alles nach dem
-- letzten Ende" und braucht keine -- eine Zeile fuer ihn waere ein Zustand,
-- der mit der Liste synchron gehalten werden muesste.
-- ---------------------------------------------------------------------------
create table if not exists public.cash_cycles (
  id uuid primary key default gen_random_uuid(),
  -- Der erste Tag, der zu diesem Zyklus gehoert. Beim ersten Abschluss der
  -- Tag der aeltesten Zahlung auf der Liste, danach immer "Ende des
  -- Vorgaengers + 1 Tag". Damit ueberschneiden sich zwei Zyklen nie und es
  -- bleibt kein Tag zwischen ihnen uebrig.
  starts_on date not null,
  -- Der letzte Tag, der zu diesem Zyklus gehoert -- gewaehlt von der
  -- Verwaltung, nicht der Tag des Abschliessens.
  ends_on date not null,
  closed_at timestamptz not null default now(),
  closed_by uuid references public.profiles(id) on delete set null,
  constraint cash_cycles_zeitraum check (ends_on >= starts_on),
  -- Das Ende ist eindeutig: Der naechste Zyklus beginnt am Tag danach, also
  -- waechst `ends_on` streng. Die Bedingung sichert, dass "der juengste
  -- Zyklus" eine eindeutige Zeile ist und nicht eine Frage der Sortierung.
  constraint cash_cycles_ende_eindeutig unique (ends_on)
);

alter table public.cash_cycles enable row level security;

-- Nur die Verwaltung. Ein Kunde sieht seine Zyklen nicht (bewusst ausserhalb
-- von PROJ-98: das waere Kundentext samt englischer Fassung).
create policy "CashCycles: nur Admin lesen"
  on public.cash_cycles for select
  using (public."current_role"() = 'admin');

comment on table public.cash_cycles is
  'PROJ-98: Je Zeile ein abgeschlossener Zahlungszyklus der Barzahler -- Zeitraum, wann und von wem abgeschlossen. Der laufende Zyklus hat keine Zeile; er ist alles nach dem groessten ends_on.';

-- ---------------------------------------------------------------------------
-- 2. Die Abschrift der Liste.
--
-- Eine Abschrift ist noetig, weil der geschuldete Betrag nach dem Abschluss
-- noch geaendert werden darf und der Eintrag verschwinden kann. Abgeschrieben
-- wird nur, was sich aendern kann: Betrag und Notiz. Das **Gezahlte** steht
-- nicht hier -- es wird aus den Zahlungen gerechnet, damit eine
-- zurueckgenommene Zahlung auch im Archiv verschwindet.
-- ---------------------------------------------------------------------------
create table if not exists public.cash_cycle_entries (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cash_cycles(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  amount_due numeric not null,
  note text,
  created_at timestamptz not null default now(),
  -- `cash_entries` laesst je Abo genau eine Zeile zu, die Abschrift also auch.
  constraint cash_cycle_entries_einmal_je_abo unique (cycle_id, subscription_id)
);

alter table public.cash_cycle_entries enable row level security;

-- Das Einschalten steht ohne Zwischenzeile direkt hinter der Tabelle -- so wie
-- oben bei `cash_cycles`. Die Pruefung im Supabase-SQL-Editor meldete
-- "creates a table without enabling Row Level Security", solange hier etwas
-- dazwischen stand (zuerst die Indizes, dann dieser Kommentar). Inhaltlich ist
-- die Reihenfolge gleichgueltig; eine Sicherheitswarnung, die man wegklicken
-- muss, ist aber eine, die irgendwann weggeklickt wird, obwohl sie stimmt.
--
-- Die Leseregel: dieselbe wie an `cash_entries` -- die eigene Zeile oder als
-- Verwaltung.
create policy "CashCycleEntries: eigene lesen oder Admin"
  on public.cash_cycle_entries for select
  using ((select auth.uid()) = customer_id or public."current_role"() = 'admin');

create index if not exists cash_cycle_entries_zyklus on public.cash_cycle_entries (cycle_id);
create index if not exists cash_cycle_entries_abo on public.cash_cycle_entries (subscription_id);
create index if not exists cash_cycle_entries_kunde on public.cash_cycle_entries (customer_id);

comment on table public.cash_cycle_entries is
  'PROJ-98: Die Abschrift der Barzahler-Liste im Moment des Abschliessens -- Kunde, Abo, geschuldeter Betrag, Notiz. Das Gezahlte steht absichtlich nicht hier: Es wird aus cash_payments und dem Zeitraum des Zyklus gerechnet.';

-- ---------------------------------------------------------------------------
-- 3. Die beiden Daten, an denen alles haengt.
--
-- Zwei winzige Funktionen statt eines `max(ends_on)` an jeder Lesestelle: Die
-- Grenze zwischen "vorher" und "jetzt" steht damit an genau einer Stelle.
-- ---------------------------------------------------------------------------
create or replace function public.letztes_barzyklus_ende()
returns date
language sql
stable
security definer
set search_path to 'public'
as $$
  select max(ends_on) from cash_cycles;
$$;

comment on function public.letztes_barzyklus_ende() is
  'PROJ-98: Der letzte Tag des juengsten abgeschlossenen Barzahlungszyklus. NULL, solange keiner abgeschlossen wurde.';

create or replace function public.laufender_barzyklus_beginn()
returns date
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.letztes_barzyklus_ende() + 1;
$$;

comment on function public.laufender_barzyklus_beginn() is
  'PROJ-98: Der erste Tag des laufenden Barzahlungszyklus -- der Tag nach dem letzten Abschluss. NULL heisst "es gibt keinen Vorgaenger, alles gehoert zum laufenden Zyklus".';

-- ---------------------------------------------------------------------------
-- 4. Was an einem Eintrag im **laufenden** Zyklus bezahlt wurde.
--
-- Das ist die eigentliche Verhaltensaenderung an der Liste: Vorher war
-- "bezahlt" die Summe aller Zahlungen an diesem Eintrag. Ein Eintrag, der
-- einen Zyklus ueberlebt, haette damit die Zahlung von letztem Monat als
-- Zahlung fuer diesen Monat gezaehlt -- und waere faelschlich als bezahlt
-- dagestanden.
--
-- Umgekehrt zaehlt eine Zahlung nach dem Enddatum des letzten Zyklus hier
-- mit: Genau das war der Wunsch des Betreibers.
-- ---------------------------------------------------------------------------
-- Zwei Fenster, zwei Schluessel -- und das ist kein Versehen:
--
-- * Am **Eintrag** (`entry_id`) rechnet die laufende Liste. Dort ist die Frage
--   "was ist auf diese Zeile eingezahlt worden".
-- * Am **Abo** (`subscription_id`) rechnet das Archiv. Dort kann der Eintrag
--   laengst entfernt sein (`entry_id` wird dann NULL), die Zahlung aber steht
--   noch -- sie ist passiert.
--
-- Jedes Fenster steht genau einmal da. Wer die Zuordnung "Zahlung gehoert zum
-- Zyklus" aendert, aendert diese zwei Funktionen und sonst nichts.
create or replace function public.barzahlung_bezahlt_bis(
  p_entry_id uuid,
  p_von date,
  p_bis date
)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(z.amount), 0)
  from cash_payments z
  where z.entry_id = p_entry_id
    -- NULL heisst "kein Vorgaenger": Dann gehoert alles zum laufenden Zyklus.
    and (p_von is null or z.paid_on >= p_von)
    and z.paid_on <= p_bis;
$$;

comment on function public.barzahlung_bezahlt_bis(uuid, date, date) is
  'PROJ-98: Was an diesem Eintrag zwischen zwei Tagen bezahlt wurde. p_von NULL heisst "von Anfang an". Die eine Stelle, an der das Zyklusfenster eines Eintrags steht.';

create or replace function public.barzahlung_bezahlt_laufend(p_entry_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.barzahlung_bezahlt_bis(
    p_entry_id,
    public.laufender_barzyklus_beginn(),
    'infinity'::date
  );
$$;

comment on function public.barzahlung_bezahlt_laufend(uuid) is
  'PROJ-98: Was an diesem Eintrag im laufenden Zyklus bezahlt wurde -- Zahlungen vor dem letzten Abschluss gehoeren zum alten Zyklus und zaehlen hier nicht mit.';

create or replace function public.barzahlung_gezahlt_im_zyklus(
  p_subscription_id uuid,
  p_von date,
  p_bis date
)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(sum(z.amount), 0)
  from cash_payments z
  where z.subscription_id = p_subscription_id
    and z.paid_on between p_von and p_bis;
$$;

comment on function public.barzahlung_gezahlt_im_zyklus(uuid, date, date) is
  'PROJ-98: Was fuer dieses Abo im Zeitraum eines Zyklus gezahlt wurde -- ueber das Abo und nicht ueber den Eintrag, denn der kann entfernt sein. Die eine Stelle, an der das Zyklusfenster des Archivs steht.';

-- ---------------------------------------------------------------------------
-- 5. Der offene Rest aus dem vorigen Zyklus.
--
-- Steht in der Anzeige **neben** dem neuen Betrag und nicht darin:
-- Entscheidung des Betreibers. Eine Zahl aus zwei Zyklen ist beim Kassieren
-- nicht mehr auseinanderzunehmen.
-- ---------------------------------------------------------------------------
create or replace function public.barzahlung_rest_vorher(p_subscription_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((
    select greatest(0, round(
      a.amount_due
        - public.barzahlung_gezahlt_im_zyklus(a.subscription_id, y.starts_on, y.ends_on),
      2))
    from cash_cycle_entries a
    join cash_cycles y on y.id = a.cycle_id
    where a.subscription_id = p_subscription_id
      and y.ends_on = public.letztes_barzyklus_ende()
  ), 0);
$$;

comment on function public.barzahlung_rest_vorher(uuid) is
  'PROJ-98: Was dieses Abo aus dem juengsten abgeschlossenen Zyklus noch offen hat. 0, wenn es dort nicht auf der Liste stand oder voll bezahlt hat.';

-- ---------------------------------------------------------------------------
-- 6. Die Vorschau fuer den Abschluss-Dialog.
--
-- Beantwortet alles, was der Dialog sagen muss: wer die Liste verlaesst, wer
-- stehen bleibt, und -- der Preis aus Edge Case 1 -- wer **nach** dem
-- gewaehlten Enddatum gezahlt hat. Wer dort falsch steht, bekommt ein anderes
-- Enddatum, bevor etwas passiert.
-- ---------------------------------------------------------------------------
create or replace function public.get_cash_cycle_preview(p_ends_on date)
returns table (
  subscription_id uuid,
  customer_id uuid,
  full_name text,
  amount_due numeric,
  bezahlt_bis numeric,
  offen numeric,
  geht boolean,
  spaet_betrag numeric,
  spaet_tag date
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_beginn date := laufender_barzyklus_beginn();
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  return query
  select
    e.subscription_id,                                            -- subscription_id
    e.customer_id,                                                -- customer_id
    p.full_name,                                                  -- full_name
    e.amount_due,                                                 -- amount_due
    bis.betrag,                                                   -- bezahlt_bis
    round(e.amount_due - bis.betrag, 2),                          -- offen
    (round(e.amount_due - bis.betrag, 2) <= 0.005),               -- geht
    spaet.betrag,                                                 -- spaet_betrag
    spaet.tag                                                     -- spaet_tag
  from cash_entries e
  join profiles p on p.id = e.customer_id
  -- Bezahlt im laufenden Zyklus **bis einschliesslich** Enddatum: die eine
  -- Bedingung, die entscheidet, wer die Liste verlaesst. Dieselbe Funktion
  -- benutzt `close_cash_cycle` -- sonst sagte die Vorschau etwas anderes als
  -- der Knopf darunter tut.
  cross join lateral (
    select barzahlung_bezahlt_bis(e.id, v_beginn, p_ends_on) as betrag
  ) bis
  -- Und was danach kam. Das ist kein Fehler, sondern der haeufige Fall --
  -- genannt wird es, damit der Betreiber das Enddatum pruefen kann.
  cross join lateral (
    select coalesce(sum(z.amount), 0) as betrag, max(z.paid_on) as tag
    from cash_payments z
    where z.entry_id = e.id
      and z.paid_on > p_ends_on
  ) spaet
  order by p.full_name;
end;
$$;

comment on function public.get_cash_cycle_preview(date) is
  'PROJ-98: Was ein Abschluss mit diesem Enddatum taete -- je Eintrag, ob er die Liste verlaesst, und welche Zahlungen nach dem Enddatum liegen. Aendert nichts.';

-- ---------------------------------------------------------------------------
-- 7. Abschliessen.
--
-- Die alte Fassung ohne Parameter wird geloescht: Ein Standardwert wuerde den
-- Aufruf zweideutig machen ("function is not unique"), und ein stiller
-- Rueckfall auf das alte Verhalten -- Liste komplett loeschen -- ist genau
-- das, was hier verschwinden soll.
-- ---------------------------------------------------------------------------
drop function if exists public.close_cash_cycle();

create function public.close_cash_cycle(p_ends_on date)
returns table (
  zyklus_id uuid,
  abgeschrieben integer,
  entfernt integer,
  geblieben integer
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_beginn date := laufender_barzyklus_beginn();
  v_zyklus uuid;
  v_abgeschrieben integer;
  v_entfernt integer;
  v_gesamt integer;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  if p_ends_on is null then
    raise exception 'end date required';
  end if;

  -- Ein Zyklus, der noch laeuft, laesst sich nicht abschliessen.
  if p_ends_on > heute_wien() then
    raise exception 'end date in future';
  end if;

  if v_beginn is null then
    -- Der erste Abschluss hat keinen Vorgaenger und damit keinen Anfang.
    -- Genommen wird der Tag der aeltesten Zahlung, die an einem Eintrag der
    -- Liste haengt; gibt es keine, der Enddatum selbst. Das gibt dem Archiv
    -- ohne Zutun ein Datum, das zu den vorhandenen Daten passt.
    select min(z.paid_on) into v_beginn
    from cash_payments z
    join cash_entries e on e.id = z.entry_id;

    if v_beginn is null or v_beginn > p_ends_on then
      v_beginn := p_ends_on;
    end if;
  elsif p_ends_on < v_beginn then
    raise exception 'end date before cycle start';
  end if;

  insert into cash_cycles (starts_on, ends_on, closed_by)
  values (v_beginn, p_ends_on, auth.uid())
  returning id into v_zyklus;

  -- Die ganze Liste wird abgeschrieben, auch wer stehen bleibt: Das Archiv
  -- soll sagen, wer in diesem Zyklus auf der Liste stand -- nicht nur, wer
  -- gezahlt hat.
  insert into cash_cycle_entries (cycle_id, customer_id, subscription_id, amount_due, note)
  select v_zyklus, e.customer_id, e.subscription_id, e.amount_due, e.note
  from cash_entries e;

  v_abgeschrieben := (select count(*) from cash_cycle_entries where cycle_id = v_zyklus);
  v_gesamt := v_abgeschrieben;

  -- Die eine Regel: voll bezahlt bis einschliesslich Enddatum verlaesst die
  -- Liste. Wer danach gezahlt hat, ist bis dahin nicht voll bezahlt und bleibt
  -- deshalb stehen -- ohne zweiten Fall, ohne zweite Bedingung.
  --
  -- Das WHERE ist Pflicht: Supabase weist unqualifizierte DELETEs ab
  -- (SQLSTATE 21000), auch in einer `security definer`-Funktion. Siehe
  -- 20261014180000_proj84_zyklus_abschliessen_fix.sql.
  delete from cash_entries e
  where round(e.amount_due - barzahlung_bezahlt_bis(e.id, v_beginn, p_ends_on), 2) <= 0.005;

  get diagnostics v_entfernt = row_count;

  -- Drei Zahlen, weil es drei sind: Ins Archiv kommt die ganze Liste, von der
  -- Liste geht nur der bezahlte Teil. Eine davon zu verschweigen hiesse, den
  -- Hinweis nach dem Abschluss falsch zu machen.
  return query select
    v_zyklus,                                                     -- zyklus_id
    v_abgeschrieben,                                              -- abgeschrieben
    v_entfernt,                                                   -- entfernt
    (v_gesamt - v_entfernt);                                      -- geblieben
end;
$$;

comment on function public.close_cash_cycle(date) is
  'PROJ-98: Schliesst den laufenden Barzahlungszyklus mit dem gewaehlten Enddatum ab -- schreibt die Liste ins Archiv und nimmt genau die Eintraege weg, die bis einschliesslich Enddatum voll bezahlt sind. Nur Verwaltung.';

-- ---------------------------------------------------------------------------
-- 8. Den letzten Abschluss zuruecknehmen.
--
-- Faengt den Fehlgriff -- falsches Datum, zu frueh gedrueckt -- ohne eine
-- Zeitmaschine zu bauen. Nur der juengste Zyklus, und nur solange seither
-- nichts kassiert und kein Eintrag angelegt wurde.
--
-- Die zweite Bedingung ist nicht Vorsicht, sondern Notwendigkeit: Ein neu
-- angelegter Eintrag fuer dasselbe Abo stuende der Wiederherstellung im Weg,
-- denn `cash_entries` laesst je Abo nur eine Zeile zu.
-- ---------------------------------------------------------------------------
create or replace function public.undo_cash_cycle()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_zyklus cash_cycles;
  v_anzahl integer;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  select y.* into v_zyklus from cash_cycles y order by y.ends_on desc limit 1;
  if not found then
    raise exception 'no cycle';
  end if;

  if exists (select 1 from cash_payments z where z.created_at > v_zyklus.closed_at) then
    raise exception 'payment since close';
  end if;

  if exists (select 1 from cash_entries e where e.created_at > v_zyklus.closed_at) then
    raise exception 'entry since close';
  end if;

  -- Die entfernten Zeilen kommen zurueck ...
  insert into cash_entries (customer_id, subscription_id, amount_due, note, created_by)
  select a.customer_id, a.subscription_id, a.amount_due, a.note, v_zyklus.closed_by
  from cash_cycle_entries a
  where a.cycle_id = v_zyklus.id
    and not exists (select 1 from cash_entries e where e.subscription_id = a.subscription_id);

  -- ... und die stehengebliebenen auf ihren damaligen Stand. Zuruecknehmen
  -- heisst "die Liste steht wieder wie davor"; wer nach dem Abschluss einen
  -- Betrag fuer den neuen Zyklus eingetippt hat, soll ihn nicht behalten,
  -- wenn es diesen neuen Zyklus nicht mehr gibt.
  update cash_entries e
  set amount_due = a.amount_due, note = a.note
  from cash_cycle_entries a
  where a.cycle_id = v_zyklus.id
    and e.subscription_id = a.subscription_id
    and (e.amount_due <> a.amount_due or coalesce(e.note, '') <> coalesce(a.note, ''));

  v_anzahl := (select count(*) from cash_cycle_entries where cycle_id = v_zyklus.id);

  -- Die Abschrift geht mit (`on delete cascade`).
  delete from cash_cycles where id = v_zyklus.id;

  return v_anzahl;
end;
$$;

comment on function public.undo_cash_cycle() is
  'PROJ-98: Nimmt den juengsten Abschluss zurueck -- Liste wie davor, Zyklus aus dem Archiv. Abgewiesen, sobald seither eine Zahlung erfasst oder ein Eintrag angelegt wurde. Nur Verwaltung.';

-- ---------------------------------------------------------------------------
-- 9. Das Archiv: die Zyklen mit ihren Summen.
--
-- "Eingesammelt" und "offen geblieben" werden aus der Abschrift und den
-- Zahlungen des Zeitraums gerechnet, nicht beim Abschluss festgeschrieben:
-- Wird eine Zahlung zurueckgenommen, soll das Archiv das zeigen.
-- ---------------------------------------------------------------------------
create or replace function public.get_cash_cycles()
returns table (
  cycle_id uuid,
  starts_on date,
  ends_on date,
  closed_at timestamptz,
  closed_by_name text,
  eintraege integer,
  geschuldet numeric,
  eingesammelt numeric,
  offen numeric,
  kann_zurueck boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_juengster uuid;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  -- Mit Alias und Qualifizierung: `ends_on` ist auch der Name einer
  -- Rueckgabespalte dieser Funktion und damit einer PL/pgSQL-Variablen. Ohne
  -- `y.` waere die Erwaehnung zweideutig -- und das faellt erst beim Aufruf
  -- auf, nicht beim Einspielen.
  select y.id into v_juengster from cash_cycles y order by y.ends_on desc limit 1;

  return query
  select
    y.id,                                                         -- cycle_id
    y.starts_on,                                                  -- starts_on
    y.ends_on,                                                    -- ends_on
    y.closed_at,                                                  -- closed_at
    p.full_name,                                                  -- closed_by_name
    coalesce(a.anzahl, 0)::integer,                               -- eintraege
    coalesce(a.geschuldet, 0),                                    -- geschuldet
    coalesce(a.gezahlt, 0),                                       -- eingesammelt
    coalesce(a.offen, 0),                                         -- offen
    (
      y.id = v_juengster
      and not exists (select 1 from cash_payments z where z.created_at > y.closed_at)
      and not exists (select 1 from cash_entries e where e.created_at > y.closed_at)
    )                                                             -- kann_zurueck
  from cash_cycles y
  left join profiles p on p.id = y.closed_by
  left join lateral (
    select
      count(*) as anzahl,
      sum(ce.amount_due) as geschuldet,
      sum(barzahlung_gezahlt_im_zyklus(ce.subscription_id, y.starts_on, y.ends_on)) as gezahlt,
      sum(greatest(0, round(
        ce.amount_due
          - barzahlung_gezahlt_im_zyklus(ce.subscription_id, y.starts_on, y.ends_on),
        2))) as offen
    from cash_cycle_entries ce
    where ce.cycle_id = y.id
  ) a on true
  order by y.ends_on desc;
end;
$$;

comment on function public.get_cash_cycles() is
  'PROJ-98: Die abgeschlossenen Barzahlungszyklen mit Zeitraum, Zahl der Eintraege, geschuldeter und eingesammelter Summe -- und ob der juengste noch zuruecknehmbar ist. Nur Verwaltung.';

-- ---------------------------------------------------------------------------
-- 10. Das Archiv: die Abschrift je Eintrag.
--
-- Ein Parameter, zwei Ansichten: ohne Kunden das ganze Archiv der
-- Barzahlungsseite, mit Kunden der Abschnitt auf seiner Kundenseite. Andere
-- Richtung, dieselbe Quelle -- bei einer Reklamation ist der Kunde der
-- Einstieg, nicht der Zyklus.
-- ---------------------------------------------------------------------------
create or replace function public.get_cash_archive_entries(p_customer_id uuid default null)
returns table (
  cycle_id uuid,
  starts_on date,
  ends_on date,
  archiv_id uuid,
  customer_id uuid,
  full_name text,
  subscription_id uuid,
  subscription_name text,
  ist_flatrate boolean,
  pass_stil text,
  amount_due numeric,
  gezahlt numeric,
  note text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  return query
  select
    y.id,                                                         -- cycle_id
    y.starts_on,                                                  -- starts_on
    y.ends_on,                                                    -- ends_on
    a.id,                                                         -- archiv_id
    a.customer_id,                                                -- customer_id
    p.full_name,                                                  -- full_name
    a.subscription_id,                                            -- subscription_id
    coalesce(c.name, s.name),                                     -- subscription_name
    s.course_id is null,                                          -- ist_flatrate
    ds.name,                                                      -- pass_stil
    a.amount_due,                                                 -- amount_due
    barzahlung_gezahlt_im_zyklus(
      a.subscription_id, y.starts_on, y.ends_on),                 -- gezahlt
    a.note                                                        -- note
  from cash_cycle_entries a
  join cash_cycles y on y.id = a.cycle_id
  join profiles p on p.id = a.customer_id
  left join subscriptions s on s.id = a.subscription_id
  left join courses c on c.id = s.course_id
  left join dance_styles ds on ds.id = s.dance_style_id
  where p_customer_id is null or a.customer_id = p_customer_id
  order by y.ends_on desc, p.full_name;
end;
$$;

comment on function public.get_cash_archive_entries(uuid) is
  'PROJ-98: Die Abschriften der abgeschlossenen Zyklen -- ohne Parameter das ganze Archiv, mit Kunden nur seine Zeilen. Das Gezahlte wird aus den Zahlungen des Zeitraums gerechnet. Nur Verwaltung.';

-- ---------------------------------------------------------------------------
-- 11. Die Liste einer Kursseite -- jetzt zyklusbewusst.
--
-- Rueckgabetyp geaendert (neu: `rest_vorher`, `vorher_bis`), also loeschen und
-- neu anlegen. Zwei Aenderungen im Inhalt:
--
-- * `bezahlt`, `letzte_zahlung` und `letzte_zahlung_id` zaehlen nur noch den
--   laufenden Zyklus. Sonst stuende ein Eintrag, der einen Zyklus ueberlebt
--   hat, mit der Zahlung von letztem Monat als bezahlt da -- und die Lehrkraft
--   sammelte nichts ein.
-- * `rest_vorher` sagt, was aus dem vorigen Zyklus offen blieb, und
--   `vorher_bis`, bis wann der ging. **Daneben**, nicht im Betrag.
--
-- Jede Zeile der Auswahlliste tragt den Namen ihrer Spalte: 15 Spalten im
-- Kopf, 15 in der Auswahl (siehe .claude/rules/backend.md).
-- ---------------------------------------------------------------------------
drop function if exists public.get_course_cash_payers(uuid);

create function public.get_course_cash_payers(p_course_id uuid)
returns table (
  entry_id uuid,
  customer_id uuid,
  full_name text,
  subscription_id uuid,
  subscription_name text,
  ist_flatrate boolean,
  pass_stil text,
  eigener_kurs boolean,
  amount_due numeric,
  bezahlt numeric,
  note text,
  letzte_zahlung date,
  letzte_zahlung_id uuid,
  rest_vorher numeric,
  vorher_bis date
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_kurs_stil uuid;
  v_beginn date := laufender_barzyklus_beginn();
  v_ende date := letztes_barzyklus_ende();
begin
  if not (is_course_teacher(p_course_id) or "current_role"() = 'admin') then
    raise exception 'not authorized';
  end if;

  select c.dance_style_id into v_kurs_stil from courses c where c.id = p_course_id;

  return query
  with im_kurs as (
    select distinct cm.subscription_id
    from course_members cm
    where cm.course_id = p_course_id
  )
  select
    e.id,                                                         -- entry_id
    e.customer_id,                                                -- customer_id
    p.full_name,                                                  -- full_name
    e.subscription_id,                                            -- subscription_id
    coalesce(c.name, s.name),                                     -- subscription_name
    s.course_id is null,                                          -- ist_flatrate
    ds.name,                                                      -- pass_stil
    (k.subscription_id is not null),                              -- eigener_kurs
    e.amount_due,                                                 -- amount_due
    barzahlung_bezahlt_laufend(e.id),                             -- bezahlt
    e.note,                                                       -- note
    (select max(z.paid_on) from cash_payments z
      where z.entry_id = e.id
        and (v_beginn is null or z.paid_on >= v_beginn)),          -- letzte_zahlung
    (select z.id from cash_payments z
      where z.entry_id = e.id
        and (v_beginn is null or z.paid_on >= v_beginn)
      order by z.created_at desc limit 1),                        -- letzte_zahlung_id
    barzahlung_rest_vorher(e.subscription_id),                    -- rest_vorher
    v_ende                                                        -- vorher_bis
  from cash_entries e
  join subscriptions s on s.id = e.subscription_id
  join profiles p on p.id = e.customer_id
  left join courses c on c.id = s.course_id
  left join dance_styles ds on ds.id = s.dance_style_id
  left join im_kurs k on k.subscription_id = e.subscription_id
  where
    -- Teilnehmer dieses Kurses: immer.
    k.subscription_id is not null
    -- Kurslose Abos aus anderen Kursen: nur, soweit sie diesen Kurs decken.
    -- Dieselbe Regel wie `deckt_abo_kurs` (PROJ-93).
    or (
      s.course_id is null
      and (s.dance_style_id is null or s.dance_style_id = v_kurs_stil)
    )
  order by (k.subscription_id is null), p.full_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- 12. Erfassen und Betrag aendern rechnen mit dem laufenden Zyklus.
--
-- Beides hing an der Summe **aller** Zahlungen dieses Eintrags. Ohne diese
-- Aenderung koennte ein Eintrag, der einen Zyklus ueberlebt hat, nichts mehr
-- annehmen ("nothing open") und seinen Betrag nicht mehr senken
-- ("amount below payments") -- wegen Geld, das zu einem abgeschlossenen
-- Zyklus gehoert.
-- ---------------------------------------------------------------------------
create or replace function public.record_cash_payment(p_entry_id uuid, p_amount numeric default null)
returns cash_payments
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_eintrag cash_entries;
  v_zeile cash_payments;
  v_bezahlt numeric;
  v_offen numeric;
  v_betrag numeric;
begin
  select * into v_eintrag from cash_entries where id = p_entry_id;
  if not found then
    raise exception 'entry not found';
  end if;

  if not darf_barzahlung_fuehren(v_eintrag.subscription_id) then
    raise exception 'not authorized';
  end if;

  -- PROJ-98: nur der laufende Zyklus.
  v_bezahlt := barzahlung_bezahlt_laufend(p_entry_id);
  v_offen := round(v_eintrag.amount_due - v_bezahlt, 2);

  if v_offen <= 0 then
    raise exception 'nothing open';
  end if;

  -- Ohne Betrag der gesamte offene Rest: Der haeufige Fall bleibt ein Druck.
  v_betrag := coalesce(round(p_amount, 2), v_offen);

  if v_betrag <= 0 then
    raise exception 'amount must be positive';
  end if;

  -- Die Grenze faengt den Vertipper um drei Nullen. Wer vorauszahlen will,
  -- bekommt einen hoeheren Betrag eingetragen (Guthaben ist PROJ-44s Thema).
  if v_betrag > v_offen then
    raise exception 'amount above open';
  end if;

  insert into cash_payments (subscription_id, customer_id, amount, collected_by, entry_id)
  values (v_eintrag.subscription_id, v_eintrag.customer_id, v_betrag, auth.uid(), p_entry_id)
  returning * into v_zeile;

  return v_zeile;
end;
$$;

create or replace function public.update_cash_entry(p_entry_id uuid, p_amount numeric)
returns cash_entries
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_eintrag cash_entries;
  v_bezahlt numeric;
  v_betrag numeric := round(p_amount, 2);
begin
  select * into v_eintrag from cash_entries where id = p_entry_id;
  if not found then
    raise exception 'entry not found';
  end if;

  if not darf_barzahlung_fuehren(v_eintrag.subscription_id) then
    raise exception 'not authorized';
  end if;

  if v_betrag is null or v_betrag <= 0 or v_betrag > 10000 then
    raise exception 'amount out of range';
  end if;

  -- PROJ-98: nur der laufende Zyklus. Ein Betrag unter dem, was in einem
  -- abgeschlossenen Zyklus gezahlt wurde, ist kein Widerspruch.
  v_bezahlt := barzahlung_bezahlt_laufend(p_entry_id);

  if v_betrag < v_bezahlt then
    raise exception 'amount below payments';
  end if;

  update cash_entries set amount_due = v_betrag where id = p_entry_id
  returning * into v_eintrag;

  return v_eintrag;
end;
$$;

-- ---------------------------------------------------------------------------
-- 13. Rechte.
--
-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
-- ---------------------------------------------------------------------------
revoke all on function public.letztes_barzyklus_ende() from public, anon;
revoke all on function public.laufender_barzyklus_beginn() from public, anon;
revoke all on function public.barzahlung_bezahlt_bis(uuid, date, date) from public, anon;
revoke all on function public.barzahlung_bezahlt_laufend(uuid) from public, anon;
revoke all on function public.barzahlung_gezahlt_im_zyklus(uuid, date, date) from public, anon;
revoke all on function public.barzahlung_rest_vorher(uuid) from public, anon;
revoke all on function public.get_cash_cycle_preview(date) from public, anon;
revoke all on function public.close_cash_cycle(date) from public, anon;
revoke all on function public.undo_cash_cycle() from public, anon;
revoke all on function public.get_cash_cycles() from public, anon;
revoke all on function public.get_cash_archive_entries(uuid) from public, anon;
revoke all on function public.get_course_cash_payers(uuid) from public, anon;
revoke all on function public.record_cash_payment(uuid, numeric) from public, anon;
revoke all on function public.update_cash_entry(uuid, numeric) from public, anon;

grant execute on function public.letztes_barzyklus_ende() to authenticated;
grant execute on function public.laufender_barzyklus_beginn() to authenticated;
grant execute on function public.barzahlung_bezahlt_bis(uuid, date, date) to authenticated;
grant execute on function public.barzahlung_bezahlt_laufend(uuid) to authenticated;
grant execute on function public.barzahlung_gezahlt_im_zyklus(uuid, date, date) to authenticated;
grant execute on function public.barzahlung_rest_vorher(uuid) to authenticated;
grant execute on function public.get_cash_cycle_preview(date) to authenticated;
grant execute on function public.close_cash_cycle(date) to authenticated;
grant execute on function public.undo_cash_cycle() to authenticated;
grant execute on function public.get_cash_cycles() to authenticated;
grant execute on function public.get_cash_archive_entries(uuid) to authenticated;
grant execute on function public.get_course_cash_payers(uuid) to authenticated;
grant execute on function public.record_cash_payment(uuid, numeric) to authenticated;
grant execute on function public.update_cash_entry(uuid, numeric) to authenticated;
