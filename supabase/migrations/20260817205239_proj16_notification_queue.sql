-- PROJ-16: Notification queue (outbox) — internal table, no client access via PostgREST
create table public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('buchungsstatus', 'warteliste', 'abo_kuendigung', 'kursstart_erinnerung', 'sepa_ankuendigung')),
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text unique,
  status text not null default 'pending' check (status in ('pending', 'processed')),
  email_status text check (email_status in ('skipped', 'sent', 'failed')),
  push_status text check (push_status in ('skipped', 'sent', 'failed')),
  error_detail text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

-- RLS enabled, no policies: only SECURITY DEFINER functions (bypass RLS via owner)
-- and server-side code using the service-role key may read/write this table.
alter table public.notification_queue enable row level security;

create index idx_notification_queue_pending on public.notification_queue(status) where status = 'pending';
create index idx_notification_queue_customer_id on public.notification_queue(customer_id);

-- Internal helper: enqueue a notification. Not reachable via PostgREST (no grant to
-- anon/authenticated) — only callable from within other SECURITY DEFINER functions,
-- which run as the function owner and therefore retain access regardless of grants.
create or replace function public.enqueue_notification(
  p_customer_id uuid,
  p_event_type text,
  p_payload jsonb,
  p_dedupe_key text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into notification_queue (customer_id, event_type, payload, dedupe_key)
  values (p_customer_id, p_event_type, p_payload, p_dedupe_key)
  on conflict (dedupe_key) do nothing;
end;
$$;

revoke execute on function public.enqueue_notification(uuid, text, jsonb, text) from public, anon, authenticated;

-- Wire automatic waitlist promotion (PROJ-12) to enqueue a "warteliste" notification
-- for the promoted customer. This is the one trigger point that happens deep in SQL
-- (e.g. cascading from a customer cancelling their own booking), so it cannot make an
-- HTTP call itself — the queued row is picked up by the daily dispatch job instead.
create or replace function public.promote_waitlist_for_course(p_course_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_max int;
  v_used int;
  v_entry waitlist_entries;
  v_promoted int := 0;
begin
  select max_participants into v_max from courses where id = p_course_id;
  if v_max is null then
    return 0;
  end if;

  loop
    select
      (select count(*) from subscriptions where course_id = p_course_id and status = 'active')
      + (select count(*) from course_bookings where course_id = p_course_id and type = 'regular' and status = 'open')
    into v_used;

    exit when v_used >= v_max;

    select * into v_entry
    from waitlist_entries
    where course_id = p_course_id
    order by created_at asc
    limit 1;

    exit when v_entry is null;

    insert into course_bookings (customer_id, course_id, type, status, desired_plan, chosen_date)
    values (v_entry.customer_id, p_course_id, 'regular', 'open', v_entry.desired_plan, v_entry.chosen_date);

    perform enqueue_notification(
      v_entry.customer_id,
      'warteliste',
      jsonb_build_object('course_id', p_course_id, 'chosen_date', v_entry.chosen_date),
      'waitlist_promote:' || v_entry.id
    );

    delete from waitlist_entries where id = v_entry.id;
    v_promoted := v_promoted + 1;
  end loop;

  return v_promoted;
end;
$$;
