import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InvoiceSettingsForm } from "@/components/admin/invoices/invoice-settings-form";
import { Button } from "@/components/ui/button";

export default async function InvoiceSettingsPage() {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("invoice_settings")
    .select("company_name, address, uid_number, vat_rate")
    .limit(1)
    .single();

  return (
    <div className="space-y-4">
      <div>
        <Button variant="link" className="px-0" asChild>
          <Link href="/admin/rechnungen">← Zurück zu Rechnungen</Link>
        </Button>
        <h2 className="font-heading text-xl font-bold">Rechnungseinstellungen</h2>
      </div>
      <InvoiceSettingsForm
        companyName={settings?.company_name ?? ""}
        address={settings?.address ?? ""}
        uidNumber={settings?.uid_number ?? ""}
        vatRate={settings?.vat_rate ?? 20}
      />
    </div>
  );
}
