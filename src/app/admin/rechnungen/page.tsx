import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InvoiceList, type InvoiceRow } from "@/components/admin/invoices/invoice-list";
import { Button } from "@/components/ui/button";

export default async function RechnungenPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("invoices")
    .select("id, invoice_number, invoice_date, description, gross_amount, bounced_at, profiles(full_name)")
    .order("invoice_date", { ascending: false });

  if (params.from) query = query.gte("invoice_date", params.from);
  if (params.to) query = query.lte("invoice_date", params.to);

  const { data } = await query;

  let invoices: InvoiceRow[] = (data ?? []).map((i) => ({
    id: i.id,
    invoiceNumber: i.invoice_number,
    invoiceDate: i.invoice_date,
    customerName: i.profiles?.full_name ?? "—",
    description: i.description,
    grossAmount: i.gross_amount,
    bounced: !!i.bounced_at,
  }));

  if (params.q) {
    const needle = params.q.toLowerCase();
    invoices = invoices.filter((i) => i.customerName.toLowerCase().includes(needle));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-bold">Rechnungen</h2>
          <p className="text-sm text-muted-foreground">Rechnungsarchiv über alle Kund:innen hinweg</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/rechnungen/einstellungen">Einstellungen</Link>
        </Button>
      </div>
      <InvoiceList
        invoices={invoices}
        initialQuery={params.q ?? ""}
        initialFrom={params.from ?? ""}
        initialTo={params.to ?? ""}
      />
    </div>
  );
}
