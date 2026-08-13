import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerProfileForm } from "@/components/admin/customers/customer-profile-form";
import { SubscriptionManager, type SubscriptionRow } from "@/components/admin/customers/subscription-manager";
import type { ProfileInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone, birthdate, gender")
    .eq("id", id)
    .eq("role", "customer")
    .single();

  if (!profile) {
    notFound();
  }

  const [emailsRes, subscriptionsRes] = await Promise.all([
    supabase.rpc("admin_list_customer_emails"),
    supabase
      .from("subscriptions")
      .select("id, name, price, status")
      .eq("customer_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const email = (emailsRes.data ?? []).find((e) => e.id === id)?.email ?? "—";

  const defaultValues: ProfileInput = {
    full_name: profile.full_name ?? "",
    phone: profile.phone ?? "",
    birthdate: profile.birthdate ?? "",
    gender: (profile.gender as ProfileInput["gender"]) ?? "",
  };

  const subscriptions: SubscriptionRow[] = (subscriptionsRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name ?? "",
    price: s.price ?? 0,
    status: s.status,
  }));

  return (
    <div className="space-y-8">
      <div>
        <Button variant="link" className="px-0" asChild>
          <Link href="/admin/kunden">← Zurück zu Kunden</Link>
        </Button>
        <h2 className="font-heading text-xl font-bold">{profile.full_name || "Unbenannt"}</h2>
        <p className="text-sm text-muted-foreground">{email}</p>
      </div>

      <div className="space-y-3">
        <h3 className="font-heading text-lg font-semibold">Profil</h3>
        <CustomerProfileForm customerId={id} defaultValues={defaultValues} />
      </div>

      <div className="space-y-3">
        <h3 className="font-heading text-lg font-semibold">Abos</h3>
        <SubscriptionManager customerId={id} subscriptions={subscriptions} />
      </div>
    </div>
  );
}
