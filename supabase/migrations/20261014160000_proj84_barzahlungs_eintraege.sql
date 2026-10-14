-- PROJ-84: Barzahlungen als Eintraege von Hand.
--
-- Nimmt PROJ-83 zurueck. Dort wurde "wer zahlt bar und wie viel" abgeleitet:
-- kein Mandat heisst Barzahler, das Soll entstand aus Zyklus, Preis und Ferien,
-- ein taeglicher Lauf schrieb die Zeilen, ein Stichtag grenzte ab. Das ist mehr
-- Mechanik als die Aufgabe hat, und sie entscheidet Dinge, die der Betreiber
-- selbst entscheiden will.
--
-- Ab hier ist ein Eintrag eine Zeile auf einer Liste: Kunde, Abo, Betrag.
-- Daran haengen die Zahlungen. Offen ist, was fehlt. Entfernt wird von Hand.
-- In der Datenbank steckt danach keine Datumsregel mehr.

-- 1. Was PROJ-83 eingefuehrt hat, geht wieder weg.
--
-- Die Reihenfolge ist Absicht: Die Sicht haengt an der Tabelle, und die
-- Funktionen hingen an der Sicht.
drop function if exists public.get_course_cash_payers(uuid);
drop function if exists public.record_cash_payment(uuid, numeric);
drop view if exists public.cash_ledger;
drop table if exists public.cash_dues;

