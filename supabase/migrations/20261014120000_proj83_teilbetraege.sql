-- PROJ-83: Barzahlungen in Teilbetraegen.
--
-- Bis hierher war "bezahlt" eine Datumsfrage: Gibt es in diesem Zyklus eine
-- Zahlung? Betraege spielten keine Rolle, und ein Waechter verbot die zweite
-- Zahlung innerhalb von 28 Tagen. Wer 40 von 89 Euro gibt, liess sich damit
-- nicht erfassen -- die Zahlung landete wieder auf einem Zettel.
--
-- Ab hier gilt je Abo Soll minus Haben. Das Soll entsteht als Zeile an jedem
-- Faelligkeitstag, das Haben ist jede erfasste Zahlung in beliebiger Hoehe.
-- Ein Rest wandert damit von selbst mit, eine Ueberzahlung deckt den naechsten
-- Beitrag ab.

-- 1. Die Soll-Seite.
--
-- Als Zeilen und nicht als Rechnung beim Lesen: Eine Pause erzeugt keine Zeile,
-- eine Preisaenderung laesst alte Zeilen unberuehrt, und der Stichtag ist
-- schlicht "keine Zeile davor". Vor allem ist der Betrag nachvollziehbar --
-- woraus 138 Euro bestehen, sind zwei Zeilen und keine Herleitung.
create table if not exists public.cash_dues (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  due_on date not null,
  -- Der Preis **dieses Tages**. Eine Erhoehung wirkt vorwaerts; die Zeilen
  -- davor bleiben, wie sie waren.
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now(),
  -- Macht den Morgenlauf wiederholbar: Ein ausgefallener Lauf holt nach, ein
  -- doppelter schreibt nichts Zweites.
  constraint cash_dues_einmal_je_tag unique (subscription_id, due_on)
);

create index if not exists cash_dues_abo on public.cash_dues (subscription_id, due_on desc);

alter table public.cash_dues enable row level security;

-- Lesen wie bei den Zahlungen: die eigenen oder als Verwaltung. Geschrieben
-- wird ausschliesslich vom Morgenlauf mit dem Dienstschluessel -- es gibt
-- bewusst keine Schreibregel, die eine Soll-Zeile von Hand erlaubt.
create policy "CashDues: eigene lesen oder Admin"
  on public.cash_dues for select
  using ((select auth.uid()) = customer_id or public."current_role"() = 'admin');

comment on table public.cash_dues is
  'PROJ-83: Je Zeile ein faellig gewordener Beitrag eines Barzahlers. Erzeugt im Morgenlauf; nur solange kein SEPA-Mandat besteht. Kein Eintrag vor dem Stichtag (lib/barzahlungen/soll-nachtragen.ts).';

-- 2. Der Saldo -- an **einer** Stelle.
--
-- Lehreransicht und Verwaltung muessen dieselbe Zahl zeigen; zwei Rechnungen
-- driften. Die Verwaltung liest die Sicht direkt (als Admin sieht sie alles),
-- `get_course_cash_payers` liest sie als `security definer` fuer die Lehrkraft,
-- die `subscriptions` und `sepa_mandates` nicht lesen darf.
create or replace view public.cash_ledger with (security_invoker = true) as
with bewegungen as (
  select subscription_id, customer_id, amount as soll, 0::numeric as haben
  from public.cash_dues
  union all
  select subscription_id, customer_id, 0::numeric as soll, amount as haben
  from public.cash_payments
)
select
  subscription_id,
  customer_id,
  sum(soll) as soll,
  sum(haben) as haben,
  -- Groesser als null heisst offen, kleiner als null ist Guthaben.
  sum(soll) - sum(haben) as saldo
from bewegungen
group by subscription_id, customer_id;

comment on view public.cash_ledger is
  'PROJ-83: Soll, Haben und Saldo je Abo aus cash_dues und cash_payments. security_invoker: Die Verwaltung sieht alles, ein Kunde seine eigene Zeile.';

revoke all on public.cash_ledger from public, anon;
grant select on public.cash_ledger to authenticated;

-- 3. Der Waechter wechselt die Aufgabe.
--
-- Er verbot bisher die zweite Zahlung im Zyklus -- genau das soll jetzt
-- moeglich sein. Was bleibt, ist der Schutz gegen den doppelten Druck auf den
-- Knopf: gleiches Abo, gleicher Betrag, gleicher Tag, innerhalb von zwei
-- Minuten. Zwei echte Teilzahlungen am selben Tag bleiben erlaubt und
-- addieren sich.
create or replace function public.cash_payment_kein_doppeltipp()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if exists (
    select 1 from cash_payments
    where subscription_id = new.subscription_id
      and id is distinct from new.id
      and paid_on = new.paid_on
      and amount = new.amount
      and created_at > now() - interval '2 minutes'
  ) then
    raise exception 'cash payment just recorded';
  end if;
  return new;
end;
$$;

drop trigger if exists cash_payments_nicht_doppelt on public.cash_payments;
drop function if exists public.cash_payment_nicht_doppelt();

drop trigger if exists cash_payments_kein_doppeltipp on public.cash_payments;
create trigger cash_payments_kein_doppeltipp
  before insert or update on public.cash_payments
  for each row execute function public.cash_payment_kein_doppeltipp();

