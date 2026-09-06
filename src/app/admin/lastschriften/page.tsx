import { createClient } from "@/lib/supabase/server";
import {
  CollectionRunList,
  type CollectionRunRow,
  type CollectionRunStatus,
} from "@/components/admin/sepa/collection-run-list";
import { istUeberfaelligerEntwurf, laufZustand } from "@/lib/sepa/laeufe";
import { heuteInWien } from "@/lib/constants/zeitzone";

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
    .select("id, due_date, created_at, released_at, sepa_collection_items(amount, bounced_at)")
    .order("due_date", { ascending: false });

  // Einmal je Anfrage ermittelt, damit alle Zeilen denselben Tag vergleichen.
  const heute = heuteInWien();

  let runs: CollectionRunRow[] = (data ?? []).map((run) => {
    const items = run.sepa_collection_items as { amount: number; bounced_at: string | null }[];
    const status: CollectionRunStatus = laufZustand(
      run.released_at,
      items.some((item) => item.bounced_at !== null)
    );
    return {
      id: run.id,
      dueDate: run.due_date,
      createdAt: run.created_at,
      itemCount: items.length,
      total: items.reduce((sum, item) => sum + item.amount, 0),
      status,
      ueberfaellig: istUeberfaelligerEntwurf(run.due_date, run.released_at, heute),
    };
  });

  const isValidStatus =
    params.status === "entwurf" ||
    params.status === "eingezogen" ||
    params.status === "rueckgebucht";
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
