-- PROJ-56: Ticketarten, Pässe und Einheiten.
--
-- Der größte Umbau der Event-Reihe. Bisher ist ein Event ein Termin mit einem
-- Preis; künftig kann es ein Programm aus Einheiten haben und mehrere
-- Ticketarten, die je eigene Einheiten abdecken.
--
-- Der Kern in einem Satz: Ein Ticket ist nicht mehr „für das Event", sondern
-- für eine Ticketart — und die sagt, für welche Einheiten es gilt.
--
-- Alles, was heute ohne Einheiten läuft, läuft weiter: Ein Event ohne
-- Einheiten ist ein Event mit einem Termin und einer Ticketart.
--
-- Reihenfolge beim Ausliefern: erst diese Migration, dann der Code.

-- ---------------------------------------------------------------------------
-- Das Event bekommt drei Angaben
-- ---------------------------------------------------------------------------

alter table public.events
  add column payment_methods text not null default 'both'
    check (payment_methods in ('sepa', 'onsite', 'both')),
  -- In Tagen. 0 heißt: stornieren bis zum Beginn.
  add column cancellation_lead_days int not null default 1 check (cancellation_lead_days >= 0),
  add column role_query_enabled boolean not null default false,
  add column max_role_difference int check (max_role_difference >= 0);

-- ---------------------------------------------------------------------------
-- Einheiten — das Programm eines Workshops
-- ---------------------------------------------------------------------------

create table public.event_units (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity int check (capacity > 0),
  created_at timestamptz not null default now(),
  constraint event_units_ende_nach_beginn check (ends_at is null or ends_at >= starts_at)
);

create index idx_event_units_event_id on public.event_units(event_id, starts_at);

alter table public.event_units enable row level security;

-- Öffentlich lesbar: Das Programm steht auf der Eventseite.
create policy "EventUnits: public read" on public.event_units
  for select using (true);

create policy "EventUnits: admin insert" on public.event_units
  for insert with check (public.current_role() = 'admin');

create policy "EventUnits: admin update" on public.event_units
  for update using (public.current_role() = 'admin');

