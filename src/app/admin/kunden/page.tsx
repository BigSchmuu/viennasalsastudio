import { createClient } from "@/lib/supabase/server";
import { CustomerList, type CustomerRow } from "@/components/admin/customers/customer-list";

export default async function CustomersPage() {
  const supabase = await createClient();

  const [profilesRes, emailsRes, subscriptionsRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("role", "customer"),
    supabase.rpc("admin_list_customer_emails"),
    supabase.from("subscriptions").select("customer_id"),
  ]);

  const emailById = new Map((emailsRes.data ?? []).map((e) => [e.id, e.email]));
  const subscriptionCountById = new Map<string, number>();
  for (const s of subscriptionsRes.data ?? []) {
    subscriptionCountById.set(s.customer_id, (subscriptionCountById.get(s.customer_id) ?? 0) + 1);
  }

  const customers: CustomerRow[] = (profilesRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.full_name || "Unbenannt",
    email: emailById.get(p.id) ?? "—",
    subscriptionCount: subscriptionCountById.get(p.id) ?? 0,
  }));

  return <CustomerList customers={customers} />;
}
