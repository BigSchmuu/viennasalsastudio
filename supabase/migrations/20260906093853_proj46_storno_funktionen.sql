-- PROJ-46: Die beiden Vorgaenge. Beleg und Guthaben entstehen gemeinsam oder
-- gar nicht -- ein Beleg ohne Gutschrift waere eine Forderung, die der Kunde
-- nie zurueckbekommt; eine Gutschrift ohne Beleg waere Geld ohne Grund.

create or replace function public.create_invoice_document(
  p_invoice_id uuid,
  p_document_type text,
  p_amount numeric,
  p_reason text
)
returns invoices
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_rechnung invoices;
  v_bereits numeric;
  v_rest numeric;
  v_jahr int;
  v_nummer int;
  v_grund text := trim(coalesce(p_reason, ''));
  v_beleg invoices;
begin
  if "current_role"() <> 'admin' then
    raise exception 'not authorized';
  end if;
  if p_document_type not in ('cancellation', 'credit_note') then
    raise exception 'invalid document type';
  end if;
  if v_grund = '' then
    raise exception 'reason required';
  end if;

  -- Die Rechnung sperren: zwei gleichzeitige Stornos derselben Rechnung
  -- duerfen sich nicht ueberholen, sonst uebersteigt die Summe der
  -- Gutschriften die Rechnung.
  select * into v_rechnung from invoices where id = p_invoice_id for update;
  if v_rechnung.id is null then
    raise exception 'invoice not found';
  end if;
  if v_rechnung.document_type <> 'invoice' then
    -- Kein Storno eines Stornos: das oeffnet eine Kette, die niemand mehr
    -- ueberblickt, und es gibt keinen betrieblichen Anlass dafuer.
    raise exception 'only invoices can be cancelled';
  end if;

  select coalesce(sum(-gross_amount), 0) into v_bereits
  from invoices where cancels_invoice_id = p_invoice_id;

  v_rest := v_rechnung.gross_amount - v_bereits;
  if v_rest <= 0 then
    raise exception 'invoice already fully cancelled';
  end if;

  if p_document_type = 'cancellation' then
    -- Der Betrag ist nicht waehlbar: ein Vollstorno hebt auf, was offen ist.
    p_amount := v_rest;
  else
    if p_amount is null or p_amount <= 0 then
      raise exception 'amount must be positive';
    end if;
    if p_amount > v_rest then
      raise exception 'amount exceeds remaining invoice total';
    end if;
  end if;

  -- Nummer aus demselben Kreis wie Rechnungen, mit derselben Absicherung
  -- gegen gleichzeitige Vergabe. Das Jahr richtet sich nach dem Tag der
  -- Aufhebung, nicht nach dem der Rechnung -- ein Storno im Januar gehoert
  -- ins neue Jahr und wird nicht rueckdatiert.
  v_jahr := extract(year from public.heute_wien())::int;
  insert into invoice_number_counters (year, last_number)
  values (v_jahr, 1)
  on conflict (year) do update set last_number = invoice_number_counters.last_number + 1
  returning last_number into v_nummer;

  insert into invoices (
    invoice_number, invoice_date, customer_id, description,
    gross_amount, vat_rate, document_type, cancels_invoice_id, reason
  ) values (
    v_jahr::text || '-' || lpad(v_nummer::text, 4, '0'),
    public.heute_wien(),
    v_rechnung.customer_id,
    case when p_document_type = 'cancellation' then 'Storno zu ' else 'Gutschrift zu ' end
      || v_rechnung.invoice_number,
    -p_amount,
    v_rechnung.vat_rate,
    p_document_type,
    p_invoice_id,
    v_grund
  )
  returning * into v_beleg;

  -- Der Betrag geht als Guthaben an den Kunden und wird mit der naechsten
  -- Abbuchung verrechnet -- genau das, was die AGB zusagen.
  insert into customer_credits (customer_id, amount, origin, reason)
  values (v_rechnung.customer_id, p_amount, 'storno',
          v_beleg.invoice_number || ': ' || v_grund);

  -- Eine aufgehobene Forderung darf nicht weiter angemahnt werden. Beim
  -- Vollstorno faellt die Ruecklastschriftgebuehr mit weg; bei einer
  -- Teilgutschrift bleibt sie bestehen.
  if p_document_type = 'cancellation' and v_rechnung.bounced_at is not null then
    update invoices
    set settled_at = now(), bounce_fee = 0
    where id = p_invoice_id and settled_at is null;
  end if;

  return v_beleg;
end;
$function$;

comment on function public.create_invoice_document(uuid, text, numeric, text) is
  'PROJ-46: erzeugt Storno oder Gutschrift zu einer Rechnung und schreibt den Betrag als Guthaben gut. Beides in einem Zug.';

revoke execute on function public.create_invoice_document(uuid, text, numeric, text) from public, anon;
grant execute on function public.create_invoice_document(uuid, text, numeric, text) to authenticated, service_role;
