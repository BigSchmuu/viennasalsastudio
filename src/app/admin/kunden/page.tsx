import { createClient } from "@/lib/supabase/server";
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

  const [profilesRes, emailsRes, subscriptionsRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, created_at").eq("role", "customer"),
    supabase.rpc("admin_list_customer_emails"),
    supabase.from("subscriptions").select("customer_id, status"),
  ]);

  const emailById = new Map((emailsRes.data ?? []).map((e) => [e.id, e.email]));

  const subscriptionCountById = new Map<string, number>();
  const statusesById = new Map<string, string[]>();
  for (const s of subscriptionsRes.data ?? []) {
    subscriptionCountById.set(s.customer_id, (subscriptionCountById.get(s.customer_id) ?? 0) + 1);
    const list = statusesById.get(s.customer_id) ?? [];
    list.push(s.status);
    statusesById.set(s.customer_id, list);
  }

  let customers: CustomerRow[] = (profilesRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || "Unbenannt",
    email: emailById.get(p.id) ?? "—",
    subscriptionCount: subscriptionCountById.get(p.id) ?? 0,
    status: deriveStatus(statusesById.get(p.id) ?? []),
    createdAt: p.created_at,
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
