-- PROJ-46: Rechnungen stornieren und gutschreiben.
--
-- Tragender Gedanke: Ein Storno ist selbst eine Rechnung, mit negativem
-- Betrag, in derselben Tabelle. Kundenarchiv, Buchhaltungs-Export und
-- Nummernvergabe funktionieren dadurch unveraendert -- der Export summiert
-- ohnehin ueber alle Zeilen.

alter table public.invoices
  add column document_type text not null default 'invoice'
    check (document_type in ('invoice', 'cancellation', 'credit_note')),
  add column cancels_invoice_id uuid references public.invoices(id),
  add column reason text;

comment on column public.invoices.document_type is
  'PROJ-46: invoice = Rechnung, cancellation = Vollstorno, credit_note = Teilgutschrift.';
comment on column public.invoices.cancels_invoice_id is
  'PROJ-46: bei Storno und Gutschrift die aufgehobene Rechnung. Die Rechnung selbst bleibt unveraendert -- ob sie aufgehoben ist, ergibt sich aus diesem Verweis.';

-- Ein Storno ohne Bezug waere ein Beleg ins Leere; eine Rechnung mit Bezug
-- eine Rechnung, die etwas aufhebt. Beides gibt es nicht.
alter table public.invoices add constraint invoices_document_shape_check check (
  (document_type = 'invoice' and cancels_invoice_id is null and reason is null)
  or (document_type <> 'invoice'
      and cancels_invoice_id is not null
      and coalesce(trim(reason), '') <> '')
);

-- Aufhebende Belege tragen einen negativen Betrag -- daran haengt, dass sich
-- der Buchhaltungs-Export von selbst verrechnet.
alter table public.invoices add constraint invoices_document_sign_check check (
  (document_type = 'invoice' and gross_amount >= 0)
  or (document_type <> 'invoice' and gross_amount < 0)
);

create index if not exists idx_invoices_cancels on public.invoices (cancels_invoice_id)
  where cancels_invoice_id is not null;

-- Belege sind unveraenderlich, und zwar hier und nicht in der Oberflaeche.
-- Eine Buchhaltung, die sich auf eine ausgeblendete Schaltflaeche verlaesst,
-- ist keine.
create or replace function public.invoices_dokumente_unveraenderlich()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'DELETE' then
    if old.document_type <> 'invoice' then
      raise exception 'Storno- und Gutschriftsbelege duerfen nicht geloescht werden';
    end if;
    return old;
  end if;

  if old.document_type <> 'invoice' then
    raise exception 'Storno- und Gutschriftsbelege duerfen nicht geaendert werden';
  end if;

  -- Auch an einer Rechnung darf sich nicht alles aendern: Nummer, Datum,
  -- Betrag, Steuersatz und Kunde stehen fest, sobald sie ausgestellt ist.
  -- Aenderbar bleibt nur, was den Zahlungsstand betrifft.
  if new.invoice_number is distinct from old.invoice_number
     or new.invoice_date is distinct from old.invoice_date
     or new.customer_id is distinct from old.customer_id
     or new.gross_amount is distinct from old.gross_amount
     or new.vat_rate is distinct from old.vat_rate
     or new.document_type is distinct from old.document_type then
    raise exception 'An einer ausgestellten Rechnung duerfen Nummer, Datum, Kunde, Betrag, Steuersatz und Belegart nicht geaendert werden';
  end if;

  return new;
end;
$function$;

create trigger invoices_unveraenderlich
  before update or delete on public.invoices
  for each row execute function public.invoices_dokumente_unveraenderlich();

-- Guthaben aus einem Storno bekommt eine eigene Herkunft. Es unter "manuell"
-- zu fuehren waere bequem, aber dann saehe weder Kunde noch Betreiber
-- spaeter, woher es stammt.
alter table public.customer_credits drop constraint customer_credits_origin_check;
alter table public.customer_credits add constraint customer_credits_origin_check
  check (origin in ('referral', 'manual', 'redeemed', 'storno'));

alter table public.customer_credits add constraint customer_credits_storno_reason_check
  check (origin <> 'storno' or coalesce(trim(reason), '') <> '');
