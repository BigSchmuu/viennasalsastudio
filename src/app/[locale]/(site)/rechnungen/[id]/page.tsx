import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeInvoiceAmounts, istVollstaendigAufgehoben } from "@/lib/invoices";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/invoices/print-button";
import { getViewer } from "@/lib/auth/viewer";

function formatEUR(amount: number): string {
  return amount.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Der Rahmen hat das schon ermittelt — getViewer() gibt innerhalb einer
  // Anfrage dieselbe Antwort zurück, ohne erneut zu fragen.
  const user = await getViewer();

  if (!user) {
    redirect(`/login?redirect=/rechnungen/${id}`);
  }

  const [{ data: invoice }, { data: settings }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "invoice_number, invoice_date, description, gross_amount, vat_rate, bounced_at, document_type, cancels_invoice_id, reason, profiles(full_name)"
      )
      .eq("id", id)
      .single(),
    supabase.from("invoice_settings").select("company_name, address, uid_number").limit(1).single(),
  ]);

  if (!invoice) {
    notFound();
  }

  const istRechnung = invoice.document_type === "invoice";

  // PROJ-46: Ein Storno muss die aufgehobene Rechnung benennen — ein Beleg über
  // minus 50 € ohne Bezug ist für die Buchhaltung wertlos. Umgekehrt soll auf
  // einer aufgehobenen Rechnung stehen, dass sie nicht mehr gilt.
  const [{ data: bezug }, { data: aufhebungen }] = await Promise.all([
    invoice.cancels_invoice_id
      ? supabase
          .from("invoices")
          .select("invoice_number, invoice_date")
          .eq("id", invoice.cancels_invoice_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    istRechnung
      ? supabase
          .from("invoices")
          .select("invoice_number, gross_amount, document_type")
          .eq("cancels_invoice_id", id)
          .order("invoice_number", { ascending: true })
      : Promise.resolve({ data: null }),
  ]);

  const aufgehobenerBetrag = (aufhebungen ?? []).reduce((summe, a) => summe - Number(a.gross_amount), 0);
  const vollstaendigAufgehoben =
    istRechnung && istVollstaendigAufgehoben(Number(invoice.gross_amount), aufgehobenerBetrag);

  const { netAmount, vatAmount } = computeInvoiceAmounts(invoice.gross_amount, invoice.vat_rate);
  const customerName = invoice.profiles?.full_name ?? "—";
  const belegBezeichnung =
    invoice.document_type === "cancellation"
      ? "Storno"
      : invoice.document_type === "credit_note"
        ? "Gutschrift"
        : "Rechnung";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <style>{`@media print { header { display: none !important; } .no-print { display: none !important; } }`}</style>

      <div className="no-print mb-6">
        <PrintButton />
      </div>

      <div className="border rounded-md p-8 space-y-8">
        <div>
          <p className="font-heading text-lg font-bold">{settings?.company_name || "—"}</p>
          {settings?.address && <p className="text-sm text-muted-foreground">{settings.address}</p>}
          {settings?.uid_number && <p className="text-sm text-muted-foreground">UID-Nummer: {settings.uid_number}</p>}
        </div>

        <div className="flex flex-wrap justify-between gap-4 text-sm">
          <div>
            <p className="font-medium">{istRechnung ? "Rechnungsempfänger" : "Empfänger"}</p>
            <p>{customerName}</p>
          </div>
          <div className="text-right space-y-1">
            <p className="font-heading font-bold">{belegBezeichnung}</p>
            <p>
              <span className="text-muted-foreground">
                {istRechnung ? "Rechnungsnummer" : "Belegnummer"}:{" "}
              </span>
              {invoice.invoice_number}
            </p>
            <p>
              <span className="text-muted-foreground">
                {istRechnung ? "Rechnungsdatum" : "Belegdatum"}:{" "}
              </span>
              {formatDate(invoice.invoice_date)}
            </p>
          </div>
        </div>

        {/* Pflichtangabe: welche Rechnung dieser Beleg aufhebt. */}
        {!istRechnung && bezug && (
          <p className="text-sm">
            {belegBezeichnung} zu Rechnung {bezug.invoice_number} vom {formatDate(bezug.invoice_date)}
            {invoice.reason && <> — {invoice.reason}</>}
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
              <td className="py-2">{invoice.description}</td>
              <td className="py-2 text-right">{formatEUR(netAmount)}</td>
              <td className="py-2 text-right">{invoice.vat_rate}%</td>
              <td className="py-2 text-right">{formatEUR(vatAmount)}</td>
              <td className="py-2 text-right">{formatEUR(invoice.gross_amount)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Gesamtbetrag</p>
          <p className="font-medium">{formatEUR(invoice.gross_amount)}</p>
        </div>

        <div className="space-y-2">
          {istRechnung ? (
            vollstaendigAufgehoben ? (
              <Badge variant="outline">Aufgehoben</Badge>
            ) : (
              <Badge variant={invoice.bounced_at ? "destructive" : "default"}>
                {invoice.bounced_at ? "Rücklastschrift" : "Bezahlt"}
              </Badge>
            )
          ) : (
            <Badge variant="secondary">{belegBezeichnung}</Badge>
          )}

          {/* Auf der aufgehobenen Rechnung selbst steht, wodurch sie aufgehoben
              wurde. Ohne diesen Hinweis liest sich eine stornierte Rechnung wie
              eine offene Forderung. */}
          {istRechnung && (aufhebungen ?? []).length > 0 && (
            <p className="text-xs text-muted-foreground">
              Aufgehoben durch{" "}
              {(aufhebungen ?? [])
                .map(
                  (a) =>
                    `${a.document_type === "cancellation" ? "Storno" : "Gutschrift"} ${a.invoice_number} (${formatEUR(Number(a.gross_amount))})`
                )
                .join(", ")}
              .
            </p>
          )}
        </div>

        {istRechnung && netAmount + vatAmount <= 400 && (
          <p className="text-xs text-muted-foreground">
            Kleinbetragsrechnung gemäß § 11 Abs. 6 UStG.
          </p>
        )}
      </div>
    </div>
  );
}
