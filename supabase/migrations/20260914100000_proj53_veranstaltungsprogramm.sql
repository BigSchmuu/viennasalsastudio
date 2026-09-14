-- PROJ-53: Veranstaltungsprogramm — Eventarten, Verkaufsart, lesbare Adressen.
--
-- Aus der Event-Liste wird ein Programm: Jedes Event hat eine Art (Party,
-- Workshop …), wird entweder nur angezeigt oder verkauft Tickets in der App,
-- und hat eine lesbare Adresse für seine eigene Seite.
--
-- Reihenfolge beim Ausliefern: erst diese Migration, dann der Code. Der bisher
-- ausgelieferte Code legt Events ohne Art und Adresse an und scheitert danach an
-- den Pflichtfeldern — in den Minuten dazwischen also kein Event anlegen.

-- ---------------------------------------------------------------------------
-- Eventarten — nach dem Muster der Tanzstile
-- ---------------------------------------------------------------------------

create table public.event_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);

-- Eindeutig ohne Rücksicht auf Groß-/Kleinschreibung: „Party" und „party"
-- nebeneinander im Filter wären zwei Chips für dasselbe.
create unique index event_types_name_lower_key on public.event_types (lower(name));

alter table public.event_types enable row level security;

create policy "EventTypes: public read" on public.event_types
  for select using (true);

create policy "EventTypes: admin insert" on public.event_types
  for insert with check (public.current_role() = 'admin');

create policy "EventTypes: admin update" on public.event_types
  for update using (public.current_role() = 'admin');

