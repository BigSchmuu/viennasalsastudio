import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Beleg } from "@/components/invoices/beleg";
import { PrintButton } from "@/components/invoices/print-button";
import { ladeBeleg, ladeStammdaten } from "@/lib/belege/laden";
import { getViewer } from "@/lib/auth/viewer";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Der Rahmen hat das schon ermittelt — getViewer() gibt innerhalb einer
  // Anfrage dieselbe Antwort zurück, ohne erneut zu fragen.
  const user = await getViewer();

  if (!user) {
    redirect(`/login?redirect=/rechnungen/${id}`);
  }

  // Wer welchen Beleg sehen darf, entscheidet die Datenbank: Kund:innen sehen
  // ihre eigenen, die Verwaltung alle.
  const [beleg, stammdaten] = await Promise.all([ladeBeleg(supabase, id), ladeStammdaten(supabase)]);

  if (!beleg) {
    notFound();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <style>{`@media print { header { display: none !important; } .no-print { display: none !important; } }`}</style>

      <div className="no-print mb-6">
        <PrintButton />
      </div>

      <Beleg beleg={beleg} stammdaten={stammdaten} />
    </div>
  );
}
