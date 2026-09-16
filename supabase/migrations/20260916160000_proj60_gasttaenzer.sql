-- PROJ-60: Gasttänzer-Programm.
--
-- Tragende Entscheidung des Entwurfs: Eine Zusage ist eine **Buchung** der
-- neuen Art 'guest' mit Preis 0. Damit greifen Anwesenheitsliste, Absage und
-- Auswertung ohne Sonderwege. Neu sind nur zwei Tabellen: wer im Programm ist,
-- und was ausgeschrieben ist.

-- ---------------------------------------------------------------------------
-- 1. Die Rangfolge der Level
-- ---------------------------------------------------------------------------
-- `open_level` bekommt bewusst keinen Rang: Ein Open-Level-Kurs mischt alle
-- Stufen, „eine Stufe darüber" ergibt dort keinen Sinn. Genau deshalb ist die
-- Mindeststufe je Ausschreibung einstellbar.

create or replace function public.level_rang(p_level text)
returns integer
language sql
immutable
as $$
  select case p_level
    when 'beginner' then 1
    when 'improver' then 2
    when 'intermediate' then 3
    when 'advanced' then 4
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Wer im Programm ist
-- ---------------------------------------------------------------------------
-- Ein Ausschluss wird vermerkt, nicht gelöscht: Sonst könnte sich derselbe
-- Mensch am nächsten Tag neu anmelden, und niemand wüsste, warum er weg war.

create table public.guest_dancers (
  customer_id uuid primary key references public.profiles(id) on delete cascade,
  dance_role text not null check (dance_role in ('leader', 'follower', 'both')),
  level text not null check (level in ('beginner', 'improver', 'intermediate', 'advanced')),
  joined_at timestamptz not null default now(),
  excluded_at timestamptz,
  excluded_by uuid references auth.users(id) on delete set null
);

alter table public.guest_dancers enable row level security;

create policy "GuestDancers: own or admin read" on public.guest_dancers
  for select using ((select auth.uid()) = customer_id or public.current_role() = 'admin');

create policy "GuestDancers: own insert" on public.guest_dancers
  for insert with check ((select auth.uid()) = customer_id);

-- Bewusst ohne Ausschluss-Spalten in der Hand des Kunden: Die Rechte darauf
-- entzieht der nächste Block, sonst könnte sich jemand selbst freischalten.
create policy "GuestDancers: own or admin update" on public.guest_dancers
  for update using ((select auth.uid()) = customer_id or public.current_role() = 'admin');

create policy "GuestDancers: own or admin delete" on public.guest_dancers
  for delete using ((select auth.uid()) = customer_id or public.current_role() = 'admin');

revoke update on public.guest_dancers from authenticated, anon;
grant update (dance_role, level) on public.guest_dancers to authenticated;

create index idx_guest_dancers_aktiv on public.guest_dancers (dance_role, level) where excluded_at is null;

-- ---------------------------------------------------------------------------
-- 3. Was ausgeschrieben ist
-- ---------------------------------------------------------------------------

