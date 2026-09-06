-- PROJ-46, Nachtrag aus der QA: Der Unveraenderlichkeits-Trigger sperrte auch
-- den Weg, ueber den die Testdatenbank zurueckgesetzt wird -- `scripts/
-- seed-testdb.mjs` loescht alle Rechnungen ueber den Service-Schluessel. Ohne
-- diese Ausnahme laesst sich die Testdatenbank nicht mehr neu aufbauen,
-- sobald ein einziger Storno existiert.
--
-- Die Ausnahme kostet keinen echten Schutz: Wer den Service-Schluessel hat,
-- umgeht ohnehin jede RLS-Regel und koennte Profile, Guthaben und Rechnungen
-- beliebig umschreiben. Der Trigger schuetzt den Weg, auf dem Fehler
-- tatsaechlich passieren -- die Verwaltungsoberflaeche, die als
-- `authenticated` arbeitet. Dort bleibt alles gesperrt.
--
-- Aendern bleibt fuer alle Rollen gesperrt, auch fuer den Service-Schluessel:
-- das braucht niemand, und was niemand braucht, bleibt zu.
create or replace function public.invoices_dokumente_unveraenderlich()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'DELETE' then
    if old.document_type <> 'invoice'
       and current_user not in ('service_role', 'postgres', 'supabase_admin') then
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
