-- PROJ-54: Event-Serien — regelmäßige Veranstaltungen.
--
-- Eine Serie beschreibt nur die Regel: ein fester Wochentag, eine Uhrzeit, ein
-- Anfang und vielleicht ein Ende. Die einzelnen Termine daraus sind ganz
-- normale Events. Damit gelten Tickets, Kapazität, QR-Check-in, Lastschrift,
-- Benachrichtigungen und „Mein Bereich" unverändert — nichts davon muss für
-- Serien ein zweites Mal gebaut werden.
--
-- Reihenfolge beim Ausliefern: erst diese Migration, dann der Code. Der bereits
-- ausgelieferte Code kennt weder Serien noch die neuen Spalten; umgekehrt liest
-- der neue Code die Serientabelle auf jedem Aufruf von /events.

-- ---------------------------------------------------------------------------
-- Serien
-- ---------------------------------------------------------------------------

create table public.event_series (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  -- Eigene Adresse für die Serienseite, im selben Namensraum wie die Events:
  -- /events/<adresse>. Über beide Tabellen hinweg wacht die App darüber
  -- (vergebeneAdressen in src/lib/actions/admin/adressen.ts) — eine
  -- Datenbanksperre dafür gäbe es nur um den Preis eines Triggers, der bei
  -- jedem Event-Schreibvorgang die Serien mitliest.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  location text,
  event_type_id uuid not null references public.event_types(id) on delete restrict,
  sales_mode text not null default 'tickets' check (sales_mode in ('display', 'tickets')),
  -- 0 = Montag … 6 = Sonntag, dieselbe Zählweise wie beim Stundenplan.
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time,
  starts_on date not null,
  ends_on date,
  pause_in_holidays boolean not null default true,
  capacity int check (capacity > 0),
  price_normal numeric check (price_normal >= 0),
  price_student numeric check (price_student >= 0),
  status text not null default 'aktiv' check (status in ('aktiv', 'beendet')),
  created_at timestamptz not null default now(),
  constraint event_series_ende_nach_beginn check (ends_on is null or ends_on >= starts_on),
  -- Wie beim Einzelevent: Wer Tickets in der App verkauft, braucht Kapazität
  -- und Preise. Wer nur anzeigt, darf beides leer lassen.
  constraint event_series_tickets_vollstaendig check (
    sales_mode = 'display'
    or (capacity is not null and price_normal is not null and price_student is not null)
  )
);

create index idx_event_series_status on public.event_series(status);
create index idx_event_series_event_type_id on public.event_series(event_type_id);

alter table public.event_series enable row level security;

-- Öffentlich lesbar wie die Events selbst: Die Übersicht zeigt das Programm
-- auch Besuchern ohne Konto.
create policy "EventSeries: public read" on public.event_series
  for select using (true);

create policy "EventSeries: admin insert" on public.event_series
  for insert with check (public.current_role() = 'admin');

create policy "EventSeries: admin update" on public.event_series
  for update using (public.current_role() = 'admin');

