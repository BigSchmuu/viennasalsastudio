-- PROJ-51: Kurszeiträume, vorgemerkte Umwandlung und studioweite Ferien.
--
-- Kurse laufen in Staffeln von vier bis acht Wochen, jeder mit eigenem
-- Zeitraum. Der Stundenplan kannte bisher keine Zeit: Ein ausgelaufener Kurs
-- stand weiter da, ein kommender gar nicht.

-- 1. Der Zeitraum am Kurs.
--
-- Beide Felder dürfen leer bleiben — dann ist der Kurs unbefristet und
-- verhält sich wie bisher. Das ist Absicht: Der Betreiber soll die Zeiträume
-- nachziehen können, wo sie ihm nützen, statt sie überall gleichzeitig
-- pflegen zu müssen.
alter table public.courses
  add column if not exists runs_from date,
  add column if not exists runs_until date;

alter table public.courses drop constraint if exists courses_zeitraum_sinnvoll;
alter table public.courses add constraint courses_zeitraum_sinnvoll
  check (runs_from is null or runs_until is null or runs_until >= runs_from);

-- 2. Die vorgemerkte Umwandlung.
--
-- Aus Beginner 1 wird Beginner 2: derselbe Kurs, dieselben Kunden, nur Name
-- und Level ändern sich. Deshalb eine Vormerkung am Kurs und kein neuer Kurs —
-- Abos, Kursplätze, Anwesenheit und Notizen hängen an der Kurs-Kennung und
-- bleiben ohne Zutun daran.
--
-- Dasselbe Muster wie bei den Abo-Änderungen (`pending_status`,
-- `pending_effective_date`), vollzogen vom selben nächtlichen Lauf. Ein
-- zweiter Mechanismus für „etwas wird zum Stichtag wirksam" würde früher oder
-- später anders antworten.
--
-- Der Preis bleibt außen vor: Eine Preisänderung an einem bestehenden Vertrag
-- ist etwas anderes als ein neuer Kursname und gehört ausdrücklich angekündigt.
alter table public.courses
  add column if not exists pending_name text,
  add column if not exists pending_level text,
  add column if not exists pending_effective_date date;

-- Die drei gehören zusammen: entweder alle oder keines. Eine halbe Vormerkung
-- wäre eine Absicht, die niemand ausführen kann.
alter table public.courses drop constraint if exists courses_umwandlung_vollstaendig;
alter table public.courses add constraint courses_umwandlung_vollstaendig
  check (
    (pending_name is null and pending_level is null and pending_effective_date is null)
    or (pending_name is not null and pending_effective_date is not null)
  );

-- 3. Ferien.
--
-- Ein Eintrag statt vierzig: Dass das Studio zwischen Weihnachten und Neujahr
-- zu hat, stand bisher als einzelner Ausfalltag an jedem Kurs.
--
-- Bewusst getrennt von `course_schedule_pauses`: Ein einzelner Abend, an dem
-- der Lehrer krank ist, hat mit Weihnachten nichts zu tun. Beide lassen einen
-- Termin ausfallen, keiner löscht den anderen.
create table if not exists public.studio_holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  constraint studio_holidays_zeitraum_sinnvoll check (ends_on >= starts_on)
);

create index if not exists studio_holidays_zeitraum on public.studio_holidays (starts_on, ends_on);

alter table public.studio_holidays enable row level security;

-- Öffentlich lesbar: Der Stundenplan zeigt die Ferien auch anonymen Besuchern.
drop policy if exists "StudioHolidays: public read" on public.studio_holidays;
create policy "StudioHolidays: public read"
  on public.studio_holidays for select using (true);

drop policy if exists "StudioHolidays: admin write" on public.studio_holidays;
create policy "StudioHolidays: admin write"
  on public.studio_holidays for insert with check (public."current_role"() = 'admin');

drop policy if exists "StudioHolidays: admin update" on public.studio_holidays;
create policy "StudioHolidays: admin update"
  on public.studio_holidays for update using (public."current_role"() = 'admin');

drop policy if exists "StudioHolidays: admin delete" on public.studio_holidays;
create policy "StudioHolidays: admin delete"
  on public.studio_holidays for delete using (public."current_role"() = 'admin');
