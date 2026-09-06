-- PROJ-47: Die Freigabe, und die Sperre danach.
--
-- Rechnungen, Ankuendigungen und Stempel entstehen gemeinsam oder gar nicht.
-- Ein halb freigegebener Lauf, bei dem Rechnungen existieren und die Kunden
-- nichts wissen, laesst sich so nicht herstellen.
--
-- Moeglich ist das, weil die Benachrichtigungs-Warteschlange nur Empfaenger,
-- Anlass und Bezug speichert -- der Text entsteht erst beim Versand. Sonst
-- muesste die Anwendung die Ankuendigungen schreiben, und der Vorgang zerfiele
-- wieder in Schritte.
create or replace function public.release_collection_run(p_run_id uuid)
returns sepa_collection_runs
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_lauf sepa_collection_runs;
  v_anzahl int;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;

  -- Sperren, bevor irgendetwas geprueft wird: Zwei Betreiber, die gleichzeitig
  -- freigeben, duerfen keine zwei Rechnungssaetze erzeugen.
  select * into v_lauf from sepa_collection_runs where id = p_run_id for update;
  if v_lauf.id is null then
    raise exception 'collection run not found';
  end if;
  if v_lauf.released_at is not null then
    raise exception 'collection run already released';
  end if;

  select count(*) into v_anzahl from sepa_collection_items where run_id = p_run_id;
  if v_anzahl = 0 then
    -- Ein leerer Lauf ergaebe eine Bankdatei ohne Zeilen und Rechnungen ohne
    -- Anlass.
    raise exception 'collection run has no items';
  end if;

  -- Erst stempeln, dann die Rechnungen: Der Waechter auf den Positionen greift
  -- ab diesem Moment, und die Rechnungserstellung liest nur.
  update sepa_collection_runs
  set released_at = now(), released_by = auth.uid()
  where id = p_run_id
  returning * into v_lauf;

  perform create_invoices_for_collection_run(p_run_id);

  -- Die Vorabankuendigung nennt den Betrag nach Guthabenverrechnung und nach
  -- allen Korrekturen -- eine Ankuendigung, die mehr nennt als abgebucht wird,
  -- ist keine. Der Schluessel haelt den Lauf fest, damit ein Korrekturlauf zum
  -- selben Faelligkeitsdatum seine eigene Ankuendigung bekommt.
  insert into notification_queue (customer_id, event_type, payload, dedupe_key, status)
  select
    i.customer_id,
    'sepa_ankuendigung',
    jsonb_build_object('amount', i.amount, 'due_date', v_lauf.due_date),
    'sepa_item:' || coalesce(i.subscription_id, i.event_ticket_id)::text || ':' || p_run_id::text,
    'pending'
  from sepa_collection_items i
  where i.run_id = p_run_id
  on conflict (dedupe_key) do nothing;

  return v_lauf;
end;
$function$;

comment on function public.release_collection_run(uuid) is
  'PROJ-47: gibt einen Entwurf frei -- Rechnungen, Vorabankuendigungen und Sperre in einem Zug.';

revoke execute on function public.release_collection_run(uuid) from public, anon;
grant execute on function public.release_collection_run(uuid) to authenticated, service_role;

-- Die Sperre gehoert hierher und nicht in die Oberflaeche. Eine ausgeblendete
-- Schaltflaeche ist keine Sperre.
create or replace function public.sepa_positionen_nach_freigabe_gesperrt()
returns trigger
language plpgsql
as $function$
declare
  v_run_id uuid := coalesce(new.run_id, old.run_id);
  v_freigegeben timestamptz;
begin
  select released_at into v_freigegeben from sepa_collection_runs where id = v_run_id;
  if v_freigegeben is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Zu einem freigegebenen Lastschriftlauf laesst sich keine Position hinzufuegen';
  end if;

  if tg_op = 'DELETE' then
    -- Wie bei den Belegen in PROJ-46: Wer den Dienstschluessel hat, umgeht
    -- ohnehin jede RLS-Regel. Die Ausnahme haelt das Zuruecksetzen der
    -- Testdatenbank offen, ohne den Weg zu oeffnen, auf dem Fehler passieren.
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception 'Aus einem freigegebenen Lastschriftlauf laesst sich keine Position entfernen';
    end if;
    return old;
  end if;

  -- Aenderbar bleibt nur, was den Einzug betrifft. Der Rest steht fest, sobald
  -- die Bankdatei erzeugt werden kann.
  if new.amount is distinct from old.amount
     or new.customer_id is distinct from old.customer_id
     or new.subscription_id is distinct from old.subscription_id
     or new.event_ticket_id is distinct from old.event_ticket_id
     or new.iban is distinct from old.iban
     or new.account_holder_name is distinct from old.account_holder_name
     or new.mandate_reference is distinct from old.mandate_reference
     or new.run_id is distinct from old.run_id then
    raise exception 'An einem freigegebenen Lastschriftlauf laesst sich der Betrag nicht mehr aendern';
  end if;

  return new;
end;
$function$;

create trigger sepa_positionen_gesperrt
  before insert or update or delete on public.sepa_collection_items
  for each row execute function public.sepa_positionen_nach_freigabe_gesperrt();
