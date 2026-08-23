import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { OpenItemsList, type OpenItemRow } from "@/components/admin/open-items/open-items-list";

export default async function OffenePostenPage({
  searchParams,
}: {
  searchParams: Promise<{ erledigte?: string }>;
}) {
  const params = await searchParams;
  const showSettled = params.erledigte === "1";
  const supabase = await createClient();

  // An open item is simply a bounced invoice that hasn't been ticked off —
  // there is no second list that could drift out of sync with the invoices.
  let query = supabase
    .from("invoices")
    .select("id, customer_id, invoice_number, bounced_at, gross_amount, bounce_fee, reminded_at, settled_at, profiles(full_name)")
    .not("bounced_at", "is", null)
    .order("bounced_at", { ascending: true });

  if (!showSettled) query = query.is("settled_at", null);

  const { data } = await query;
  const rows = data ?? [];

  // "Erinnerung senden" has to be disabled for customers without an address,
  // and the address lives in the auth records rather than the profile.
  const service = createServiceClient();
  const { data: users } = await service.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  const items: OpenItemRow[] = rows.map((r) => ({
    id: r.id,
    customerId: r.customer_id,
    customerName: r.profiles?.full_name ?? "Unbekannt",
    invoiceNumber: r.invoice_number,
    bouncedAt: r.bounced_at!,
    grossAmount: Number(r.gross_amount),
    bounceFee: Number(r.bounce_fee ?? 0),
    remindedAt: r.reminded_at,
    settledAt: r.settled_at,
    hasEmail: Boolean(emailById.get(r.customer_id)),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">Offene Posten</h2>
        <p className="text-sm text-muted-foreground">
          Zurückgebuchte Lastschriften — Geld, das eingezogen wurde, aber nicht angekommen ist
        </p>
      </div>
      <OpenItemsList items={items} showSettled={showSettled} />
    </div>
  );
}
