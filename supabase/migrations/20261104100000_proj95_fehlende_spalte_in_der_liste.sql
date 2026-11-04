-- PROJ-95 Korrektur: In `get_course_cash_payers` fehlte `subscription_id`.
--
-- Beim Einbauen der neuen Spalte `pass_stil` ist mir `e.subscription_id` aus
-- der Auswahlliste gefallen. Die Funktion liess sich dadurch anlegen -- PL/pgSQL
-- prueft die Struktur erst beim Aufruf --, scheiterte aber bei **jedem** Aufruf
-- mit "structure of query does not match function result type". Fuer die
-- Lehrkraft heisst das: keine Barzahler-Liste, sondern "Die Barzahler konnten
-- nicht geladen werden".
--
-- Die Reihenfolge der Spalten ist hier die ganze Schnittstelle: Postgres
-- ordnet nach Position, nicht nach Namen. Deshalb steht ab jetzt an jeder
-- Zeile, welche Spalte sie bedient -- eine verschobene Zeile faellt dann beim
-- Lesen auf und nicht erst im Betrieb.
--
-- Der Rueckgabetyp ist unveraendert, also genuegt `create or replace`.
create or replace function public.get_course_cash_payers(p_course_id uuid)
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
    e.id,                                                         -- entry_id
    e.customer_id,                                                -- customer_id
    p.full_name,                                                  -- full_name
    e.subscription_id,                                            -- subscription_id
    coalesce(c.name, s.name),                                     -- subscription_name
    s.course_id is null,                                          -- ist_flatrate
    ds.name,                                                      -- pass_stil
    (k.subscription_id is not null),                              -- eigener_kurs
    e.amount_due,                                                 -- amount_due
    coalesce((select sum(z.amount) from cash_payments z
               where z.entry_id = e.id), 0),                      -- bezahlt
    e.note,                                                       -- note
    (select max(z.paid_on) from cash_payments z
      where z.entry_id = e.id),                                   -- letzte_zahlung
    (select z.id from cash_payments z where z.entry_id = e.id
      order by z.created_at desc limit 1)                         -- letzte_zahlung_id
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

-- `create or replace function` setzt die Rechte zurueck, und Supabase vergibt
-- EXECUTE per Default-Privileg neu an `anon`. Siehe .claude/rules/backend.md.
revoke all on function public.get_course_cash_payers(uuid) from public, anon;
grant execute on function public.get_course_cash_payers(uuid) to authenticated;