create policy "EventSeries: admin delete" on public.event_series
  for delete using (public.current_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Events: Zugehörigkeit zur Serie
-- ---------------------------------------------------------------------------

alter table public.events
  -- `set null` und nicht `cascade`: Wird eine Serie je gelöscht, soll der
  -- einzelne Abend samt seiner Tickets stehen bleiben und künftig als
  -- gewöhnliches Event geführt werden. Die Verwaltung bietet ohnehin nur
  -- „Beenden" an — Löschen bliebe der Notfall an der Datenbank.
  add column series_id uuid references public.event_series(id) on delete set null,
  -- Der Kalendertag des Termins. Ein verlegter Termin trägt sein neues Datum,
  -- damit zweimal derselbe Tag ausgeschlossen bleibt.
  add column occurrence_date date,
  -- Einzeln verlegt: Serienänderungen lassen diesen Termin dann in Ruhe.
  add column overridden boolean not null default false,
  -- Wann zuletzt verlegt. Daran hängt das fristfreie Stornieren.
  add column moved_at timestamptz;

create index idx_events_series_id on public.events(series_id);

-- Je Serie und Kalendertag höchstens ein Termin. Der nächtliche Lauf legt
-- fehlende Termine nach; ohne diese Sperre entstünde bei zwei gleichzeitigen
-- Läufen derselbe Abend zweimal.
create unique index events_serie_termin_key
  on public.events(series_id, occurrence_date)
  where series_id is not null;

-- Ein Serientermin ohne Datum wäre für den Nachlege-Lauf unsichtbar: Er stünde
-- in keiner Prüfung auf „schon vorhanden" und würde bei jedem Lauf erneut
-- angelegt.
alter table public.events
  add constraint events_serientermin_hat_datum
    check (series_id is null or occurrence_date is not null);

-- ---------------------------------------------------------------------------
-- Stornieren: ein verlegter Termin hebt die Frist auf
-- ---------------------------------------------------------------------------
-- Wer ein Ticket für Freitag gekauft hat und am Mittwoch erfährt, dass der
-- Abend auf Samstag rutscht, soll nicht an der Ein-Tages-Frist hängen bleiben.
--
-- Gleiche Signatur, deshalb `create or replace` ohne `drop`: So bleiben die
-- vergebenen Rechte der Funktion erhalten.
create or replace function public.cancel_event_ticket(p_ticket_id uuid)
returns tickets
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := auth.uid();
  v_ticket_customer_id uuid;
  v_status text;
  v_starts_at timestamptz;
  v_moved_at timestamptz;
  v_row tickets;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  select t.customer_id, t.status, e.starts_at, e.moved_at
    into v_ticket_customer_id, v_status, v_starts_at, v_moved_at
  from tickets t
  join events e on e.id = t.event_id
  where t.id = p_ticket_id;

  if v_ticket_customer_id is null then
    raise exception 'ticket not found';
  end if;
  if v_ticket_customer_id <> v_customer_id then
    raise exception 'not your ticket';
  end if;
  if v_status not in ('reserved', 'confirmed') then
    raise exception 'ticket not cancellable';
  end if;

  if v_moved_at is null then
    -- Lead-time policy: TICKET_CANCELLATION_LEAD_DAYS (currently 1) in
    -- src/lib/constants/events.ts — kept as a calendar-date comparison to
    -- mirror the app's own daysUntil() semantics as closely as SQL allows.
    -- Beide Seiten als Wiener Kalendertag, so wie daysUntil() es tut.
    if (((v_starts_at at time zone 'Europe/Vienna')::date) - public.heute_wien()) < 1 then
      raise exception 'cancellation deadline passed';
    end if;
  -- PROJ-54: Verlegt — die Frist entfällt, der Abend selbst ist die Grenze.
  elsif v_starts_at <= now() then
    raise exception 'cancellation deadline passed';
  end if;

  update tickets
  set status = 'cancelled'
  where id = p_ticket_id
  returning * into v_row;

  return v_row;
end;
$function$;

-- `create or replace` setzt die Rechte zurück, und Supabase vergibt EXECUTE
-- per Default-Privileg erneut an `anon` (siehe 20260909210000).
revoke all on function public.cancel_event_ticket(uuid) from public, anon;
grant execute on function public.cancel_event_ticket(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Check-in: das Ticket muss zum ausgewählten Termin gehören
-- ---------------------------------------------------------------------------
-- Bisher genügte die Ticket-Kennung. Bei einer Serie heißen alle Termine
-- gleich — ohne diese Prüfung wäre das Ticket vom Abend der Vorwoche an der
-- Tür gültig, und die Gästeliste des laufenden Abends stimmte nicht mehr.
--
-- Hier ist ein `drop` unvermeidlich: Die Funktion bekommt einen zweiten
-- Parameter, und ein zweiter mit Vorgabewert stünde als eigene Überladung
-- daneben — ein Aufruf mit einem Argument wäre dann mehrdeutig. Die Rechte
-- werden darum unten neu vergeben.
drop function if exists public.checkin_event_ticket(uuid);

create or replace function public.checkin_event_ticket(p_ticket_id uuid, p_event_id uuid)
returns public.tickets
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row tickets;
  v_existing tickets;
begin
  if "current_role"() not in ('admin', 'teacher') then
    raise exception 'not authorized';
  end if;

  select * into v_existing from tickets where id = p_ticket_id;

  if v_existing.id is null then
    raise exception 'ticket not found';
  end if;

  -- `is null` ausdrücklich: Ein Vergleich mit null ergäbe null, und die Prüfung
  -- ließe durch, was sie verhindern soll.
  if p_event_id is null or v_existing.event_id <> p_event_id then
    raise exception 'ticket for other event';
  end if;

  -- Der Statusfilter steht in der Bedingung, nicht davor: Zwei gleichzeitige
  -- Scans desselben Tickets sollen nicht beide durchkommen.
  update tickets
  set status = 'checked_in', checked_in_at = now(), checked_in_by = auth.uid()
  where id = p_ticket_id and status in ('reserved', 'confirmed')
  returning * into v_row;

  if v_row.id is not null then
    return v_row;
  end if;

  select * into v_existing from tickets where id = p_ticket_id;

  if v_existing.status = 'checked_in' then
    raise exception 'already checked in';
  elsif v_existing.status = 'cancelled' then
    raise exception 'ticket cancelled';
  else
    raise exception 'ticket not eligible';
  end if;
end;
$function$;

revoke all on function public.checkin_event_ticket(uuid, uuid) from public, anon;
grant execute on function public.checkin_event_ticket(uuid, uuid) to authenticated;
