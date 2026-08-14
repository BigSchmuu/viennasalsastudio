import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CollectionRunDetail, type CollectionItemRow } from "@/components/admin/sepa/collection-run-detail";
import { Button } from "@/components/ui/button";

export default async function LastschriftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: run } = await supabase.from("sepa_collection_runs").select("id, due_date").eq("id", id).single();
  if (!run) {
    notFound();
  }

  const { data: rawItems } = await supabase
    .from("sepa_collection_items")
    .select("id, amount, bounced_at, subscriptions(name), profiles(full_name)")
    .eq("run_id", id)
    .order("created_at", { ascending: true });

  const items: CollectionItemRow[] = (rawItems ?? []).map((item) => ({
    id: item.id,
    customerName: (item.profiles as { full_name: string | null } | null)?.full_name ?? "Unbenannt",
    subscriptionName: (item.subscriptions as { name: string | null } | null)?.name ?? "—",
    amount: item.amount,
    bouncedAt: item.bounced_at,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Button variant="link" className="px-0" asChild>
          <Link href="/admin/lastschriften">← Zurück zu Lastschriften</Link>
        </Button>
        <h2 className="font-heading text-xl font-bold">
          Lastschriftlauf {new Date(run.due_date).toLocaleDateString("de-AT")}
        </h2>
      </div>
      <CollectionRunDetail runId={run.id} items={items} />
    </div>
  );
}
