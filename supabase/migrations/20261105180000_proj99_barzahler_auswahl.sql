-- PROJ-99: Die Auswahl beim Eintragen -- gedeckte Abos und die Zahler des
-- vorigen Zyklus.
--
-- Zwei Luecken in `get_course_cash_candidates`, und die erste ist die ernstere.
--
-- Befund 1: Die Auswahl fragte nur nach `course_members`, also nach einem
-- eingetragenen Kursplatz. Ein Pass-Inhaber hat ein Abo **ohne** Kurs -- er
-- stand dort also nur, wenn fuer ihn ausserdem ein Kursplatz eingetragen
-- wurde. Fehlte der, konnte die Lehrkraft ihn nicht auswaehlen. Was sie dann
-- tut, ist der eigentliche Schaden: Sie legt ihn als neuen Gast an, und
-- PROJ-82 erzeugt dabei einen echten Kunden samt Profil, Abo und Kursplatz.
-- Die Person ist danach zweimal im System, und Anwesenheit, Kursgrenze und
-- Auswertung zaehlen sie doppelt.
--
-- Die Regel, nach der ein kursloses Abo einen Kurs deckt, gibt es seit
-- PROJ-93: `deckt_abo_kurs` -- die volle Flatrate deckt jeden Kurs, ein Pass
-- nur Kurse seiner Stilrichtung. Nach ihr erscheinen Paesse seit PROJ-95
-- bereits eingeklappt *in der Liste*. Nur die Auswahl kannte sie nicht: zwei
-- Antworten auf "wer gehoert hier dazu", und nur eine war richtig.
--
-- Benutzt wird deshalb die **Funktion** und nicht eine Kopie ihrer Bedingung.
-- Die Regel steht schon an zwei Stellen -- als Funktion und als
-- `where`-Bedingung in `get_course_cash_payers` --, und der Kommentar an der
-- Funktion verlangt, beide zusammen zu aendern. Eine dritte Kopie waere die,
-- die beim naechsten Mal vergessen wird.
--
-- Befund 2: Nach einem Abschluss (PROJ-98) ist die Liste fast leer, und die
-- Stammzahler muessen wieder eingetragen werden -- jeder einzeln aus einer
-- Auswahl ohne Gedaechtnis dafuer, wer letzten Monat bar gezahlt hat. Dafuer
-- sagt die Auswahl jetzt, was ein Abo im vorigen Zyklus schuldete. Die
-- Oberflaeche fuehrt diese Leute in einer eigenen Gruppe oben und belegt den
-- Betrag vor. Kein Sammelknopf: Entscheidung des Betreibers -- bei Geld lieber
-- jede Zeile einmal angesehen, und wer aufgehoert hat, faellt so von selbst
-- auf.
--
-- Was die Auswahl **nicht** tut: niemandem ein Abo andichten. Es bleibt bei
-- aktiven Abos, und wer schon auf der Liste steht, erscheint nicht.

-- Rueckgabetyp geaendert (neu: `voriger_betrag`), also loeschen und neu
-- anlegen.
drop function if exists public.get_course_cash_candidates(uuid);

create function public.get_course_cash_candidates(p_course_id uuid)
returns table (
  customer_id uuid,
  full_name text,
  subscription_id uuid,
  subscription_name text,
  ist_flatrate boolean,
  pass_stil text,
  price numeric,
  voriger_betrag numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not (is_course_teacher(p_course_id) or "current_role"() = 'admin') then
    raise exception 'not authorized';
  end if;

  -- Die Spalten der Zwischentabellen heissen `abo_id` und nicht
  -- `subscription_id`: Die Spalten des Rueckgabetyps sind in PL/pgSQL
  -- gleichnamige Variablen, und eine unqualifizierte Erwaehnung waere
  -- zweideutig ("column reference is ambiguous").
  return query
  with im_kurs as (
    -- Teilnehmer dieses Kurses -- unveraendert zu PROJ-84.
    select distinct cm.subscription_id as abo_id
    from course_members cm
    where cm.course_id = p_course_id
  ),
  gedeckt as (
    -- PROJ-99: Kurslose Abos, die diesen Kurs decken. Ueber die Funktion
    -- (siehe Kopf). Sie liefert je Kunde das deckende Abo oder NULL.
    select distinct deckt_abo_kurs(s.customer_id, p_course_id) as abo_id
    from subscriptions s
    where s.course_id is null
      and s.status = 'active'
  ),
  auswahl as (
    select im_kurs.abo_id from im_kurs
    union
    select gedeckt.abo_id from gedeckt where gedeckt.abo_id is not null
  )
  select
    s.customer_id,                                                -- customer_id
    p.full_name,                                                  -- full_name
    s.id,                                                         -- subscription_id
    coalesce(c.name, s.name),                                     -- subscription_name
    s.course_id is null,                                          -- ist_flatrate
    ds.name,                                                      -- pass_stil
    s.price,                                                      -- price
    -- PROJ-99: Was dieses Abo im juengsten abgeschlossenen Zyklus schuldete.
    -- NULL heisst "stand dort nicht drauf" -- daran erkennt die Oberflaeche
    -- die Gruppe, und derselbe Wert ist der Vorschlag fuer den Betrag.
    (select a.amount_due
       from cash_cycle_entries a
       join cash_cycles y on y.id = a.cycle_id
      where a.subscription_id = s.id
        and y.ends_on = public.letztes_barzyklus_ende()
      limit 1)                                                    -- voriger_betrag
  from auswahl w
  join subscriptions s on s.id = w.abo_id
  join profiles p on p.id = s.customer_id
  left join courses c on c.id = s.course_id
  left join dance_styles ds on ds.id = s.dance_style_id
  where s.status = 'active'
    and not exists (select 1 from cash_entries e where e.subscription_id = s.id)
  order by p.full_name;
end;
$$;

comment on function public.get_course_cash_candidates(uuid) is
  'PROJ-84/95/99: Wen die Lehrkraft in diesem Kurs noch eintragen kann -- Teilnehmer des Kurses und kurslose Abos, die ihn nach deckt_abo_kurs decken. voriger_betrag nennt den Betrag aus dem juengsten abgeschlossenen Zyklus (PROJ-98), NULL wenn das Abo dort nicht auf der Liste stand.';

-- Der Hinweis an der Deckungsregel wird genauer: Die Auswahl benutzt jetzt die
-- Funktion, die Liste traegt weiter eine Kopie als `where`-Bedingung. Wer die
-- Regel aendert, muss also genau eine zweite Stelle mitaendern -- und die steht
-- hier namentlich, damit sie nicht gesucht werden muss.
comment on function public.deckt_abo_kurs(uuid, uuid) is
  'PROJ-93: Welches kurslose Abo deckt diesen Kurs -- die volle Flatrate jeden, ein Pass nur Kurse seiner Stilrichtung. NULL = keines. PROJ-95/99: Dieselbe Regel steckt als where-Bedingung in get_course_cash_payers (beide zusammen aendern); get_course_cash_candidates benutzt diese Funktion und ist damit keine weitere Kopie.';

-- Neu angelegte Funktionen haben die Rechte der Vorgaenger nicht, und Supabase
-- vergibt EXECUTE per Default-Privileg an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.get_course_cash_candidates(uuid) from public, anon;
grant execute on function public.get_course_cash_candidates(uuid) to authenticated;