-- 4. Erfassen -- jetzt mit Betrag.
--
-- Ein Parameter mehr heisst in Postgres eine Ueberladung, und mit Standardwert
-- waere der einstellige Aufruf zweideutig ("function is not unique"). Also
-- loeschen und neu anlegen, mit neu erteilten Rechten darunter.
drop function if exists public.record_cash_payment(uuid);

create function public.record_cash_payment(p_subscription_id uuid, p_amount numeric default null)
returns cash_payments
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_abo subscriptions;
  v_zeile cash_payments;
  v_darf boolean;
  v_offen numeric;
  v_betrag numeric;
begin
  select * into v_abo from subscriptions where id = p_subscription_id;
  if not found then
    raise exception 'subscription not found';
  end if;

  -- Lehrkraft eines Kurses, in dem dieses Abo einen Platz hat -- oder Admin.
  select "current_role"() = 'admin'
    or exists (
      select 1 from course_members cm
      where cm.subscription_id = p_subscription_id and is_course_teacher(cm.course_id)
    )
  into v_darf;

  if not v_darf then
    raise exception 'not authorized';
  end if;

  select coalesce(saldo, 0) into v_offen from cash_ledger where subscription_id = p_subscription_id;
  v_offen := coalesce(v_offen, 0);

  if p_amount is null then
    -- Ohne Betrag: der **gesamte** offene Betrag. Der haeufige Fall bleibt ein
    -- Druck. Stuende dort der Zyklusbeitrag, blieb bei einer Restschuld etwas
    -- stehen, das niemand erwartet.
    if v_abo.price is null or v_abo.price <= 0 then
      raise exception 'subscription has no price';
    end if;
    if v_offen <= 0 then
      raise exception 'nothing open';
    end if;
    v_betrag := v_offen;
  else
    v_betrag := round(p_amount, 2);
    if v_betrag <= 0 then
      raise exception 'amount must be positive';
    end if;
    -- Dieselbe Obergrenze wie bei der Eingabe in der Oberflaeche. Ein Vertipper
    -- um drei Nullen soll nicht als Guthaben in der Datenbank stehen.
    if v_betrag > 10000 then
      raise exception 'amount too high';
    end if;
  end if;

  insert into cash_payments (subscription_id, customer_id, amount, collected_by)
  values (p_subscription_id, v_abo.customer_id, v_betrag, auth.uid())
  returning * into v_zeile;

  return v_zeile;
end;
$$;

-- 5. Die Barzahler eines Kurses -- mit Soll und Haben statt Zahlungstagen.
--
-- Der Rueckgabetyp aendert sich, deshalb loeschen und neu anlegen. Statt der
-- Listen von Einzugs- und Zahlungstagen kommen jetzt zwei Summen heraus: Ob
-- etwas offen ist, ist keine Datumsfrage mehr.
--
-- Einzuege tauchen hier nicht mehr auf, und zwar nicht aus Versehen: Solange
-- ein Mandat besteht, entsteht gar kein Soll. Ein Einzug muss nichts abdecken,
-- weil es nichts zu decken gibt.
drop function if exists public.get_course_cash_payers(uuid);

create function public.get_course_cash_payers(p_course_id uuid)
returns table (
  customer_id uuid,
  full_name text,
  subscription_id uuid,
  subscription_name text,
  price numeric,
  ist_flatrate boolean,
  soll numeric,
  haben numeric,
  letzte_zahlung date,
  heutige_zahlung_id uuid
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
  select
    cm.customer_id,
    p.full_name,
    s.id,
    s.name,
    s.price,
    s.course_id is null as ist_flatrate,
    coalesce(l.soll, 0),
    coalesce(l.haben, 0),
    (select max(c.paid_on) from cash_payments c where c.subscription_id = s.id),
    (select c.id from cash_payments c
      where c.subscription_id = s.id and c.paid_on = public.heute_wien()
      order by c.created_at desc limit 1)
  from course_members cm
  join subscriptions s on s.id = cm.subscription_id
  join profiles p on p.id = cm.customer_id
  left join cash_ledger l on l.subscription_id = s.id
  where cm.course_id = p_course_id
    -- Barzahler heisst: kein gueltiges Mandat. Ein widerrufenes zaehlt nicht.
    and not exists (
      select 1 from sepa_mandates m
      where m.customer_id = cm.customer_id and m.revoked_at is null
    )
  order by p.full_name;
end;
$$;

-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.get_course_cash_payers(uuid) from public, anon;
revoke all on function public.record_cash_payment(uuid, numeric) from public, anon;
revoke all on function public.undo_cash_payment(uuid) from public, anon;

grant execute on function public.get_course_cash_payers(uuid) to authenticated;
grant execute on function public.record_cash_payment(uuid, numeric) to authenticated;
grant execute on function public.undo_cash_payment(uuid) to authenticated;

comment on table public.cash_payments is
  'PROJ-81/83: Je Zeile eine eingesammelte Barzahlung, in beliebiger Hoehe. Ob etwas offen ist, sagt cash_ledger: Soll aus cash_dues minus Haben aus dieser Tabelle.';
