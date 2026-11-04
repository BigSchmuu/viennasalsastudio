-- PROJ-95: Der Pass als Auswahl bei den Barzahlern.
--
-- Hintergrund: Seit PROJ-93 gibt es den Stil-Pass -- technisch "ein Abo ohne
-- Kurs mit Stilgrenze" (`course_id is null`, `dance_style_id` gesetzt). Die
-- Barzahler-Listen kennen dagegen nur zwei Arten und erkennen die Flatrate an
-- genau einem Merkmal: `s.course_id is null`. Auf einen Pass trifft das
-- genauso zu. Daraus folgen die beiden Fehler, die diese Migration behebt.
--
-- 1. Ein Pass wird als "Flatrate" beschriftet. Die Lehrkraft sammelt Geld ein
--    und liest am Eintrag das falsche Produkt ab.
-- 2. Ein Pass erscheint in der eingeklappten Gruppe *jedes* Kurses, auch bei
--    einer anderen Stilrichtung. Die Gruppe gibt es, damit ein Flatrater, der
--    vorbeikommt, hier zahlen kann -- ein Bachata-Pass hat in einem
--    Salsa-Kurs aber nichts zu suchen.
--
-- Fehler 2 besteht streng genommen schon seit PROJ-93, nur fiel er nicht auf,
-- weil ein Pass-Kunde bisher kaum auf einer Barzahler-Liste landet.
--
-- Die Deckungsfrage wird **nicht** neu erfunden. Sie steht wortgleich in
-- `deckt_abo_kurs` (PROJ-93):
--
--     s.dance_style_id is null or s.dance_style_id = c.dance_style_id
--
-- Eine Flatrate (`dance_style_id is null`) deckt jeden Kurs; ein Pass nur
-- seinen Stil. Hat der Kurs selbst keinen Stil, deckt ihn kein Pass -- der
-- Vergleich mit NULL ist niemals wahr, und das ist hier die richtige Antwort.
-- Wer die eine Regel aendert, muss die andere mitaendern; der Hinweis steht in
-- beiden Funktionen.

-- 1. Wer steht auf der Liste dieses Kurses?
--
-- Rueckgabetyp geaendert (neu: `pass_stil`), also loeschen und neu anlegen.
drop function if exists public.get_course_cash_payers(uuid);

create function public.get_course_cash_payers(p_course_id uuid)
returns table (
  entry_id uuid,
  customer_id uuid,
  full_name text,
  subscription_id uuid,
  subscription_name text,
  ist_flatrate boolean,
  -- PROJ-95: Der Name der Stilrichtung, wenn dieses Abo ein Pass ist, sonst
  -- NULL. Daran unterscheidet die Anzeige Pass von Flatrate -- `ist_flatrate`
  -- allein kann es nicht, weil beide kurslos sind.
  pass_stil text,
  eigener_kurs boolean,
  amount_due numeric,
  bezahlt numeric,
  note text,
  letzte_zahlung date,
  letzte_zahlung_id uuid
)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_kurs_stil uuid;
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
    e.id,
    e.customer_id,
    p.full_name,
    coalesce(c.name, s.name),
    s.course_id is null as ist_flatrate,
    ds.name,
    (k.subscription_id is not null) as eigener_kurs,
    e.amount_due,
    coalesce((select sum(z.amount) from cash_payments z where z.entry_id = e.id), 0),
    e.note,
    (select max(z.paid_on) from cash_payments z where z.entry_id = e.id),
    (select z.id from cash_payments z where z.entry_id = e.id
      order by z.created_at desc limit 1)
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
    -- Dieselbe Regel wie `deckt_abo_kurs` (PROJ-93), siehe Kopf der Migration.
    or (
      s.course_id is null
      and (s.dance_style_id is null or s.dance_style_id = v_kurs_stil)
    )
  order by (k.subscription_id is null), p.full_name;
end;
$$;

-- 2. Wen kann die Lehrkraft hier noch eintragen?
--
-- Die Auswahl hing immer an `course_members`, also an einem echten Kursplatz --
-- die Stilgrenze wirkt hier schon richtig und braucht keine Bedingung. Neu ist
-- allein, dass die Zeile sagen kann, ob sie ein Pass ist; sonst stand in der
-- Auswahlliste "Flatrate" an einem Pass.
drop function if exists public.get_course_cash_candidates(uuid);

create function public.get_course_cash_candidates(p_course_id uuid)
returns table (
  customer_id uuid,
  full_name text,
  subscription_id uuid,
  subscription_name text,
  ist_flatrate boolean,
  pass_stil text,
  price numeric
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not (is_course_teacher(p_course_id) or "current_role"() = 'admin') then
    raise exception 'not authorized';
  end if;

  return query
  select distinct
    cm.customer_id,
    p.full_name,
    s.id,
    coalesce(c.name, s.name),
    s.course_id is null as ist_flatrate,
    ds.name,
    s.price
  from course_members cm
  join subscriptions s on s.id = cm.subscription_id
  join profiles p on p.id = cm.customer_id
  left join courses c on c.id = s.course_id
  left join dance_styles ds on ds.id = s.dance_style_id
  where cm.course_id = p_course_id
    and not exists (select 1 from cash_entries e where e.subscription_id = s.id)
  order by p.full_name;
end;
$$;

-- Neu angelegte Funktionen haben die Rechte der Vorgaenger nicht, und Supabase
-- vergibt EXECUTE per Default-Privileg an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.get_course_cash_payers(uuid) from public, anon;
revoke all on function public.get_course_cash_candidates(uuid) from public, anon;

grant execute on function public.get_course_cash_payers(uuid) to authenticated;
grant execute on function public.get_course_cash_candidates(uuid) to authenticated;

-- Der Gegenhinweis an der Zwillingsfunktion: Wer die Deckungsregel dort
-- aendert, muss `get_course_cash_payers` mitaendern. Die Regel steht dort als
-- Funktion, hier als Bedingung in einem `where` -- deshalb finden sich die
-- beiden nur, wenn sie aufeinander zeigen.
comment on function public.deckt_abo_kurs(uuid, uuid) is
  'PROJ-93: Welches kurslose Abo deckt diesen Kurs -- die volle Flatrate jeden, ein Pass nur Kurse seiner Stilrichtung. NULL = keines. PROJ-95: Dieselbe Regel steckt als where-Bedingung in get_course_cash_payers; beide zusammen aendern.';
