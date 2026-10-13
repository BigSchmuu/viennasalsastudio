-- PROJ-81: Barzahlungen -- die Liste, die bisher auf Papier lag.
--
-- Wer ein SEPA-Mandat hat, wird eingezogen; wer keines hat, zahlt bar. Die
-- Unterscheidung steckte schon in den Daten (der Lastschriftlauf waehlt genau
-- danach aus), gezeigt wurde sie niemandem -- und am Kursabend stand die
-- Lehrkraft mit einem Blatt da, das am Tag nach dem Ausdrucken veraltet war.

-- 1. Die Zahlung.
--
-- Eine Zeile je Zahlung, kein Haekchen am Abo: Ein Haekchen wuesste nicht, wann
-- und von wem -- und beim naechsten Zyklus muesste es jemand zuruecksetzen.
--
-- Der Betrag steht hier und nicht nur am Abo: Aendert sich der Preis spaeter,
-- bleibt wahr, was eingesammelt wurde.
create table if not exists public.cash_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  paid_on date not null default public.heute_wien(),
  amount numeric not null check (amount > 0),
  -- Wer eingesammelt hat. `set null`, damit eine Zahlung nicht mit einem
  -- geloeschten Lehrerkonto verschwindet -- sie ist passiert.
  collected_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists cash_payments_abo on public.cash_payments (subscription_id, paid_on desc);
create index if not exists cash_payments_tag on public.cash_payments (paid_on desc);

alter table public.cash_payments enable row level security;

-- Lesen darf man die eigenen Zahlungen; alles andere laeuft ueber Funktionen.
-- Fuer die Lehrkraft gibt es bewusst keine Leseregel: Sie braucht Betraege,
-- und die stehen am Abo neben Dingen, die sie nicht sehen soll.
create policy "CashPayments: eigene lesen oder Admin"
  on public.cash_payments for select
  using ((select auth.uid()) = customer_id or public."current_role"() = 'admin');

-- Schreiben ausschliesslich ueber die Funktionen unten: Erfassen braucht die
-- Pruefung "Lehrkraft dieses Kurses", und die ist in einer Regel nicht zu haben.

-- 2. Das Netz gegen das doppelte Antippen.
--
-- Bewusst **keine** Ferienrechnung: Die fachliche Regel steht in
-- lib/sepa/faelligkeit.ts (vier Wochen, durch Ferien verlaengert) und wird der
-- Lehrkraft angezeigt. Hier geht es nur darum, dass ein zweiter Druck auf den
-- Knopf kein zweites Mal Geld verbucht. Eine Zahlung, die weniger als vier
-- Wochen nach der letzten kaeme, ist nach der Regel ohnehin nie faellig --
-- Ferien verschieben nach hinten, nie nach vorn.
create or replace function public.cash_payment_nicht_doppelt()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if exists (
    select 1 from cash_payments
    where subscription_id = new.subscription_id
      and id is distinct from new.id
      and paid_on > new.paid_on - 28
      and paid_on <= new.paid_on
  ) then
    raise exception 'cash payment already recorded for this cycle';
  end if;
  return new;
end;
$$;

drop trigger if exists cash_payments_nicht_doppelt on public.cash_payments;
create trigger cash_payments_nicht_doppelt
  before insert or update on public.cash_payments
  for each row execute function public.cash_payment_nicht_doppelt();