-- 2. Die Liste.
create table if not exists public.cash_entries (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  -- Das gewaehlte Abo: ein Kursabo oder eine Flatrate. Woran der Eintrag
  -- haengt, ist eine Entscheidung des Eintragenden und keine Herleitung.
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  -- Was dieser Mensch in diesem Zyklus zahlen soll -- von Hand gesetzt.
  amount_due numeric not null check (amount_due > 0 and amount_due <= 10000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Zwei Eintraege fuer dasselbe Abo waeren zwei Antworten auf "wie viel
  -- schuldet er". Die Liste soll genau eine geben.
  constraint cash_entries_einmal_je_abo unique (subscription_id)
);

create index if not exists cash_entries_kunde on public.cash_entries (customer_id);

alter table public.cash_entries enable row level security;

-- Lesen: die eigene Zeile oder als Verwaltung. Lehrkraefte lesen ueber
-- `get_course_cash_payers` -- in `subscriptions` und `sepa_mandates` stehen
-- Dinge, die sie nicht sehen sollen, und die Pruefung "Lehrkraft dieses
-- Kurses" ist in einer Regel nicht zu haben.
create policy "CashEntries: eigene lesen oder Admin"
  on public.cash_entries for select
  using ((select auth.uid()) = customer_id or public."current_role"() = 'admin');

comment on table public.cash_entries is
  'PROJ-84: Je Zeile ein Barzahler fuer den laufenden Zyklus -- Kunde, Abo, Betrag. Von Hand angelegt und von Hand entfernt; die App rechnet keine Faelligkeiten.';

-- 3. Zahlungen haengen am Eintrag, ueberleben ihn aber.
--
-- Ein Eintrag ist eine Absicht, eine Zahlung eine Tatsache. Beim Aufraeumen
-- verschwindet die Absicht; der Nachweis bleibt stehen, nur ohne Bezug.
alter table public.cash_payments
  add column if not exists entry_id uuid references public.cash_entries(id) on delete set null;

create index if not exists cash_payments_eintrag on public.cash_payments (entry_id);

-- 4. Wer darf an diesem Abo etwas tun?
--
-- Zwei Faelle: Bei einem Kursabo die Lehrkraft genau dieses Kurses. Bei einer
-- Flatrate jede Lehrkraft -- ein Flatrater kann in jedem Kurs auftauchen, und
-- der eingeklappte Abschnitt dort waere sonst sichtbar, aber nicht bedienbar.
create or replace function public.darf_barzahlung_fuehren(p_subscription_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when public."current_role"() = 'admin' then true
    when public."current_role"() <> 'teacher' then false
    when (select s.course_id from subscriptions s where s.id = p_subscription_id) is null then true
    else exists (
      select 1 from course_members cm
      where cm.subscription_id = p_subscription_id and public.is_course_teacher(cm.course_id)
    )
  end;
$$;

comment on function public.darf_barzahlung_fuehren(uuid) is
  'PROJ-84: Admin immer; Lehrkraft bei einer Flatrate immer, bei einem Kursabo nur fuer ihren Kurs.';

-- 5. Einen Eintrag anlegen.
create or replace function public.add_cash_entry(p_subscription_id uuid, p_amount numeric)
returns cash_entries
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_abo subscriptions;
  v_zeile cash_entries;
  v_betrag numeric := round(p_amount, 2);
begin
  select * into v_abo from subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'subscription not found';
  end if;

  if not darf_barzahlung_fuehren(p_subscription_id) then
    raise exception 'not authorized';
  end if;

  if v_betrag is null or v_betrag <= 0 then
    raise exception 'amount must be positive';
  end if;
  if v_betrag > 10000 then
    raise exception 'amount too high';
  end if;

  if exists (select 1 from cash_entries where subscription_id = p_subscription_id) then
    raise exception 'entry already exists';
  end if;

  insert into cash_entries (customer_id, subscription_id, amount_due, created_by)
  values (v_abo.customer_id, p_subscription_id, v_betrag, auth.uid())
  returning * into v_zeile;

  return v_zeile;
end;
$$;

-- 6. Den Betrag nachtraeglich aendern.
--
-- Nie unter das, was schon bezahlt ist: Sonst stuende dort ein negativer
-- offener Betrag, und niemand koennte sagen, was das bedeuten soll.
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

  select coalesce(sum(amount), 0) into v_bezahlt
    from cash_payments where entry_id = p_entry_id;

  if v_betrag < v_bezahlt then
    raise exception 'amount below payments';
  end if;

  update cash_entries set amount_due = v_betrag where id = p_entry_id
  returning * into v_eintrag;

  return v_eintrag;
end;
$$;

-- 7. Einen Eintrag entfernen. Die Zahlungen bleiben (on delete set null).
create or replace function public.remove_cash_entry(p_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_eintrag cash_entries;
begin
  select * into v_eintrag from cash_entries where id = p_entry_id;
  if not found then
    raise exception 'entry not found';
  end if;

  if not darf_barzahlung_fuehren(v_eintrag.subscription_id) then
    raise exception 'not authorized';
  end if;

  delete from cash_entries where id = p_entry_id;
  return true;
end;
$$;

-- 8. Zyklus abschliessen: die ganze Liste leeren.
--
-- Nur die Verwaltung. Eine Lehrkraft, die einen eigenen Eintrag loeschen darf,
-- soll nicht versehentlich die Liste aller Kurse leeren.
create or replace function public.close_cash_cycle()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_anzahl integer;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  select count(*) into v_anzahl from cash_entries;
  delete from cash_entries;
  return v_anzahl;
end;
$$;

-- 9. Eine Zahlung erfassen -- am Eintrag, in beliebiger Hoehe.
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

  select coalesce(sum(amount), 0) into v_bezahlt
    from cash_payments where entry_id = p_entry_id;
  v_offen := round(v_eintrag.amount_due - v_bezahlt, 2);

  if v_offen <= 0 then
    raise exception 'nothing open';
  end if;

  -- Ohne Betrag der gesamte offene Rest: Der haeufige Fall bleibt ein Druck.
  v_betrag := coalesce(round(p_amount, 2), v_offen);

  if v_betrag <= 0 then
    raise exception 'amount must be positive';
  end if;

  -- Ohne Zyklus gibt es kein "naechstes Mal", mit dem ein Guthaben verrechnet
  -- wuerde. Zugleich faengt die Grenze den Vertipper um drei Nullen. Wer
  -- vorauszahlen will, bekommt einen hoeheren Betrag eingetragen.
  if v_betrag > v_offen then
    raise exception 'amount above open';
  end if;

  insert into cash_payments (subscription_id, customer_id, amount, collected_by, entry_id)
  values (v_eintrag.subscription_id, v_eintrag.customer_id, v_betrag, auth.uid(), p_entry_id)
  returning * into v_zeile;

  return v_zeile;
end;
$$;

-- 10. Eine Zahlung zuruecknehmen.
--
-- Anders als in PROJ-81 ohne Tagesgrenze fuer die Lehrkraft: Der Betreiber hat
-- entschieden, dass beide Rollen dasselbe duerfen.
create or replace function public.undo_cash_payment(p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_zahlung cash_payments;
begin
  select * into v_zahlung from cash_payments where id = p_payment_id;
  if not found then
    raise exception 'cash payment not found';
  end if;

  if not darf_barzahlung_fuehren(v_zahlung.subscription_id) then
    raise exception 'not authorized';
  end if;

  delete from cash_payments where id = p_payment_id;
  return true;
end;
$$;

-- 11. Die Liste fuer eine Kursseite.
--
-- Zwei Gruppen in einer Antwort: `eigener_kurs` sind die Eintraege der
-- Teilnehmer dieses Kurses, der Rest sind Flatrate-Eintraege von Leuten, die
-- hier nicht angemeldet sind -- die stehen in jedem Kurs, eingeklappt, weil ein
-- Flatrater in jedem Kurs auftauchen kann.
--
-- Kursabo-Eintraege fremder Kurse kommen nicht mit: Sie gehoeren zu einem
-- Abend, an dem diese Lehrkraft nicht steht.
create or replace function public.get_course_cash_payers(p_course_id uuid)
returns table (
  entry_id uuid,
  customer_id uuid,
  full_name text,
  subscription_id uuid,
  subscription_name text,
  ist_flatrate boolean,
  eigener_kurs boolean,
  amount_due numeric,
  bezahlt numeric,
  letzte_zahlung date,
  letzte_zahlung_id uuid
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
  with im_kurs as (
    select distinct cm.subscription_id
    from course_members cm
    where cm.course_id = p_course_id
  )
  select
    e.id,
    e.customer_id,
    p.full_name,
    e.subscription_id,
    coalesce(c.name, s.name),
    s.course_id is null as ist_flatrate,
    (k.subscription_id is not null) as eigener_kurs,
    e.amount_due,
    coalesce((select sum(z.amount) from cash_payments z where z.entry_id = e.id), 0),
    (select max(z.paid_on) from cash_payments z where z.entry_id = e.id),
    (select z.id from cash_payments z where z.entry_id = e.id
      order by z.created_at desc limit 1)
  from cash_entries e
  join subscriptions s on s.id = e.subscription_id
  join profiles p on p.id = e.customer_id
  left join courses c on c.id = s.course_id
  left join im_kurs k on k.subscription_id = e.subscription_id
  where k.subscription_id is not null or s.course_id is null
  order by (k.subscription_id is null), p.full_name;
end;
$$;

-- 12. Wen kann die Lehrkraft hier noch eintragen?
--
-- Die Teilnehmer dieses Kurses, die noch nicht auf der Liste stehen -- mit dem
-- Preis ihres Abos als Vorschlag fuer den Betrag. Ueber eine Funktion, weil
-- `subscriptions` fuer eine Lehrkraft gesperrt ist.
create or replace function public.get_course_cash_candidates(p_course_id uuid)
returns table (
  customer_id uuid,
  full_name text,
  subscription_id uuid,
  subscription_name text,
  ist_flatrate boolean,
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
    s.price
  from course_members cm
  join subscriptions s on s.id = cm.subscription_id
  join profiles p on p.id = cm.customer_id
  left join courses c on c.id = s.course_id
  where cm.course_id = p_course_id
    and not exists (select 1 from cash_entries e where e.subscription_id = s.id)
  order by p.full_name;
end;
$$;

-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.darf_barzahlung_fuehren(uuid) from public, anon;
revoke all on function public.add_cash_entry(uuid, numeric) from public, anon;
revoke all on function public.update_cash_entry(uuid, numeric) from public, anon;
revoke all on function public.remove_cash_entry(uuid) from public, anon;
revoke all on function public.close_cash_cycle() from public, anon;
revoke all on function public.record_cash_payment(uuid, numeric) from public, anon;
revoke all on function public.undo_cash_payment(uuid) from public, anon;
revoke all on function public.get_course_cash_payers(uuid) from public, anon;
revoke all on function public.get_course_cash_candidates(uuid) from public, anon;

grant execute on function public.darf_barzahlung_fuehren(uuid) to authenticated;
grant execute on function public.add_cash_entry(uuid, numeric) to authenticated;
grant execute on function public.update_cash_entry(uuid, numeric) to authenticated;
grant execute on function public.remove_cash_entry(uuid) to authenticated;
grant execute on function public.close_cash_cycle() to authenticated;
grant execute on function public.record_cash_payment(uuid, numeric) to authenticated;
grant execute on function public.undo_cash_payment(uuid) to authenticated;
grant execute on function public.get_course_cash_payers(uuid) to authenticated;
grant execute on function public.get_course_cash_candidates(uuid) to authenticated;

comment on table public.cash_payments is
  'PROJ-81/84: Je Zeile eine eingesammelte Barzahlung, in beliebiger Hoehe. Haengt am Eintrag (cash_entries) und bleibt stehen, wenn der entfernt wird.';