create table public.guest_slots (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  occurrence_date date not null,
  dance_role text not null check (dance_role in ('leader', 'follower')),
  seats integer not null check (seats > 0 and seats <= 20),
  min_level text check (min_level in ('beginner', 'improver', 'intermediate', 'advanced')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  withdrawn_by uuid references auth.users(id) on delete set null
);

alter table public.guest_slots enable row level security;

-- Lesen darf jedes angemeldete Konto: Dort steht nur, dass ein Kurs an einem
-- Abend zwei Follower sucht — nichts Persoenliches. Wer zusagen darf,
-- entscheidet die Funktion weiter unten, nicht diese Regel.
create policy "GuestSlots: authenticated read" on public.guest_slots
  for select to authenticated using (true);

create policy "GuestSlots: admin insert" on public.guest_slots
  for insert with check (public.current_role() = 'admin');

create policy "GuestSlots: admin update" on public.guest_slots
  for update using (public.current_role() = 'admin');

create index idx_guest_slots_offen on public.guest_slots (course_id, occurrence_date)
  where withdrawn_at is null;

-- ---------------------------------------------------------------------------
-- 4. Die neue Buchungsart
-- ---------------------------------------------------------------------------
-- Gasttaenzer zaehlen an ihrem Abend mit, aber sie belegen keinen laufenden
-- Kursplatz: Deshalb bleibt die Kapazitaetsrechnung beim Buchen unveraendert
-- (sie zaehlt Abos und offene regulaere Buchungen). Ob der Raum an diesem Abend
-- voll wird, sieht der Betreiber beim Ausschreiben — dort warnt die App.

alter table public.course_bookings drop constraint if exists course_bookings_type_check;
alter table public.course_bookings add constraint course_bookings_type_check
  check (type in ('regular', 'trial', 'dropin', 'guest'));

-- Sicherheitsnetz: Der Name der alten Pruefbedingung stammt von Postgres und
-- steht in keiner Migration. Hiesse sie anders, stuende sie jetzt noch daneben
-- und wuerde 'guest' weiterhin ablehnen — lautlos, bis die erste Zusage
-- scheitert. Dann bricht die Migration lieber hier ab.
do $$
declare
  v_name text;
begin
  select conname into v_name
  from pg_constraint
  where conrelid = 'public.course_bookings'::regclass
    and contype = 'c'
    and conname <> 'course_bookings_type_check'
    and pg_get_constraintdef(oid) like '%dropin%';

  if v_name is not null then
    raise exception 'PROJ-60: Alte Typ-Pruefbedingung "%" steht noch daneben und wuerde guest ablehnen.', v_name;
  end if;
end $$;

alter table public.course_bookings
  add column if not exists guest_slot_id uuid references public.guest_slots(id) on delete set null;

alter table public.course_bookings add constraint course_bookings_guest_needs_slot
  check ((type = 'guest') = (guest_slot_id is not null));

-- Eine Zusage je Mensch und Ausschreibung. Eine abgesagte zaehlt nicht mit,
-- damit jemand nach einer Absage erneut einspringen kann.
create unique index idx_guest_booking_einmal
  on public.course_bookings (guest_slot_id, customer_id)
  where guest_slot_id is not null and status <> 'cancelled';

-- ---------------------------------------------------------------------------
-- 5. Die Einladung
-- ---------------------------------------------------------------------------

alter table public.notification_queue drop constraint notification_queue_event_type_check;

alter table public.notification_queue add constraint notification_queue_event_type_check
  check (event_type = any (array[
    'buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung',
    'sepa_ankuendigung', 'event_tickets', 'probestunde_nachfassung', 'newsletter',
    'neue_buchung', 'zahlungserinnerung', 'kursausfall', 'guthaben',
    'konto_existiert', 'kursumwandlung', 'zweite_stufe_zurueckgesetzt',
    'ticket_storniert', 'gasttaenzer_einladung'
  ]));

-- ---------------------------------------------------------------------------
-- 6. Wann der Kursabend beginnt
-- ---------------------------------------------------------------------------
-- Gebraucht fuer „zusagen bis Kursbeginn". Der Wochentag steht im Stundenplan
-- in der Zaehlung 0=Montag…6=Sonntag; `isodow` zaehlt 1=Montag…7=Sonntag.

create or replace function public.kursabend_beginn(p_course_id uuid, p_datum date)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select (p_datum + cs.start_time) at time zone 'Europe/Vienna'
  from public.course_schedule cs
  where cs.course_id = p_course_id
    and cs.weekday = (extract(isodow from p_datum)::int - 1)
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 7. Der Empfaengerkreis einer Ausschreibung
-- ---------------------------------------------------------------------------
-- Dieselben Regeln wie in src/lib/gasttaenzer/ausschreibung.ts — nur hier
-- zaehlen sie, weil hier die Einladungen entstehen.

create or replace function public.gastplatz_empfaenger(p_slot_id uuid)
returns table (customer_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_slot public.guest_slots;
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'not authorized';
  end if;

  select * into v_slot from public.guest_slots where id = p_slot_id;
  if not found then
    raise exception 'slot not found';
  end if;

  return query
  select gd.customer_id
  from public.guest_dancers gd
  where gd.excluded_at is null
    and (gd.dance_role = 'both' or gd.dance_role = v_slot.dance_role)
    and (
      v_slot.min_level is null
      or public.level_rang(v_slot.min_level) is null
      or public.level_rang(gd.level) >= public.level_rang(v_slot.min_level)
    )
    -- Wer an dem Abend ohnehin im Kurs sitzt, bekommt keine Einladung.
    and not exists (
      select 1 from public.course_members cm
      where cm.course_id = v_slot.course_id and cm.customer_id = gd.customer_id
    )
    and not exists (
      select 1 from public.course_bookings cb
      where cb.course_id = v_slot.course_id
        and cb.customer_id = gd.customer_id
        and cb.chosen_date = v_slot.occurrence_date
        and cb.status <> 'cancelled'
    );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Zusagen
-- ---------------------------------------------------------------------------
-- Der Punkt, an dem sich entscheidet, ob die Funktion taugt: Zwei Menschen
-- tippen im selben Moment auf „Ich springe ein", es gibt einen Platz. Die
-- Ausschreibung wird deshalb gesperrt gelesen, die Zusagen werden gezaehlt und
-- erst dann wird gebucht.

create or replace function public.gastplatz_zusagen(p_slot_id uuid, p_level_bestaetigt boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ich uuid := auth.uid();
  v_slot public.guest_slots;
  v_gast public.guest_dancers;
  v_zusagen integer;
  v_beginn timestamptz;
  v_buchung uuid;
begin
  if v_ich is null then
    raise exception 'not authenticated';
  end if;
  if not p_level_bestaetigt then
    raise exception 'level not confirmed';
  end if;

  select * into v_slot from public.guest_slots where id = p_slot_id for update;
  if not found then
    raise exception 'slot not found';
  end if;

  select * into v_gast from public.guest_dancers where customer_id = v_ich;
  if not found then
    raise exception 'not in programme';
  end if;
  if v_gast.excluded_at is not null then
    raise exception 'excluded';
  end if;

  if not (v_gast.dance_role = 'both' or v_gast.dance_role = v_slot.dance_role) then
    raise exception 'role mismatch';
  end if;

  if v_slot.min_level is not null
     and public.level_rang(v_slot.min_level) is not null
     and coalesce(public.level_rang(v_gast.level), 0) < public.level_rang(v_slot.min_level) then
    raise exception 'level too low';
  end if;

  if exists (
    select 1 from public.course_members cm
    where cm.course_id = v_slot.course_id and cm.customer_id = v_ich
  ) or exists (
    select 1 from public.course_bookings cb
    where cb.course_id = v_slot.course_id and cb.customer_id = v_ich
      and cb.chosen_date = v_slot.occurrence_date and cb.status <> 'cancelled'
  ) then
    raise exception 'already attending';
  end if;

  if v_slot.withdrawn_at is not null then
    raise exception 'withdrawn';
  end if;

  v_beginn := public.kursabend_beginn(v_slot.course_id, v_slot.occurrence_date);
  if v_beginn is not null and v_beginn <= now() then
    raise exception 'course already started';
  end if;

  select count(*) into v_zusagen
  from public.course_bookings
  where guest_slot_id = p_slot_id and status <> 'cancelled';

  if v_zusagen >= v_slot.seats then
    raise exception 'no seats left';
  end if;

  insert into public.course_bookings
    (course_id, customer_id, type, status, chosen_date, price, dance_role, guest_slot_id)
  values
    (v_slot.course_id, v_ich, 'guest', 'confirmed', v_slot.occurrence_date, 0, v_slot.dance_role, p_slot_id)
  returning id into v_buchung;

  return v_buchung;
end;
$$;

create or replace function public.gastplatz_absagen(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ich uuid := auth.uid();
  v_kunde uuid;
  v_typ text;
begin
  select customer_id, type into v_kunde, v_typ
  from public.course_bookings where id = p_booking_id;

  if not found then
    raise exception 'booking not found';
  end if;
  if v_typ <> 'guest' then
    raise exception 'not a guest booking';
  end if;
  -- Der Betreiber darf auch absagen: Wenn jemand anruft statt zu klicken.
  if v_kunde <> v_ich and public.current_role() is distinct from 'admin' then
    raise exception 'not your booking';
  end if;

  update public.course_bookings set status = 'cancelled' where id = p_booking_id;
end;
$$;

revoke execute on function public.gastplatz_zusagen(uuid, boolean) from public, anon;
revoke execute on function public.gastplatz_absagen(uuid) from public, anon;
revoke execute on function public.gastplatz_empfaenger(uuid) from public, anon;
revoke execute on function public.kursabend_beginn(uuid, date) from public, anon;
grant execute on function public.gastplatz_zusagen(uuid, boolean) to authenticated;
grant execute on function public.gastplatz_absagen(uuid) to authenticated;
grant execute on function public.gastplatz_empfaenger(uuid) to authenticated;
grant execute on function public.kursabend_beginn(uuid, date) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Der Gast auf der Anwesenheitsliste
-- ---------------------------------------------------------------------------
-- Vierte Quelle neben 'abo', 'buchung' und 'manuell'. Die Lehrkraft muss
-- wissen, wer im Raum ist und warum — und beim Nachrechnen darf ein Gastabend
-- nicht wie ein bezahlter Platz aussehen.

create or replace function public.get_course_attendance_roster(p_course_id uuid, p_occurrence_date date)
returns table (customer_id uuid, full_name text, source text, status text, self_checked_in boolean)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not (is_course_teacher(p_course_id) or "current_role"() = 'admin') then
    raise exception 'not authorized';
  end if;
  return query
  with expected_all as (
    select cm.customer_id, 'abo' as source, 1 as priority from course_members cm
    where cm.course_id = p_course_id
    union all
    select cb.customer_id, 'buchung' as source, 2 as priority from course_bookings cb
    where cb.course_id = p_course_id and cb.type in ('trial', 'dropin') and cb.status = 'confirmed'
      and cb.chosen_date = p_occurrence_date
    union all
    select cb.customer_id, 'gast' as source, 2 as priority from course_bookings cb
    where cb.course_id = p_course_id and cb.type = 'guest' and cb.status = 'confirmed'
      and cb.chosen_date = p_occurrence_date
    union all
    select ca.customer_id, 'manuell' as source, 3 as priority from course_attendance ca
    where ca.course_id = p_course_id and ca.occurrence_date = p_occurrence_date
      and ca.customer_id not in (
        select cm2.customer_id from course_members cm2 where cm2.course_id = p_course_id
        union
        select cb2.customer_id from course_bookings cb2
        where cb2.course_id = p_course_id and cb2.type in ('trial', 'dropin', 'guest')
          and cb2.status = 'confirmed' and cb2.chosen_date = p_occurrence_date
      )
  ),
  expected as (
    select distinct on (expected_all.customer_id) expected_all.customer_id, expected_all.source
    from expected_all order by expected_all.customer_id, expected_all.priority
  )
  select e.customer_id, p.full_name, e.source, ca.status,
    (ca.marked_by is not null and ca.marked_by = e.customer_id) as self_checked_in
  from expected e
  join profiles p on p.id = e.customer_id
  left join course_attendance ca
    on ca.course_id = p_course_id and ca.customer_id = e.customer_id and ca.occurrence_date = p_occurrence_date
  order by p.full_name;
end;
$$;

comment on table public.guest_dancers is 'PROJ-60: Wer im Gasttaenzer-Programm ist, mit Rolle und hoechstem Level.';
comment on table public.guest_slots is 'PROJ-60: Ausgeschriebene Gastplaetze fuer einen Kursabend.';
