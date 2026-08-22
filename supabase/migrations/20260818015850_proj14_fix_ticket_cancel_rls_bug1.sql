
-- BUG-1 (QA, Critical): "Tickets: own cancel" had a USING clause but no
-- WITH CHECK, so a customer's own JWT could PATCH ANY column on their own
-- ticket row directly via the REST API (e.g. status='checked_in', price=0),
-- bypassing checkin_event_ticket()'s staff-only gate and SEPA billing.
-- Fixed by removing direct customer UPDATE access entirely and routing
-- cancellation through a SECURITY DEFINER RPC, mirroring the existing
-- purchase_event_ticket()/checkin_event_ticket() pattern for this feature.
drop policy "Tickets: own cancel" on tickets;

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
  v_row tickets;
begin
  if v_customer_id is null then
    raise exception 'not authenticated';
  end if;

  select t.customer_id, t.status, e.starts_at
    into v_ticket_customer_id, v_status, v_starts_at
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
  -- Lead-time policy: TICKET_CANCELLATION_LEAD_DAYS (currently 1) in
  -- src/lib/constants/events.ts — kept as a calendar-date comparison to
  -- mirror the app's own daysUntil() semantics as closely as SQL allows.
  if (v_starts_at::date - current_date) < 1 then
    raise exception 'cancellation deadline passed';
  end if;

  update tickets
  set status = 'cancelled'
  where id = p_ticket_id
  returning * into v_row;

  return v_row;
end;
$function$;