create policy "EventUnits: admin delete" on public.event_units
  for delete using (public.current_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Ticketarten
-- ---------------------------------------------------------------------------

create table public.event_ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  price_normal numeric not null check (price_normal >= 0),
  price_student numeric not null check (price_student >= 0),
  -- Höchstzahl dieser Art insgesamt; leer heißt: so viele, wie in die
  -- Einheiten passen.
  quota int check (quota > 0),
  scope text not null default 'all' check (scope in ('all', 'selected', 'choice')),
  on_sale boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_event_ticket_types_event_id on public.event_ticket_types(event_id, position);

alter table public.event_ticket_types enable row level security;

create policy "EventTicketTypes: public read" on public.event_ticket_types
  for select using (true);

create policy "EventTicketTypes: admin insert" on public.event_ticket_types
  for insert with check (public.current_role() = 'admin');

create policy "EventTicketTypes: admin update" on public.event_ticket_types
  for update using (public.current_role() = 'admin');

create policy "EventTicketTypes: admin delete" on public.event_ticket_types
  for delete using (public.current_role() = 'admin');

-- Welche Einheiten zu einer Ticketart mit fester Geltung gehören.
create table public.event_ticket_type_units (
  ticket_type_id uuid not null references public.event_ticket_types(id) on delete cascade,
  unit_id uuid not null references public.event_units(id) on delete cascade,
  primary key (ticket_type_id, unit_id)
);

create index idx_event_ticket_type_units_unit on public.event_ticket_type_units(unit_id);

alter table public.event_ticket_type_units enable row level security;

create policy "EventTicketTypeUnits: public read" on public.event_ticket_type_units
  for select using (true);

create policy "EventTicketTypeUnits: admin insert" on public.event_ticket_type_units
  for insert with check (public.current_role() = 'admin');

create policy "EventTicketTypeUnits: admin delete" on public.event_ticket_type_units
  for delete using (public.current_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Gäste von Hand
-- ---------------------------------------------------------------------------
-- Lehrer, Freunde des Hauses. Kein Konto, kein Preis, kein QR-Code — sie
-- stehen auf der Liste, mehr nicht. Ein Ticket hängt an einem Konto, und
-- daran hängen Storno, „Meine Tickets" und der Sammellauf; ein Gast ohne
-- Konto ließe sich dort nur unterbringen, indem all das aufgeweicht wird.

create table public.event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  note text check (note is null or length(note) <= 300),
  dance_role text check (dance_role in ('leader', 'follower', 'both')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_event_guests_event_id on public.event_guests(event_id);

alter table public.event_guests enable row level security;

-- Namen von Gästen sind personenbezogen — sie gehen nur das Studio etwas an.
create policy "EventGuests: staff read" on public.event_guests
  for select using (public.current_role() in ('admin', 'teacher'));

create policy "EventGuests: admin insert" on public.event_guests
  for insert with check (public.current_role() = 'admin');

create policy "EventGuests: admin update" on public.event_guests
  for update using (public.current_role() = 'admin');

create policy "EventGuests: admin delete" on public.event_guests
  for delete using (public.current_role() = 'admin');

create table public.event_guest_units (
  guest_id uuid not null references public.event_guests(id) on delete cascade,
  unit_id uuid not null references public.event_units(id) on delete cascade,
  primary key (guest_id, unit_id)
);

alter table public.event_guest_units enable row level security;

create policy "EventGuestUnits: staff read" on public.event_guest_units
  for select using (public.current_role() in ('admin', 'teacher'));

create policy "EventGuestUnits: admin insert" on public.event_guest_units
  for insert with check (public.current_role() = 'admin');

create policy "EventGuestUnits: admin delete" on public.event_guest_units
  for delete using (public.current_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Das Ticket bekommt vier Angaben
-- ---------------------------------------------------------------------------

alter table public.tickets
  add column ticket_type_id uuid references public.event_ticket_types(id) on delete restrict,
  add column unit_id uuid references public.event_units(id) on delete restrict,
  add column dance_role text check (dance_role in ('leader', 'follower', 'both')),
  -- Eingefroren beim Kauf: Ändert der Admin die Frist später, gilt für schon
  -- verkaufte Tickets weiter, was beim Kauf zugesagt war (PROJ-42).
  add column cancellation_lead_days int not null default 1 check (cancellation_lead_days >= 0);

create index idx_tickets_ticket_type_id on public.tickets(ticket_type_id);
create index idx_tickets_unit_id on public.tickets(unit_id);

-- ---------------------------------------------------------------------------
-- Einlass je Einheit
-- ---------------------------------------------------------------------------
-- Ein Pass für drei Einheiten wird dreimal gescannt und hinterlässt drei
-- Zeilen. Nur so lässt sich „bereits eingecheckt um 14:05" für die eine
-- Einheit sagen und die nächste offen lassen.

create table public.event_checkins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete cascade,
  guest_id uuid references public.event_guests(id) on delete cascade,
  -- Leer heißt: ein Event ohne Programm, ein Einlass für das Ganze.
  unit_id uuid references public.event_units(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references auth.users(id),
  constraint event_checkins_genau_einer check (
    (ticket_id is not null and guest_id is null) or (ticket_id is null and guest_id is not null)
  )
);

-- Je Ticket und Einheit höchstens einmal. Ohne Einheit genau einmal je Ticket.
create unique index event_checkins_ticket_einheit
  on public.event_checkins(ticket_id, unit_id)
  where ticket_id is not null and unit_id is not null;

create unique index event_checkins_ticket_ohne_einheit
  on public.event_checkins(ticket_id)
  where ticket_id is not null and unit_id is null;

create unique index event_checkins_gast_einheit
  on public.event_checkins(guest_id, unit_id)
  where guest_id is not null and unit_id is not null;

create unique index event_checkins_gast_ohne_einheit
  on public.event_checkins(guest_id)
  where guest_id is not null and unit_id is null;

alter table public.event_checkins enable row level security;

create policy "EventCheckins: staff read" on public.event_checkins
  for select using (public.current_role() in ('admin', 'teacher'));

-- Geschrieben wird ausschließlich über die Check-in-Funktionen; die laufen
-- mit erhöhten Rechten und prüfen vorher, ob das Ticket überhaupt gilt.

-- ---------------------------------------------------------------------------
-- Bestand übernehmen
-- ---------------------------------------------------------------------------
-- Jedes Event mit Ticketverkauf bekommt die Ticketart „Ticket" mit seinen
-- bisherigen Preisen. Danach zeigen seine Tickets darauf. Niemand muss etwas
-- von Hand nachtragen.

insert into public.event_ticket_types (event_id, name, price_normal, price_student, scope, on_sale, position)
select id, 'Ticket', coalesce(price_normal, 0), coalesce(price_student, price_normal, 0), 'all', true, 0
from public.events
where sales_mode = 'tickets';

update public.tickets t
set ticket_type_id = tt.id
from public.event_ticket_types tt
where tt.event_id = t.event_id and t.ticket_type_id is null;

-- ---------------------------------------------------------------------------
-- Belegung je Einheit
-- ---------------------------------------------------------------------------
-- Ein Ticket zählt in jeder Einheit, für die seine Art gilt — ein Full Pass
-- also in allen. Sonst wären drei Einheiten à 20 Plätze zusammen 60 Tickets
-- für einen Raum, in dem 20 Leute stehen.
--
-- SECURITY DEFINER wie get_event_occupancy (PROJ-12): Die Zahl darf jeder
-- sehen, die Tickets dahinter nicht.
create or replace function public.get_event_unit_occupancy(p_event_id uuid)
returns table(unit_id uuid, ticket_count bigint)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    u.id as unit_id,
    count(t.id) as ticket_count
  from event_units u
  left join tickets t
    on t.event_id = u.event_id
   and t.status in ('reserved', 'confirmed', 'checked_in')
   and exists (
     select 1 from event_ticket_types tt
     where tt.id = t.ticket_type_id
       and (
         tt.scope = 'all'
         or (tt.scope = 'choice' and t.unit_id = u.id)
         or (tt.scope = 'selected' and exists (
           select 1 from event_ticket_type_units m where m.ticket_type_id = tt.id and m.unit_id = u.id
         ))
       )
   )
  where u.event_id = p_event_id
  group by u.id;
$function$;

revoke all on function public.get_event_unit_occupancy(uuid) from public, anon;
grant execute on function public.get_event_unit_occupancy(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ticketkauf
-- ---------------------------------------------------------------------------
-- Gleiche Signatur bis auf drei neue Parameter mit Vorgabewert, deshalb
-- `create or replace` ohne `drop`: So bleiben die vergebenen Rechte erhalten.
create or replace function public.purchase_event_ticket(
  p_event_id uuid,
  p_payment_method text,
  p_wants_student_price boolean,
  p_terms_accepted boolean default false,
  p_terms_version text default null,
  p_ticket_type_id uuid default null,
  p_unit_id uuid default null,
  p_dance_role text default null
)
returns tickets
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := auth.uid();
  v_event events;
  v_art event_ticket_types;
  v_arten int;
  v_used int;
  v_price numeric;
  v_status text;
  v_zahlung text := p_payment_method;
  v_rolle text := nullif(p_dance_role, '');
  v_leader int;
  v_follower int;
  v_einheit record;
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

  -- Gesperrt wird das Event, nicht die einzelne Einheit: Ein Full Pass und ein
  -- Einzelticket dürfen nicht gleichzeitig denselben letzten Platz bekommen.
  select * into v_event from events where id = p_event_id for update;

  if v_event is null then
    raise exception 'event not found';
  end if;
  if v_event.status <> 'geplant' then
    raise exception 'event not open';
  end if;
  if v_event.sales_mode <> 'tickets' then
    raise exception 'event not open';
  end if;
  if coalesce(
       v_event.ends_at,
       ((v_event.starts_at at time zone 'Europe/Vienna')::date + 1)::timestamp at time zone 'Europe/Vienna'
     ) <= now() then
    raise exception 'event not open';
  end if;

  -- Ticketart bestimmen
  if p_ticket_type_id is not null then
    select * into v_art from event_ticket_types
      where id = p_ticket_type_id and event_id = p_event_id;
    if v_art.id is null or not v_art.on_sale then
      raise exception 'ticket type unavailable';
    end if;
  else
    select count(*) into v_arten from event_ticket_types where event_id = p_event_id and on_sale;
    if v_arten = 1 then
      select * into v_art from event_ticket_types where event_id = p_event_id and on_sale;
    elsif v_arten > 1 then
      -- Mehrere Arten und keine gewählt: Der Kauf muss sagen, welche.
      raise exception 'ticket type unavailable';
    end if;
  end if;

  -- Einheit prüfen
  if v_art.id is not null and v_art.scope = 'choice' then
    if p_unit_id is null then
      raise exception 'unit required';
    end if;
    perform 1 from event_units where id = p_unit_id and event_id = p_event_id;
    if not found then
      raise exception 'unit not valid';
    end if;
  elsif p_unit_id is not null then
    -- Eine Einheit anzugeben, wo keine zu wählen ist, wäre ein Missverständnis
    -- — und stünde später als Angabe am Ticket, die nichts bedeutet.
    raise exception 'unit not valid';
  end if;

  -- Zahlungsart gegen die Erlaubnis des Events
  if v_event.payment_methods = 'sepa' and p_payment_method <> 'sepa' then
    raise exception 'payment method not allowed';
  end if;
  if v_event.payment_methods = 'onsite' and p_payment_method <> 'onsite' then
    raise exception 'payment method not allowed';
  end if;

  -- Kontingent der Ticketart
  if v_art.id is not null and v_art.quota is not null then
    select count(*) into v_used from tickets
      where ticket_type_id = v_art.id and status in ('reserved', 'confirmed', 'checked_in');
    if v_used >= v_art.quota then
      raise exception 'event is full';
    end if;
  end if;

  -- Kapazität je Einheit, für jede Einheit, die dieses Ticket belegen würde
  for v_einheit in
    select u.id, u.capacity
    from event_units u
    where u.event_id = p_event_id
      and u.capacity is not null
      and (
        v_art.id is null
        or v_art.scope = 'all'
        or (v_art.scope = 'choice' and u.id = p_unit_id)
        or (v_art.scope = 'selected' and exists (
          select 1 from event_ticket_type_units m where m.ticket_type_id = v_art.id and m.unit_id = u.id
        ))
      )
  loop
    select o.ticket_count into v_used
    from public.get_event_unit_occupancy(p_event_id) o
    where o.unit_id = v_einheit.id;

    if coalesce(v_used, 0) >= v_einheit.capacity then
      raise exception 'event is full';
    end if;
  end loop;

  -- Kapazität des Events selbst — gilt weiter für Events ohne Programm
  if v_event.capacity is not null then
    select count(*) into v_used from tickets
      where event_id = p_event_id and status in ('reserved', 'confirmed', 'checked_in');
    if v_used >= v_event.capacity then
      raise exception 'event is full';
    end if;
  end if;

  -- Tanzrolle: nicht feste Plätze je Rolle, sondern ein größter erlaubter
  -- Abstand — dieselbe Regel wie bei den Kursen (PROJ-30).
  if v_event.role_query_enabled and v_event.max_role_difference is not null
     and v_rolle in ('leader', 'follower') then
    select
      count(*) filter (where dance_role = 'leader'),
      count(*) filter (where dance_role = 'follower')
      into v_leader, v_follower
    from tickets
    where event_id = p_event_id and status in ('reserved', 'confirmed', 'checked_in');

    if v_rolle = 'leader' then
      v_leader := v_leader + 1;
    else
      v_follower := v_follower + 1;
    end if;

    if abs(v_leader - v_follower) > v_event.max_role_difference then
      raise exception 'role imbalance';
    end if;
  end if;

  -- Preis: aus der Ticketart, sonst wie bisher aus dem Event
  if v_art.id is not null then
    v_price := case when p_wants_student_price then v_art.price_student else v_art.price_normal end;
  else
    v_price := case when p_wants_student_price then v_event.price_student else v_event.price_normal end;
  end if;

  if coalesce(v_price, 0) = 0 then
    -- Kostenlos: keine Zahlungsart, kein Mandat, sofort bestätigt.
    v_zahlung := 'onsite';
    v_status := 'confirmed';
  elsif p_payment_method = 'sepa' then
    if not exists (
      select 1 from sepa_mandates where customer_id = v_customer_id and revoked_at is null
    ) then
      raise exception 'no active mandate';
    end if;
    v_status := 'confirmed';
  else
    v_status := 'reserved';
  end if;

  insert into tickets (
    event_id, customer_id, payment_method, wants_student_price, price, status,
    terms_accepted_at, terms_version, ticket_type_id, unit_id, dance_role,
    cancellation_lead_days
  )
  values (
    p_event_id, v_customer_id, v_zahlung, p_wants_student_price, v_price, v_status,
    now(), p_terms_version, v_art.id, p_unit_id, v_rolle,
    v_event.cancellation_lead_days
  )
  returning * into v_row;

  return v_row;
end;
$function$;

revoke all on function public.purchase_event_ticket(uuid, text, boolean, boolean, text, uuid, uuid, text)
  from public, anon;
grant execute on function public.purchase_event_ticket(uuid, text, boolean, boolean, text, uuid, uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Stornieren mit der Frist, die beim Kauf galt
-- ---------------------------------------------------------------------------
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
  v_frist int;
  v_row tickets;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  select t.customer_id, t.status, e.starts_at, e.moved_at, t.cancellation_lead_days
    into v_ticket_customer_id, v_status, v_starts_at, v_moved_at, v_frist
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

  -- PROJ-54: Verlegt — die Frist entfällt, der Abend selbst ist die Grenze.
  if v_moved_at is not null then
    if v_starts_at <= now() then
      raise exception 'cancellation deadline passed';
    end if;
  -- PROJ-56: Sonst gilt die Frist, die beim Kauf am Ticket festgehalten wurde.
  -- 0 Tage heißt: bis zum Beginn.
  elsif coalesce(v_frist, 1) <= 0 then
    if v_starts_at <= now() then
      raise exception 'cancellation deadline passed';
    end if;
  elsif (((v_starts_at at time zone 'Europe/Vienna')::date) - public.heute_wien()) < coalesce(v_frist, 1) then
    raise exception 'cancellation deadline passed';
  end if;

  update tickets
  set status = 'cancelled'
  where id = p_ticket_id
  returning * into v_row;

  return v_row;
end;
$function$;

revoke all on function public.cancel_event_ticket(uuid) from public, anon;
grant execute on function public.cancel_event_ticket(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Check-in je Einheit
-- ---------------------------------------------------------------------------
-- Bei einer Serie heißen alle Termine gleich (PROJ-54); bei einem Workshop
-- gilt ein Einzelticket nur für seine Einheit. Geprüft wird beides hier.
drop function if exists public.checkin_event_ticket(uuid, uuid);

create or replace function public.checkin_event_ticket(
  p_ticket_id uuid,
  p_event_id uuid,
  p_unit_id uuid default null
)
returns public.tickets
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_row tickets;
  v_existing tickets;
  v_gilt boolean;
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

  if v_existing.status = 'cancelled' then
    raise exception 'ticket cancelled';
  end if;

  if p_unit_id is not null then
    perform 1 from event_units where id = p_unit_id and event_id = p_event_id;
    if not found then
      raise exception 'unit not valid';
    end if;

    -- Gilt das Ticket für diese Einheit?
    select exists (
      select 1 from event_ticket_types tt
      where tt.id = v_existing.ticket_type_id
        and (
          tt.scope = 'all'
          or (tt.scope = 'choice' and v_existing.unit_id = p_unit_id)
          or (tt.scope = 'selected' and exists (
            select 1 from event_ticket_type_units m
            where m.ticket_type_id = tt.id and m.unit_id = p_unit_id
          ))
        )
    ) into v_gilt;

    -- Ein Ticket ohne Ticketart stammt aus der Zeit vor PROJ-56 und gilt für
    -- das ganze Event.
    if v_existing.ticket_type_id is null then
      v_gilt := true;
    end if;

    if not v_gilt then
      raise exception 'ticket not for unit';
    end if;

    begin
      insert into event_checkins (ticket_id, unit_id, checked_in_by)
      values (p_ticket_id, p_unit_id, auth.uid());
    exception when unique_violation then
      raise exception 'already checked in';
    end;

    -- Das Ticket selbst gilt ab dem ersten Einlass als eingecheckt: Daran
    -- hängen die Gästeliste und bei Barzahlung „gescannt heißt bezahlt".
    update tickets
    set status = 'checked_in',
        checked_in_at = coalesce(checked_in_at, now()),
        checked_in_by = coalesce(checked_in_by, auth.uid())
    where id = p_ticket_id and status in ('reserved', 'confirmed')
    returning * into v_row;

    if v_row.id is null then
      select * into v_row from tickets where id = p_ticket_id;
    end if;
    return v_row;
  end if;

  -- Ohne Programm: ein Einlass für das Ganze, wie seit PROJ-14.
  update tickets
  set status = 'checked_in', checked_in_at = now(), checked_in_by = auth.uid()
  where id = p_ticket_id and status in ('reserved', 'confirmed')
  returning * into v_row;

  if v_row.id is not null then
    insert into event_checkins (ticket_id, unit_id, checked_in_by)
    values (p_ticket_id, null, auth.uid())
    on conflict do nothing;
    return v_row;
  end if;

  select * into v_existing from tickets where id = p_ticket_id;

  if v_existing.status = 'checked_in' then
    raise exception 'already checked in';
  else
    raise exception 'ticket not eligible';
  end if;
end;
$function$;

revoke all on function public.checkin_event_ticket(uuid, uuid, uuid) from public, anon;
grant execute on function public.checkin_event_ticket(uuid, uuid, uuid) to authenticated;

-- Gäste von Hand haben keinen QR-Code — sie kommen über die Namenssuche.
create or replace function public.checkin_event_guest(
  p_guest_id uuid,
  p_event_id uuid,
  p_unit_id uuid default null
)
returns public.event_guests
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_gast event_guests;
  v_eigene int;
begin
  if "current_role"() not in ('admin', 'teacher') then
    raise exception 'not authorized';
  end if;

  select * into v_gast from event_guests where id = p_guest_id;
  if v_gast.id is null then
    raise exception 'guest not found';
  end if;
  if p_event_id is null or v_gast.event_id <> p_event_id then
    raise exception 'guest for other event';
  end if;

  if p_unit_id is not null then
    perform 1 from event_units where id = p_unit_id and event_id = p_event_id;
    if not found then
      raise exception 'unit not valid';
    end if;

    -- Keine Zuordnung heißt: für alle Einheiten.
    select count(*) into v_eigene from event_guest_units where guest_id = p_guest_id;
    if v_eigene > 0 then
      perform 1 from event_guest_units where guest_id = p_guest_id and unit_id = p_unit_id;
      if not found then
        raise exception 'guest not for unit';
      end if;
    end if;
  end if;

  begin
    insert into event_checkins (guest_id, unit_id, checked_in_by)
    values (p_guest_id, p_unit_id, auth.uid());
  exception when unique_violation then
    raise exception 'already checked in';
  end;

  return v_gast;
end;
$function$;

revoke all on function public.checkin_event_guest(uuid, uuid, uuid) from public, anon;
grant execute on function public.checkin_event_guest(uuid, uuid, uuid) to authenticated;
