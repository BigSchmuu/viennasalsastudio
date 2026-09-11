import { createClient } from "@/lib/supabase/server";
import { heuteInWien } from "@/lib/constants/zeitzone";
import { CustomerList, type CustomerRow, type CustomerStatus } from "@/components/admin/customers/customer-list";

/** Aktiv > Pausiert > Gekündigt > Kein Abo — see PROJ-33 Decision Log. */
function deriveStatus(statuses: string[]): CustomerStatus {
  if (statuses.includes("active")) return "active";
  if (statuses.includes("paused")) return "paused";
  if (statuses.includes("cancelled")) return "cancelled";
  return "none";
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [profilesRes, emailsRes, subscriptionsRes, mandatesRes] = await Promise.all([
    // Nicht mehr nur `role = 'customer'`.
    //
    // Eine Lehrkraft mit Flatrate-Abo tauchte hier nicht auf — und damit war
    // ihr Abo weder änderbar noch kündbar, obwohl es monatlich abgebucht wird.
    // Wen der Betrieb abrechnet, den muss er auch verwalten können. Gefiltert
    // wird deshalb unten nach Zugehörigkeit, nicht in der Abfrage.
    supabase.from("profiles").select("id, full_name, created_at, role"),
    supabase.rpc("admin_list_customer_emails"),
    // `courses(runs_until)` nur wegen PROJ-51: Ein Abo an einem beendeten Kurs
    // soll schon in der Liste auffallen, nicht erst im Profil.
    supabase.from("subscriptions").select("customer_id, status, courses(runs_until)"),
    supabase.from("sepa_mandates").select("customer_id").is("revoked_at", null),
  ]);

  const emailById = new Map((emailsRes.data ?? []).map((e) => [e.id, e.email]));

  const heute = heuteInWien();
  const subscriptionCountById = new Map<string, number>();
  const statusesById = new Map<string, string[]>();
  const mitBeendetemKurs = new Set<string>();
  for (const s of subscriptionsRes.data ?? []) {
    subscriptionCountById.set(s.customer_id, (subscriptionCountById.get(s.customer_id) ?? 0) + 1);
    const list = statusesById.get(s.customer_id) ?? [];
    list.push(s.status);
    statusesById.set(s.customer_id, list);
    // Nur solange das Abo auch Geld kostet — an einem gekündigten ist nichts
    // mehr umzubuchen.
    if (s.status !== "cancelled" && s.courses?.runs_until && s.courses.runs_until < heute) {
      mitBeendetemKurs.add(s.customer_id);
    }
  }

  const mitMandat = new Set((mandatesRes.data ?? []).map((m) => m.customer_id));

  let customers: CustomerRow[] = (profilesRes.data ?? [])
    // Kunden immer — dazu jeder, der ein Abo oder ein gültiges Mandat hat.
    // Reine Lehrkräfte ohne Zahlungsbeziehung bleiben draußen; die Liste soll
    // die Abrechnung abbilden, nicht das Personal.
    .filter(
      (p) =>
        p.role === "customer" ||
        (subscriptionCountById.get(p.id) ?? 0) > 0 ||
        mitMandat.has(p.id)
    )
    .map((p) => ({
      id: p.id,
      name: p.full_name || "Unbenannt",
      email: emailById.get(p.id) ?? "—",
      subscriptionCount: subscriptionCountById.get(p.id) ?? 0,
      status: deriveStatus(statusesById.get(p.id) ?? []),
      createdAt: p.created_at,
      // Nur gesetzt, wenn es nicht die Vorgabe ist — sonst stünde an jeder
      // Zeile ein Wort, das nichts sagt.
      rolle: p.role === "customer" ? null : p.role,
      kursBeendet: mitBeendetemKurs.has(p.id),
    }));

  const q = params.q?.trim().toLowerCase() ?? "";
  if (q) {
    customers = customers.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }

  if (params.status) {
    customers = customers.filter((c) => c.status === params.status);
  }

  const sortKey = params.sort === "created_at" ? "created_at" : "name";
  const sortDir = params.dir === "desc" ? -1 : 1;
  customers = [...customers].sort((a, b) => {
    if (sortKey === "created_at") {
      return (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) * sortDir;
    }
    return a.name.localeCompare(b.name, "de") * sortDir;
  });

  return <CustomerList customers={customers} initialSearch={params.q ?? ""} initialStatus={params.status ?? ""} />;
}
