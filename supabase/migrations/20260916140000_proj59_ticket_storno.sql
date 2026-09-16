-- PROJ-59: Ticket stornieren durch die Verwaltung.
--
-- Die bestehende Stornierung ist für Kunden gebaut: Sie prüft, ob das Ticket
-- dem Aufrufer gehört, und ob die Frist noch läuft. Beides soll hier gerade
-- nicht gelten. Statt diesen empfindlichen Weg mit Verzweigungen zu versehen,
-- bekommt die Verwaltung eine eigene Funktion mit eigenen Regeln.

-- ---------------------------------------------------------------------------
-- 1. Was am Ticket festgehalten wird
-- ---------------------------------------------------------------------------
-- Ohne diese drei Angaben ließe sich später nicht klären, warum ein Platz frei
-- wurde — und die Nachricht an den Kunden braucht den Grund ohnehin.

alter table public.tickets
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_reason text;

-- ---------------------------------------------------------------------------
-- 2. Die Benachrichtigung
-- ---------------------------------------------------------------------------
-- Die Prüfbedingung listet die erlaubten Ereignistypen einzeln auf. Fehlt der
-- Eintrag, verschwindet die Nachricht lautlos — in diesem Projekt schon
-- zweimal passiert.

alter table public.notification_queue drop constraint notification_queue_event_type_check;

alter table public.notification_queue add constraint notification_queue_event_type_check
  check (event_type = any (array[
    'buchungsstatus',
    'warteliste',
    'abo_kuendigung',
    'kursstart_erinnerung',
    'sepa_ankuendigung',
    'event_tickets',
    'probestunde_nachfassung',
    'newsletter',
    'neue_buchung',
    'zahlungserinnerung',
    'kursausfall',
    'guthaben',
    'konto_existiert',
    'kursumwandlung',
    'zweite_stufe_zurueckgesetzt',
    'ticket_storniert'
  ]));

-- ---------------------------------------------------------------------------
-- 3. Stornieren und gutschreiben — in einem Schritt
-- ---------------------------------------------------------------------------
-- Getrennt ausgeführt könnte ein Abbruch ein storniertes Ticket ohne Gutschrift
-- hinterlassen: Der Kunde hätte weder Platz noch Geld.
--
-- Die Rechteprüfung steht hier und nicht nur in der Oberfläche. Damit erbt sie
-- die Zwei-Faktor-Pflicht aus PROJ-58: Wer den Code nicht bestätigt hat, gilt
-- für `current_role()` nicht als Admin — auch nicht an den Seiten vorbei.

create or replace function public.admin_ticket_stornieren(
  p_ticket_id uuid,
  p_grund text default null,
  p_guthaben boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_status text;
  v_preis numeric;
  v_kunde uuid;
  v_event text;
  v_gutschrift numeric := 0;
begin
  if public.current_role() is distinct from 'admin' then
    raise exception 'not authorized';
  end if;

  -- Gesperrt gelesen: Zwei Admins, die gleichzeitig stornieren, dürfen nicht
  -- zwei Gutschriften erzeugen.
  select t.status, t.price, t.customer_id, e.name
    into v_status, v_preis, v_kunde, v_event
  from public.tickets t
  join public.events e on e.id = t.event_id
  where t.id = p_ticket_id
  for update of t;

  if not found then
    raise exception 'ticket not found';
  end if;

  -- Der Kunde kann in derselben Sekunde selbst storniert haben. Das ist kein
  -- Fehler, es ist nur nichts mehr zu tun — und eine Ausnahme hier wuerde dem
  -- Betreiber eine Stoerung melden, wo alles in Ordnung ist.
  if v_status = 'cancelled' then
    return jsonb_build_object('status', 'bereits_storniert', 'gutschrift', 0);
  end if;

  update public.tickets
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = v_admin,
         cancellation_reason = nullif(trim(coalesce(p_grund, '')), '')
   where id = p_ticket_id;

  -- Kein Guthaben ueber 0: Die Guthaben-Tabelle laesst Nullbetraege nicht zu,
  -- und eine Freikarte hat nichts zurueckzugeben.
  if p_guthaben and v_preis > 0 then
    insert into public.customer_credits (customer_id, amount, origin, reason, created_by)
    values (
      v_kunde,
      v_preis,
      'storno',
      'Storniertes Ticket: ' || coalesce(v_event, 'Event'),
      v_admin
    );
    v_gutschrift := v_preis;
  end if;

  return jsonb_build_object('status', 'storniert', 'gutschrift', v_gutschrift);
end;
$$;

revoke execute on function public.admin_ticket_stornieren(uuid, text, boolean) from public, anon;
grant execute on function public.admin_ticket_stornieren(uuid, text, boolean) to authenticated;

comment on function public.admin_ticket_stornieren(uuid, text, boolean) is
  'PROJ-59: Storniert ein Ticket und schreibt auf Wunsch den Betrag gut. Nur fuer Administratoren.';
