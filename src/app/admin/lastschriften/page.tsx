import { createClient } from "@/lib/supabase/server";
import { CollectionRunList, type CollectionRunRow } from "@/components/admin/sepa/collection-run-list";

export default async function LastschriftenPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("sepa_collection_runs")
    .select("id, due_date, created_at, sepa_collection_items(amount)")
    .order("due_date", { ascending: false });

  const runs: CollectionRunRow[] = (data ?? []).map((run) => {
    const items = run.sepa_collection_items as { amount: number }[];
    return {
      id: run.id,
      dueDate: run.due_date,
      createdAt: run.created_at,
      itemCount: items.length,
      total: items.reduce((sum, item) => sum + item.amount, 0),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">Lastschriften</h2>
        <p className="text-sm text-muted-foreground">
          SEPA-Sammellastschrift-Läufe erstellen und herunterladen
        </p>
      </div>
      <CollectionRunList runs={runs} />
    </div>
  );
}