create policy "EventTypes: admin delete" on public.event_types
  for delete using (public.current_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Events: Art, Verkaufsart, Adresse
-- ---------------------------------------------------------------------------

alter table public.events
  add column event_type_id uuid,
  add column sales_mode text not null default 'tickets',
  add column slug text;

-- Bestand: In der Produktion gibt es nur Test-Events (Auskunft des Betreibers
-- vom 2026-09-14). Sie bekommen eine Start-Art, die sich danach umbenennen
-- lässt, und eine Adresse aus ihrem Namen.
insert into public.event_types (name)
select 'Workshop'
where not exists (select 1 from public.event_types where lower(name) = 'workshop');

update public.events
set event_type_id = (select id from public.event_types where lower(name) = 'workshop')
where event_type_id is null;

-- Dieselbe Schreibweise wie src/lib/events/adresse.ts, für den einmaligen
-- Bestand vereinfacht. Gleich lautende Namen bekommen den Anfang ihrer
-- Kennung angehängt: sicher eindeutig, ohne zählen zu müssen. Neue Adressen
-- vergibt danach ausschließlich die App.
with roh as (
  select
    id,
    created_at,
    coalesce(
      nullif(
        trim(both '-' from left(
          regexp_replace(
            translate(
              replace(replace(replace(replace(lower(name), 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
              'áàâãåéèêëíìîïóòôõúùûçñ',
              'aaaaaeeeeiiiiooooouuucn'
            ),
            '[^a-z0-9]+', '-', 'g'
          ),
          80
        )),
        ''
      ),
      'event'
    ) as adresse
  from public.events
),
nummeriert as (
  select id, adresse, row_number() over (partition by adresse order by created_at, id) as nummer
  from roh
)
update public.events e
set slug = case when n.nummer = 1 then n.adresse else n.adresse || '-' || left(e.id::text, 8) end
from nummeriert n
where n.id = e.id;

alter table public.events
  alter column event_type_id set not null,
  alter column slug set not null,
  alter column capacity drop not null,
  alter column price_normal drop not null,
  alter column price_student drop not null,
  -- Löschsperre: Eine Art, der noch Events zugeordnet sind, lässt sich nicht
  -- entfernen — auch nicht an der Verwaltung vorbei.
  add constraint events_event_type_id_fkey
    foreign key (event_type_id) references public.event_types(id) on delete restrict,
  add constraint events_slug_key unique (slug),
  add constraint events_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint events_sales_mode_check check (sales_mode in ('display', 'tickets')),
  -- Wer Tickets verkauft, braucht Kapazität und Preise. Wer nur anzeigt, darf
  -- beides leer lassen; ein eingetragener Preis erscheint dann als Eintritt.
  add constraint events_tickets_vollstaendig check (
    sales_mode = 'display'
    or (capacity is not null and price_normal is not null and price_student is not null)
  );

create index idx_events_event_type_id on public.events(event_type_id);

-- ---------------------------------------------------------------------------
-- Frühere Adressen — geteilte Links führen nach einer Umbenennung weiter
-- ---------------------------------------------------------------------------

create table public.event_previous_slugs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create index idx_event_previous_slugs_event_id on public.event_previous_slugs(event_id);

alter table public.event_previous_slugs enable row level security;

-- Öffentlich lesbar: Die Eventseite löst alte Adressen auch für Besucher ohne
-- Konto auf. Die Tabelle enthält nichts als Adressen öffentlicher Seiten.
create policy "EventPreviousSlugs: public read" on public.event_previous_slugs
  for select using (true);

create policy "EventPreviousSlugs: admin insert" on public.event_previous_slugs
  for insert with check (public.current_role() = 'admin');

create policy "EventPreviousSlugs: admin update" on public.event_previous_slugs
  for update using (public.current_role() = 'admin');

create policy "EventPreviousSlugs: admin delete" on public.event_previous_slugs
  for delete using (public.current_role() = 'admin');

-- ---------------------------------------------------------------------------
-- „Nur anzeigen" nicht, solange gültige Tickets bestehen
-- ---------------------------------------------------------------------------
-- Die Verwaltung prüft das schon und nennt die Zahl. Hier gilt es für jeden
-- Weg — sonst gäbe es gültige Tickets für ein Event, das keine verkauft.
--
-- SECURITY DEFINER mit Absicht: Liefe die Prüfung mit den Rechten des
-- Aufrufers, könnte eine RLS-Regel die Tickets unsichtbar machen, die Abfrage
-- käme leer zurück, und die Sperre ließe durch, was sie verhindern soll.
create or replace function public.events_verkaufsart_pruefen()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.sales_mode = 'display'
     and old.sales_mode is distinct from 'display'
     and exists (
       select 1 from tickets
       where event_id = new.id and status in ('reserved', 'confirmed', 'checked_in')
     )
  then
    raise exception 'event has valid tickets';
  end if;
  return new;
end;
$function$;

create trigger events_verkaufsart_pruefen
  before update of sales_mode on public.events
  for each row execute function public.events_verkaufsart_pruefen();

-- ---------------------------------------------------------------------------
-- Ticketkauf: bis zum Ende, und nur bei „Tickets in der App"
-- ---------------------------------------------------------------------------
-- Gleiche Signatur wie in PROJ-42, deshalb `create or replace` ohne `drop`:
-- So bleiben die vergebenen Berechtigungen der Funktion erhalten.
create or replace function public.purchase_event_ticket(
  p_event_id uuid,
  p_payment_method text,
  p_wants_student_price boolean,
  p_terms_accepted boolean default false,
  p_terms_version text default null
)
returns tickets
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := auth.uid();
  v_event events;
  v_used int;
  v_price numeric;
  v_status text;
  v_row tickets;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  if not coalesce(p_terms_accepted, false) then
    raise exception 'terms not accepted';
  end if;
  if p_terms_version is null or trim(p_terms_version) = '' then
    raise exception 'terms version missing';
  end if;

  if p_payment_method not in ('sepa', 'onsite') then
    raise exception 'invalid payment method';
  end if;

  select * into v_event from events where id = p_event_id for update;

  if v_event is null then
    raise exception 'event not found';
  end if;
  if v_event.status <> 'geplant' then
    raise exception 'event not open';
  end if;
  -- PROJ-53: Ein Event, das nur angezeigt wird, verkauft keine Tickets —
  -- auch nicht über einen direkten Aufruf an der Oberfläche vorbei.
  if v_event.sales_mode <> 'tickets' then
    raise exception 'event not open';
  end if;
  -- PROJ-53: Kaufbar bis zum Ende, nicht nur bis zum Beginn. Ohne Ende gilt
  -- das Event bis Mitternacht Wiener Zeit — dieselbe Grenze wie `eventEnde`
  -- in der App. Die Datenbank rechnet in UTC; ohne ausdrückliche Zeitzone
  -- endete der Tag im Sommer um 2 Uhr früh.
  if coalesce(
       v_event.ends_at,
       ((v_event.starts_at at time zone 'Europe/Vienna')::date + 1)::timestamp at time zone 'Europe/Vienna'
     ) <= now() then
    raise exception 'event not open';
  end if;

  select count(*) into v_used
  from tickets
  where event_id = p_event_id and status in ('reserved', 'confirmed', 'checked_in');

  if v_event.capacity is not null and v_used >= v_event.capacity then
    raise exception 'event is full';
  end if;

  if p_payment_method = 'sepa' then
    if not exists (
      select 1 from sepa_mandates where customer_id = v_customer_id and revoked_at is null
    ) then
      raise exception 'no active mandate';
    end if;
    v_status := 'confirmed';
  else
    v_status := 'reserved';
  end if;

  v_price := case when p_wants_student_price then v_event.price_student else v_event.price_normal end;

  insert into tickets (
    event_id, customer_id, payment_method, wants_student_price, price, status,
    terms_accepted_at, terms_version
  )
  values (
    p_event_id, v_customer_id, p_payment_method, p_wants_student_price, v_price, v_status,
    now(), p_terms_version
  )
  returning * into v_row;

  return v_row;
end;
$function$;
