-- PROJ-68: Die Vorabankündigung sagt jetzt, wofür abgebucht wird.
--
-- Eine Position im Lastschriftlauf ist entweder ein Abo oder ein Event-Ticket
-- (seit PROJ-14). Die Ankündigung bekam beides nicht mit — sie nannte nur
-- Betrag und Datum, und der Text war für beide derselbe. Ein Hinweis wie „Dein
-- Abo läuft weiter" hätte damit auch in der Ankündigung für ein Ticket
-- gestanden.
--
-- Die Art wandert deshalb in die Nutzlast. Entschieden wird sie hier, wo die
-- Position noch vorliegt; beim Versand ist nur noch die Warteschlangenzeile da.
--
-- Unveränderte Signatur: `create or replace` erhält damit die Rechte.

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
  --
  -- PROJ-68: `art` entscheidet beim Versand, welche der beiden Fassungen
  -- gilt -- die fuer ein Abo oder die fuer ein Ticket.
  insert into notification_queue (customer_id, event_type, payload, dedupe_key, status)
  select
    i.customer_id,
    'sepa_ankuendigung',
    jsonb_build_object(
      'amount', i.amount,
      'due_date', v_lauf.due_date,
      'art', case when i.subscription_id is not null then 'abo' else 'ticket' end
    ),
    'sepa_item:' || coalesce(i.subscription_id, i.event_ticket_id)::text || ':' || p_run_id::text,
    'pending'
  from sepa_collection_items i
  where i.run_id = p_run_id
  on conflict (dedupe_key) do nothing;

  return v_lauf;
end;
$function$;

comment on function public.release_collection_run(uuid) is
  'PROJ-47/PROJ-68: Gibt einen Lastschriftlauf frei -- Stempel, Rechnungen und Vorabankuendigungen in einem Zug. Die Ankuendigung traegt seit PROJ-68 die Art der Position (abo/ticket).';

-- Eine bereits angepasste Ankuendigung haengt am alten Schluessel. Ohne diesen
-- Schritt bliebe sie stehen und wuerde nie wieder verwendet -- der Betreiber
-- saehe ploetzlich wieder den Vorgabetext, ohne zu wissen, warum. Sie wird
-- deshalb auf beide neuen Fassungen uebernommen; wer beide anschliessend
-- unterschiedlich formulieren will, kann das jederzeit tun.
insert into public.notification_template_overrides
  (template_key, language, email_subject, email_body, push_title, push_body)
select
  neu.schluessel,
  alt.language,
  alt.email_subject,
  alt.email_body,
  alt.push_title,
  alt.push_body
from public.notification_template_overrides alt
cross join (values ('sepa_ankuendigung_abo'), ('sepa_ankuendigung_ticket')) as neu(schluessel)
where alt.template_key = 'sepa_ankuendigung'
on conflict (template_key, language) do nothing;

delete from public.notification_template_overrides where template_key = 'sepa_ankuendigung';
