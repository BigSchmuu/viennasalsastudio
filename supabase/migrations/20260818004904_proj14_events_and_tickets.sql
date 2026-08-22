-- PROJ-14: Events & Workshops (Tickets, QR-Check-in)

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity int not null check (capacity > 0),
  price_normal numeric not null check (price_normal >= 0),
  price_student numeric not null check (price_student >= 0),
  status text not null default 'geplant' check (status in ('geplant', 'abgesagt')),
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create policy "Events: public read" on public.events
  for select using (true);

create policy "Events: admin write" on public.events
  for insert with check ("current_role"() = 'admin');

create policy "Events: admin update" on public.events
  for update using ("current_role"() = 'admin');

create policy "Events: admin delete" on public.events
  for delete using ("current_role"() = 'admin');

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  payment_method text not null check (payment_method in ('sepa', 'onsite')),
  wants_student_price boolean not null default false,
  price numeric not null,
  status text not null default 'reserved' check (status in ('reserved', 'confirmed', 'checked_in', 'cancelled')),
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.tickets enable row level security;

-- No direct insert policy: tickets are only created via purchase_event_ticket(),
-- which enforces the capacity check atomically (SECURITY DEFINER bypasses RLS).
create policy "Tickets: own or staff read" on public.tickets
  for select using (
    auth.uid() = customer_id or "current_role"() in ('admin', 'teacher')
  );

create policy "Tickets: own cancel" on public.tickets
  for update using (auth.uid() = customer_id);

create policy "Tickets: admin update" on public.tickets
  for update using ("current_role"() = 'admin');

create index idx_tickets_event_id on public.tickets(event_id);
create index idx_tickets_customer_id on public.tickets(customer_id);

-- Race-condition-safe purchase: locks the event row so two concurrent
-- purchases for the last spot can't both succeed (same pattern as
-- create_regular_course_booking from PROJ-8).
create or replace function public.purchase_event_ticket(
  p_event_id uuid,
  p_payment_method text,
  p_wants_student_price boolean
)
returns public.tickets
language plpgsql
security definer
set search_path to 'public'
as $$
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
  if v_event.starts_at <= now() then
    raise exception 'event not open';
  end if;

  select count(*) into v_used
  from tickets
  where event_id = p_event_id and status in ('reserved', 'confirmed', 'checked_in');

  if v_used >= v_event.capacity then
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

  insert into tickets (event_id, customer_id, payment_method, wants_student_price, price, status)
  values (p_event_id, v_customer_id, p_payment_method, p_wants_student_price, v_price, v_status)
  returning * into v_row;

  return v_row;
end;
$$;

-- Atomic check-in claim: only succeeds from 'reserved'/'confirmed', reports
-- distinctly if the ticket was already checked in vs. cancelled vs. missing.
create or replace function public.checkin_event_ticket(p_ticket_id uuid)
returns public.tickets
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row tickets;
  v_existing tickets;
begin
  if "current_role"() not in ('admin', 'teacher') then
    raise exception 'not authorized';
  end if;

  update tickets
  set status = 'checked_in', checked_in_at = now(), checked_in_by = auth.uid()
  where id = p_ticket_id and status in ('reserved', 'confirmed')
  returning * into v_row;

  if v_row.id is not null then
    return v_row;
  end if;

  select * into v_existing from tickets where id = p_ticket_id;

  if v_existing.id is null then
    raise exception 'ticket not found';
  elsif v_existing.status = 'checked_in' then
    raise exception 'already checked in';
  elsif v_existing.status = 'cancelled' then
    raise exception 'ticket cancelled';
  else
    raise exception 'ticket not eligible';
  end if;
end;
$$;
