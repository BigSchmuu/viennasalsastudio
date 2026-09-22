import { Badge } from "@/components/ui/badge";
import { computeInvoiceAmounts, istVollstaendigAufgehoben } from "@/lib/invoices";
import type { BelegDaten, Stammdaten } from "@/lib/belege/laden";

/**
 * Ein Beleg, wie er gedruckt wird (PROJ-64).
 *
 * Zwei Auftritte, ein Bauteil: die Einzelseite eines Belegs und das
 * Belegarchiv der Verwaltung. Vorher stand das Layout nur auf der Einzelseite;
 * ein zweites daneben wäre über kurz oder lang abgewichen — und ausgerechnet
 * bei einem Buchhaltungsbeleg fiele das niemandem auf, bis jemand zwei
 * Fassungen derselben Rechnung nebeneinander legt.
 */

function formatEUR(betrag: number): string {
  return betrag.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

function formatDatum(datum: string): string {
  return new Date(datum).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function belegBezeichnung(art: BelegDaten["art"]): string {
  if (art === "cancellation") return "Storno";
  if (art === "credit_note") return "Gutschrift";
  return "Rechnung";
}

export function Beleg({ beleg, stammdaten }: { beleg: BelegDaten; stammdaten: Stammdaten }) {
  const istRechnung = beleg.art === "invoice";
  const bezeichnung = belegBezeichnung(beleg.art);
  const { netAmount, vatAmount } = computeInvoiceAmounts(beleg.brutto, beleg.ustSatz);

  const aufgehobenerBetrag = beleg.aufhebungen.reduce((summe, a) => summe - a.brutto, 0);
  const vollstaendigAufgehoben = istRechnung && istVollstaendigAufgehoben(beleg.brutto, aufgehobenerBetrag);

  return (
    <div className="border rounded-md p-8 space-y-8">
      <div>
        <p className="font-heading text-lg font-bold">{stammdaten.firma}</p>
        {stammdaten.adresse && <p className="text-sm text-muted-foreground">{stammdaten.adresse}</p>}
        {stammdaten.uid && <p className="text-sm text-muted-foreground">UID-Nummer: {stammdaten.uid}</p>}
      </div>

      <div className="flex flex-wrap justify-between gap-4 text-sm">
        <div>
          <p className="font-medium">{istRechnung ? "Rechnungsempfänger" : "Empfänger"}</p>
          <p>{beleg.kunde}</p>
        </div>
        <div className="text-right space-y-1">
          <p className="font-heading font-bold">{bezeichnung}</p>
          <p>
            <span className="text-muted-foreground">{istRechnung ? "Rechnungsnummer" : "Belegnummer"}: </span>
            {beleg.nummer}
          </p>
          <p>
            <span className="text-muted-foreground">{istRechnung ? "Rechnungsdatum" : "Belegdatum"}: </span>
            {formatDatum(beleg.datum)}
          </p>
        </div>
      </div>

      {/* Pflichtangabe: welche Rechnung dieser Beleg aufhebt. */}
      {!istRechnung && beleg.bezug && (
        <p className="text-sm">
          {bezeichnung} zu Rechnung {beleg.bezug.nummer} vom {formatDatum(beleg.bezug.datum)}
          {beleg.grund && <> — {beleg.grund}</>}
        </p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 font-normal">Bezeichnung</th>
            <th className="py-2 font-normal text-right">Netto</th>
            <th className="py-2 font-normal text-right">USt-Satz</th>
            <th className="py-2 font-normal text-right">USt-Betrag</th>
            <th className="py-2 font-normal text-right">Brutto</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="py-2">{beleg.bezeichnung}</td>
            <td className="py-2 text-right">{formatEUR(netAmount)}</td>
            <td className="py-2 text-right">{beleg.ustSatz}%</td>
            <td className="py-2 text-right">{formatEUR(vatAmount)}</td>
            <td className="py-2 text-right">{formatEUR(beleg.brutto)}</td>
          </tr>
        </tbody>
      </table>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gesamtbetrag</p>
        <p className="font-medium">{formatEUR(beleg.brutto)}</p>
      </div>

      <div className="space-y-2">
        {istRechnung ? (
          vollstaendigAufgehoben ? (
            <Badge variant="outline">Aufgehoben</Badge>
          ) : (
            <Badge variant={beleg.zurueckgebucht ? "destructive" : "default"}>
              {beleg.zurueckgebucht ? "Rücklastschrift" : "Bezahlt"}
            </Badge>
          )
        ) : (
          <Badge variant="secondary">{bezeichnung}</Badge>
        )}

        {/* Auf der aufgehobenen Rechnung selbst steht, wodurch sie aufgehoben
            wurde. Ohne diesen Hinweis liest sich eine stornierte Rechnung wie
            eine offene Forderung. */}
        {istRechnung && beleg.aufhebungen.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Aufgehoben durch{" "}
            {beleg.aufhebungen
              .map((a) => `${belegBezeichnung(a.art as BelegDaten["art"])} ${a.nummer} (${formatEUR(a.brutto)})`)
              .join(", ")}
            .
          </p>
        )}
      </div>

      {/* Pflichtangabe, sobald der Beleg unter der Grenze bleibt. */}
      {istRechnung && netAmount + vatAmount <= 400 && (
        <p className="text-xs text-muted-foreground">Kleinbetragsrechnung gemäß § 11 Abs. 6 UStG.</p>
      )}
    </div>
  );
}
