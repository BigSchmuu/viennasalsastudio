import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { computeInvoiceAmounts, toCsvRow } from "@/lib/invoices";

export async function GET(request: NextRequest) {
  const { supabase } = await requireAdmin();

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q")?.trim() ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  let query = supabase
    .from("invoices")
    .select("invoice_number, invoice_date, gross_amount, vat_rate, bounced_at, profiles(full_name)")
    .order("invoice_date", { ascending: false });

  if (from) query = query.gte("invoice_date", from);
  if (to) query = query.lte("invoice_date", to);

  const { data } = await query;

  let rows = data ?? [];
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((r) => (r.profiles?.full_name ?? "").toLowerCase().includes(needle));
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
  ]);

  const lines = rows.map((r) => {
    const { netAmount, vatAmount } = computeInvoiceAmounts(r.gross_amount, r.vat_rate);
    return toCsvRow([
      r.invoice_number,
      r.invoice_date,
      r.profiles?.full_name ?? "—",
      netAmount.toFixed(2),
      `${r.vat_rate}%`,
      vatAmount.toFixed(2),
      r.gross_amount.toFixed(2),
      r.bounced_at ? "Rücklastschrift" : "Bezahlt",
    ]);
  });

  const csv = [header, ...lines].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rechnungsjournal.csv"`,
    },
  });
}
