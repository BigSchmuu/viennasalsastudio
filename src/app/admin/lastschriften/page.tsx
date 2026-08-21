import { createClient } from "@/lib/supabase/server";
import {
  CollectionRunList,
  type CollectionRunRow,
  type CollectionRunStatus,
} from "@/components/admin/sepa/collection-run-list";

const SORTABLE_COLUMNS = ["due_date", "total", "created_at"] as const;

export default async function LastschriftenPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("sepa_collection_runs")
    .select("id, due_date, created_at, sepa_collection_items(amount, bounced_at)")
    .order("due_date", { ascending: false });

  let runs: CollectionRunRow[] = (data ?? []).map((run) => {
    const items = run.sepa_collection_items as { amount: number; bounced_at: string | null }[];
    const status: CollectionRunStatus = items.some((item) => item.bounced_at !== null) ? "bounced" : "complete";
    return {
      id: run.id,
      dueDate: run.due_date,
      createdAt: run.created_at,
      itemCount: items.length,
      total: items.reduce((sum, item) => sum + item.amount, 0),
      status,
    };
  });

  const isValidStatus = params.status === "complete" || params.status === "bounced";
  if (isValidStatus) {
    runs = runs.filter((run) => run.status === params.status);
  }

  if (SORTABLE_COLUMNS.includes(params.sort as (typeof SORTABLE_COLUMNS)[number])) {
    const sortDir = params.dir === "desc" ? -1 : 1;
    runs = [...runs].sort((a, b) => {
      if (params.sort === "total") return (a.total - b.total) * sortDir;
      if (params.sort === "created_at") return a.createdAt.localeCompare(b.createdAt) * sortDir;
      return a.dueDate.localeCompare(b.dueDate) * sortDir;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">Lastschriften</h2>
        <p className="text-sm text-muted-foreground">
          SEPA-Sammellastschrift-Läufe erstellen und herunterladen
        </p>
      </div>
      <CollectionRunList runs={runs} initialStatus={isValidStatus ? params.status! : ""} />
    </div>
  );
}
