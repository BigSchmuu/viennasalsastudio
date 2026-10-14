-- PROJ-86: Eine Notiz am Barzahler-Eintrag.
--
-- Seit PROJ-84 setzt der Betreiber den Betrag selbst -- und damit ist der Grund
-- dafuer nirgends mehr ablesbar: Warum stehen dort 138 Euro und nicht 89? Rest
-- aus September, Vereinbarung, Nachlass? Vorher liess sich das aus Zyklus und
-- Preis herleiten.
--
-- Die Grenze steht hier und nicht nur in der Oberflaeche: Eine Grenze, die nur
-- im Formular existiert, ist keine (siehe PROJ-13, wo genau das als offener
-- Punkt stehen blieb).
alter table public.cash_entries
  add column if not exists note text;

alter table public.cash_entries
  drop constraint if exists cash_entries_notiz_laenge;

alter table public.cash_entries
  add constraint cash_entries_notiz_laenge check (note is null or char_length(note) <= 300);

comment on column public.cash_entries.note is
  'PROJ-86: Interne Randbemerkung zum Eintrag ("Rest aus September", "zahlt Freitag"). Hoechstens 300 Zeichen; leer wird als null gespeichert.';

-- Leerer Text wird zu `null` -- sonst gaebe es zwei Arten von "keine Notiz",
-- und jede Anzeige muesste beide kennen.
create or replace function public.gesaeuberte_notiz(p_note text)
returns text
language sql
immutable
as $$
  select nullif(btrim(coalesce(p_note, '')), '');
$$;

-- 1. Eintragen -- jetzt mit Notiz.
--
-- Ein dritter Parameter mit Standardwert macht den zweistelligen Aufruf
-- zweideutig ("function is not unique"), also loeschen und neu anlegen.
drop function if exists public.add_cash_entry(uuid, numeric);

create function public.add_cash_entry(
  p_subscription_id uuid,
  p_amount numeric,
  p_note text default null
)
returns cash_entries
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_abo subscriptions;
  v_zeile cash_entries;
  v_betrag numeric := round(p_amount, 2);
  v_notiz text := gesaeuberte_notiz(p_note);
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
  if char_length(coalesce(v_notiz, '')) > 300 then
    raise exception 'note too long';
  end if;

  if exists (select 1 from cash_entries where subscription_id = p_subscription_id) then
    raise exception 'entry already exists';
  end if;

  insert into cash_entries (customer_id, subscription_id, amount_due, note, created_by)
  values (v_abo.customer_id, p_subscription_id, v_betrag, v_notiz, auth.uid())
  returning * into v_zeile;

  return v_zeile;
end;
$$;

-- 2. Die Notiz nachtraeglich setzen oder loeschen.
--
-- Eine eigene Funktion und kein zweiter Parameter an `update_cash_entry`:
-- Betrag und Notiz werden an verschiedenen Stellen der Zeile geaendert, und
-- eine gemeinsame Funktion muesste "Betrag unveraendert" ausdruecken koennen.
create or replace function public.set_cash_entry_note(p_entry_id uuid, p_note text)
returns cash_entries
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_eintrag cash_entries;
  v_notiz text := gesaeuberte_notiz(p_note);
begin
  select * into v_eintrag from cash_entries where id = p_entry_id;
  if not found then
    raise exception 'entry not found';
  end if;

  if not darf_barzahlung_fuehren(v_eintrag.subscription_id) then
    raise exception 'not authorized';
  end if;

  if char_length(coalesce(v_notiz, '')) > 300 then
    raise exception 'note too long';
  end if;

  update cash_entries set note = v_notiz where id = p_entry_id
  returning * into v_eintrag;

  return v_eintrag;
end;
$$;

-- 3. Die Liste gibt die Notiz mit heraus.
--
-- Rueckgabetyp geaendert, also loeschen und neu anlegen. Unveraendert sonst:
-- zwei Gruppen in einer Antwort, Flatraten in jedem Kurs.
drop function if exists public.get_course_cash_payers(uuid);

create function public.get_course_cash_payers(p_course_id uuid)
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
  note text,
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
    e.note,
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

-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.gesaeuberte_notiz(text) from public, anon;
revoke all on function public.add_cash_entry(uuid, numeric, text) from public, anon;
revoke all on function public.set_cash_entry_note(uuid, text) from public, anon;
revoke all on function public.get_course_cash_payers(uuid) from public, anon;

grant execute on function public.gesaeuberte_notiz(text) to authenticated;
grant execute on function public.add_cash_entry(uuid, numeric, text) to authenticated;
grant execute on function public.set_cash_entry_note(uuid, text) to authenticated;
grant execute on function public.get_course_cash_payers(uuid) to authenticated;
