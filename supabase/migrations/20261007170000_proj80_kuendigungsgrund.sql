-- PROJ-80: Der Kuendigungsgrund.
--
-- Bis hierher wusste niemand, warum gekuendigt wird. Die neue Uebersicht
-- (PROJ-79) zeigt, wer geht und wie lange er dabei war -- die Frage danach
-- ("warum?") liess sie offen.
--
-- Freiwillig, nicht Pflicht: Ein Pflichtfeld wuerde das Kuendigen schwerer
-- machen als das Abschliessen, und das ist bei Online-Vertraegen heikles
-- Terrain. Deshalb darf die Spalte immer null sein.
--
-- Zwei Spalten, weil zwei Dinge gemeint sind: `cancellation_reason` ist
-- auswertbar (feste Liste), `cancellation_note` faengt das Besondere auf. Nur
-- Freitext liesse sich nicht zaehlen, nur Liste verlor die Haelfte.

alter table public.subscriptions
  add column if not exists cancellation_reason text;

alter table public.subscriptions
  add column if not exists cancellation_note text;

-- Die Liste steht als CHECK in der Datenbank, nicht nur im Formular: Ein
-- Schreibzugriff von irgendwo sonst soll keinen Grund erfinden koennen, den die
-- Auswertung nicht kennt.
--
-- ACHTUNG fuer spaeter: Ein neuer Grund braucht eine Migration -- dieselbe
-- Falle wie bei notification_queue.event_type. Ohne sie scheitert das
-- Speichern, und zwar erst beim Kunden im Formular.
alter table public.subscriptions
  drop constraint if exists subscriptions_cancellation_reason_check;

alter table public.subscriptions
  add constraint subscriptions_cancellation_reason_check
  check (
    cancellation_reason is null
    or cancellation_reason = any (array[
      'zu_teuer',
      'keine_zeit',
      'umzug',
      'gesundheit',
      'kurs_passt_nicht',
      'sonstiges'
    ])
  );

comment on column public.subscriptions.cancellation_reason is
  'PROJ-80: Freiwilliger Kuendigungsgrund aus fester Liste. null = keine Angabe.';
comment on column public.subscriptions.cancellation_note is
  'PROJ-80: Freiwilliger Freitext zur Kuendigung. Ergaenzt den Grund, ersetzt ihn nicht.';

-- Die Selbstkuendigung nimmt Grund und Notiz mit.
--
-- `drop` und dann `create`, nicht `create or replace`: Zusaetzliche Parameter
-- ergeben in Postgres eine **zweite** Funktion mit eigener Signatur. Mit
-- Standardwerten waere ein Aufruf mit zwei Argumenten danach mehrdeutig
-- ("function is not unique") -- und zwar erst zur Laufzeit beim Kunden.
drop function if exists public.self_schedule_subscription_change(uuid, text);

create function public.self_schedule_subscription_change(
  p_subscription_id uuid,
  p_new_pending_status text,
  p_cancellation_reason text default null,
  p_cancellation_note text default null
)
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row subscriptions;
begin
  if p_new_pending_status not in ('paused', 'cancelled') then
    raise exception 'invalid pending status';
  end if;

  update subscriptions
  set pending_status = p_new_pending_status,
      pending_effective_date = next_cycle_end(cycle_anchor_date),
      -- Grund und Notiz gehoeren zur Kuendigung. Bei einer Pause werden sie
      -- geleert: Wer erst kuendigt, es zuruecknimmt und dann pausiert, haette
      -- sonst einen Grund am Abo, der nichts mehr erklaert.
      cancellation_reason = case when p_new_pending_status = 'cancelled'
        then nullif(trim(coalesce(p_cancellation_reason, '')), '') else null end,
      cancellation_note = case when p_new_pending_status = 'cancelled'
        then nullif(trim(coalesce(p_cancellation_note, '')), '') else null end
  where id = p_subscription_id
    and customer_id = auth.uid()
    and status = 'active'
    and pending_status is null
  returning * into v_row;

  if not found then
    raise exception 'subscription not eligible for this change';
  end if;

  return v_row;
end;
$$;

-- Nimmt der Kunde die Kuendigung zurueck, geht der Grund mit ihr.
create or replace function self_undo_pending_change(p_subscription_id uuid)
returns subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row subscriptions;
begin
  update subscriptions
  set pending_status = null,
      pending_effective_date = null,
      cancellation_reason = null,
      cancellation_note = null
  where id = p_subscription_id
    and customer_id = auth.uid()
    and pending_status is not null
  returning * into v_row;

  if not found then
    raise exception 'no pending change to undo';
  end if;

  return v_row;
end;
$$;

-- `drop`/`create` und `create or replace` setzen die Rechte zurueck, und
-- Supabase vergibt EXECUTE per Default-Privileg neu an `anon`. Siehe
-- .claude/rules/backend.md.
revoke all on function public.self_schedule_subscription_change(uuid, text, text, text) from public, anon;
revoke all on function public.self_undo_pending_change(uuid) from public, anon;

grant execute on function public.self_schedule_subscription_change(uuid, text, text, text) to authenticated;
grant execute on function public.self_undo_pending_change(uuid) to authenticated;
