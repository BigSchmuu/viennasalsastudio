-- Gefunden bei PROJ-47, aelter als PROJ-47.
--
-- Deckt das Guthaben den Beitrag vollstaendig, senkt die Verrechnung den
-- Betrag der Position auf 0. Die Bedingung "amount > 0" hat das abgewiesen --
-- und die Anwendung hat den Fehler nicht geprueft. Die Guthabenzeile war dann
-- geschrieben, der Betrag stand aber unveraendert: Der Kunde verlor sein
-- Guthaben und wurde trotzdem voll abgebucht.
--
-- Dass 0-Euro-Positionen vorgesehen waren, steht im Code: generateRunXml
-- filtert sie aus der Bankdatei ("eine Lastschrift ueber 0 EUR weist die Bank
-- ab"), laesst sie aber in der Rechnung stehen, wo sie erklaeren, warum nichts
-- abgebucht wurde. Dieser Filter konnte bisher nie etwas tun.
--
-- Negative Betraege bleiben ausgeschlossen: Eine Lastschrift, die Geld
-- zurueckgibt, gibt es nicht -- dafuer ist das Guthaben da.
alter table public.sepa_collection_items drop constraint sepa_collection_items_amount_check;
alter table public.sepa_collection_items add constraint sepa_collection_items_amount_check
  check (amount >= 0);
