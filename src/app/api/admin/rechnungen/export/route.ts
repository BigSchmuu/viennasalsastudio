import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  CSV_BOM,
  computeInvoiceAmounts,
  exportFileName,
  formatAmountDe,
  summarizeInvoices,
  toCsvRow,
} from "@/lib/invoices";

// PROJ-46: "Art" und "Bezug" hängen bewusst hinten an, statt sich vorne
// einzuschieben. Wer die Datei schon in eine Vorlage einliest, bekommt so neue
// Spalten dazu und keine verschobenen.
const COLUMN_COUNT = 10;

const ART_BESCHRIFTUNG: Record<string, string> = {
  invoice: "Rechnung",
  cancellation: "Storno",
  credit_note: "Gutschrift",
};

/** Places a summary label in the customer column and leaves the amount columns
 * to the caller — summary rows carry no invoice number, so they stay
 * recognisable after the accountant sorts or filters the sheet. */
function summaryRow(label: string, net: number, vat: number, gross: number, note = ""): string {
  return toCsvRow([
    "",
    "",
    label,
    formatAmountDe(net),
    note,
    formatAmountDe(vat),
    formatAmountDe(gross),
    "",
    "",
    "",
  ]);
}

export async function GET(request: NextRequest) {
  const { supabase } = await requireAdmin();

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim() ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, invoice_date, gross_amount, vat_rate, bounced_at, document_type, cancels_invoice_id, reason, profiles(full_name)"
    )
    .order("invoice_date", { ascending: false });

  if (from) query = query.gte("invoice_date", from);
  if (to) query = query.lte("invoice_date", to);

  const { data } = await query;

  let rows = data ?? [];
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((r) => (r.profiles?.full_name ?? "").toLowerCase().includes(needle));
  }

  // Die aufgehobene Rechnung kann ausserhalb des Zeitraums liegen. Ihre Nummer
  // gehört trotzdem auf den Beleg — ein Storno ohne Bezug ist buchhalterisch
  // wertlos — und ihr Rücklastschrift-Status entscheidet, in welchen der beiden
  // Summenblöcke der Beleg gehört.
  const bezugsIds = [...new Set(rows.map((r) => r.cancels_invoice_id).filter(Boolean))] as string[];
  const bezugJeId = new Map<string, { nummer: string; bounced: boolean }>();
  if (bezugsIds.length > 0) {
    const { data: bezuege } = await supabase
      .from("invoices")
      .select("id, invoice_number, bounced_at")
      .in("id", bezugsIds);
    for (const b of bezuege ?? []) {
      bezugJeId.set(b.id, { nummer: b.invoice_number, bounced: Boolean(b.bounced_at) });
    }
  }

  /**
   * In welchen Block ein Beleg gehört. Ein Storno folgt der Rechnung, die es
   * aufhebt: Wird eine zurückgebuchte Lastschrift storniert, darf der Beleg
   * nicht die eingegangenen Einnahmen mindern — dieses Geld war nie da.
   */
  function alsRuecklastschrift(row: (typeof rows)[number]): boolean {
    if (row.bounced_at) return true;
    if (row.cancels_invoice_id) return bezugJeId.get(row.cancels_invoice_id)?.bounced ?? false;
    return false;
  }

  const header = toCsvRow([
    "Rechnungsnummer",
    "Datum",
    "Kunde",
    "Netto",
    "USt-Satz",
    "USt-Betrag",
    "Brutto",
    "Status",
    "Art",
    "Bezug",
  ]);

  const lines = rows.map((r) => {
    const { netAmount, vatAmount } = computeInvoiceAmounts(r.gross_amount, r.vat_rate);
    const istRechnung = r.document_type === "invoice";
    return toCsvRow([
      r.invoice_number,
      r.invoice_date,
      r.profiles?.full_name ?? "—",
      formatAmountDe(netAmount),
      `${r.vat_rate}%`,
      formatAmountDe(vatAmount),
      formatAmountDe(r.gross_amount),
      // Ein Storno ist weder bezahlt noch zurückgebucht — es hebt auf.
      istRechnung ? (r.bounced_at ? "Rücklastschrift" : "Bezahlt") : "Aufhebung",
      ART_BESCHRIFTUNG[r.document_type] ?? r.document_type,
      r.cancels_invoice_id ? (bezugJeId.get(r.cancels_invoice_id)?.nummer ?? "") : "",
    ]);
  });

  const summary = summarizeInvoices(
    rows.map((r) => ({
      grossAmount: r.gross_amount,
      vatRatePercent: r.vat_rate,
      bounced: alsRuecklastschrift(r),
    }))
  );

  const summaryLines: string[] = [toCsvRow(Array(COLUMN_COUNT).fill(""))];

  // A subtotal per VAT rate is what the accountant needs for the VAT return.
  // Shown even when there is only one rate, so the file always looks the same.
  const rates = summary.byVatRate.length > 0 ? summary.byVatRate : [{ vatRatePercent: 0, net: 0, vat: 0, gross: 0 }];
  for (const rate of rates) {
    summaryLines.push(
      summaryRow(`Zwischensumme ${rate.vatRatePercent}%`, rate.net, rate.vat, rate.gross, `${rate.vatRatePercent}%`)
    );
  }

  summaryLines.push(summaryRow("GESAMT (eingegangen)", summary.total.net, summary.total.vat, summary.total.gross));

  // Deliberately NOT labelled "davon …" as the spec's wording suggested: this
  // money is not part of the total above, and "davon" would state the opposite
  // to the one reader who must not misread it.
  summaryLines.push(
    summaryRow(
      "Nicht eingegangen (Rücklastschriften)",
      summary.bounced.net,
      summary.bounced.vat,
      summary.bounced.gross
    )
  );

  // The studio bills on-site sales from a separate system. Without this line a
  // total reads like the full revenue and gets double-counted when both systems
  // are merged.
  summaryLines.push(toCsvRow(Array(COLUMN_COUNT).fill("")));
  summaryLines.push(
    toCsvRow([
      "",
      "",
      "Hinweis: Diese Datei enthält ausschließlich Einnahmen aus SEPA-Lastschriften. Vor-Ort- und Barzahlungen werden separat erfasst. Stornos und Gutschriften stehen als eigene Zeilen mit negativem Betrag und sind in den Summen bereits verrechnet.",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ])
  );

  const csv = CSV_BOM + [header, ...lines, ...summaryLines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFileName(from, to)}"`,
    },
  });
}