-- 3. Die Barzahler eines Kurses -- mit Betrag und allen bisherigen Zahlungen.
--
-- Ueber eine Funktion und nicht ueber Leseregeln: Fuer eine Lehrkraft sind
-- `subscriptions` und `sepa_mandates` gesperrt, und in der Mandatstabelle
-- stehen IBANs. Dieselbe Bauweise wie bei der Anwesenheitsliste (PROJ-13).
--
-- `einzuege` und `barzahlungen` kommen als Listen heraus: Ob der laufende
-- Zyklus bezahlt ist, entscheidet `istFaellig` aus PROJ-70 -- dieselbe Regel
-- wie beim Lastschriftlauf, mit Ferien. Sie in SQL nachzubauen hiesse, zwei
-- Wahrheiten ueber einen Monat zu fuehren.
create or replace function public.get_course_cash_payers(p_course_id uuid)
returns table (
  customer_id uuid,
  full_name text,
  subscription_id uuid,
  subscription_name text,
  amount numeric,
  ist_flatrate boolean,
  einzuege date[],
  barzahlungen date[],
  -- Die Kennung der *heutigen* Zahlung, falls es eine gibt. Ohne sie koennte
  -- die Lehrkraft einen Fehlgriff nach einem Neuladen der Seite nicht mehr
  -- zuruecknehmen -- und genau dann merkt man ihn.
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
    coalesce(
      (select array_agg(r.due_date order by r.due_date)
         from sepa_collection_items i
         join sepa_collection_runs r on r.id = i.run_id
        where i.subscription_id = s.id),
      '{}'::date[]
    ),
    coalesce(
      (select array_agg(c.paid_on order by c.paid_on) from cash_payments c where c.subscription_id = s.id),
      '{}'::date[]
    ),
    (select c.id from cash_payments c
      where c.subscription_id = s.id and c.paid_on = public.heute_wien()
      order by c.created_at desc limit 1)
  from course_members cm
  join subscriptions s on s.id = cm.subscription_id
  join profiles p on p.id = cm.customer_id
  where cm.course_id = p_course_id
    -- Barzahler heisst: kein gueltiges Mandat. Ein widerrufenes zaehlt nicht.
    and not exists (
      select 1 from sepa_mandates m
      where m.customer_id = cm.customer_id and m.revoked_at is null
    )
  order by p.full_name;
end;
$$;

-- 4. Eine Zahlung erfassen.
--
-- Der Betrag kommt nicht vom Aufrufer, sondern aus dem Abo: Sonst koennte ein
-- Tippfehler in der Oberflaeche eine falsche Summe festschreiben.
create or replace function public.record_cash_payment(p_subscription_id uuid)
returns cash_payments
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_abo subscriptions;
  v_zeile cash_payments;
  v_darf boolean;
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

  if v_abo.price is null or v_abo.price <= 0 then
    raise exception 'subscription has no price';
  end if;

  insert into cash_payments (subscription_id, customer_id, amount, collected_by)
  values (p_subscription_id, v_abo.customer_id, v_abo.price, auth.uid())
  returning * into v_zeile;

  return v_zeile;
end;
$$;

-- 5. Eine Zahlung zuruecknehmen.
--
-- Die Lehrkraft nur am selben Tag: Ein Fehlgriff faellt sofort auf. Was aelter
-- ist, gehoert in die Verwaltung -- sonst verschwindet Geld aus der
-- Aufzeichnung, das laengst eingesammelt wurde.
create or replace function public.undo_cash_payment(p_payment_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_zahlung cash_payments;
  v_ist_admin boolean := "current_role"() = 'admin';
  v_ist_lehrkraft boolean;
begin
  select * into v_zahlung from cash_payments where id = p_payment_id;
  if not found then
    raise exception 'cash payment not found';
  end if;

  select exists (
    select 1 from course_members cm
    where cm.subscription_id = v_zahlung.subscription_id and is_course_teacher(cm.course_id)
  ) into v_ist_lehrkraft;

  if not (v_ist_admin or v_ist_lehrkraft) then
    raise exception 'not authorized';
  end if;

  if not v_ist_admin and v_zahlung.paid_on <> public.heute_wien() then
    raise exception 'only todays payment can be undone';
  end if;

  delete from cash_payments where id = p_payment_id;
  return true;
end;
$$;

-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.get_course_cash_payers(uuid) from public, anon;
revoke all on function public.record_cash_payment(uuid) from public, anon;
revoke all on function public.undo_cash_payment(uuid) from public, anon;

grant execute on function public.get_course_cash_payers(uuid) to authenticated;
grant execute on function public.record_cash_payment(uuid) to authenticated;
grant execute on function public.undo_cash_payment(uuid) to authenticated;

comment on table public.cash_payments is
  'PROJ-81: Je Zeile eine eingesammelte Barzahlung fuer einen Abo-Zyklus. Ob ein Zyklus offen ist, entscheidet lib/sepa/faelligkeit.ts aus Einzuegen und Barzahlungen zusammen.';
