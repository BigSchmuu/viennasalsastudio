import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerProfileForm } from "@/components/admin/customers/customer-profile-form";
import { SubscriptionManager, type SubscriptionRow } from "@/components/admin/customers/subscription-manager";
import { CreditManager, type CreditEntry } from "@/components/admin/customers/credit-manager";
import type { ProfileInput } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone, birthdate, gender, referral_code, referred_by, referral_rewarded_at")
    .eq("id", id)
    .eq("role", "customer")
    .single();

  if (!profile) {
    notFound();
  }

  const [emailsRes, subscriptionsRes, mandateRes, mandateHistoryRes, coursesRes, creditsRes] = await Promise.all([
    supabase.rpc("admin_list_customer_emails"),
    supabase
      .from("subscriptions")
      .select("id, name, price, status, course_id, cycle_anchor_date, pending_status, pending_effective_date")
      .eq("customer_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("sepa_mandates")
      .select("consented_at")
      .eq("customer_id", id)
      .is("revoked_at", null)
      .maybeSingle(),
    supabase
      .from("sepa_mandates")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", id),
    supabase.from("courses").select("id, name").order("name", { ascending: true }),
    // PROJ-44: Kontostand und Verlauf. Der Stand ist die Summe des Verlaufs,
    // deshalb reicht eine Abfrage.
    supabase
      .from("customer_credits")
      .select("id, amount, origin, reason, created_at")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const email = (emailsRes.data ?? []).find((e) => e.id === id)?.email ?? "—";
  const hasActiveSubscription = (subscriptionsRes.data ?? []).some((s) => s.status === "active");
  const mandate = mandateRes.data;
  const hadMandateBefore = (mandateHistoryRes.count ?? 0) > 0;

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
    courseId: s.course_id,
    cycleAnchorDate: s.cycle_anchor_date,
    pendingStatus: s.pending_status,
    pendingEffectiveDate: s.pending_effective_date,
  }));

  const courses = coursesRes.data ?? [];

  // PROJ-44: Wer diesen Kunden geworben hat. Wurde der Werbende geloescht,
  // steht referred_by auf null und die Zuordnung ist damit weg — das Guthaben
  // des Geworbenen bleibt davon unberuehrt.
  let werber: { id: string; full_name: string | null } | null = null;
  if (profile.referred_by) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", profile.referred_by)
      .maybeSingle();
    werber = data;
  }

  const creditEntries: CreditEntry[] = (creditsRes.data ?? []).map((c) => ({
    id: c.id,
    amount: Number(c.amount),
    origin: c.origin as CreditEntry["origin"],
    reason: c.reason,
    createdAt: c.created_at,
  }));
  const creditBalance = creditEntries.reduce((summe, e) => summe + e.amount, 0);

  return (
    <div className="space-y-8">
      <div>
        <Button variant="link" className="px-0" asChild>
          <Link href="/admin/kunden">← Zurück zu Kunden</Link>
        </Button>
        <h2 className="font-heading text-xl font-bold">{profile.full_name || "Unbenannt"}</h2>
        <p className="text-sm text-muted-foreground">{email}</p>
        <div className="mt-2">
          {mandate ? (
            <Badge variant="secondary">
              SEPA-Mandat hinterlegt seit {new Date(mandate.consented_at).toLocaleDateString("de-AT")}
            </Badge>
          ) : hadMandateBefore && hasActiveSubscription ? (
            <Badge style={{ backgroundColor: "#e63946", color: "white" }}>Mandat entfernt — Abo prüfen</Badge>
          ) : (
            <Badge variant="outline">Kein Mandat hinterlegt</Badge>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-heading text-lg font-semibold">Profil</h3>
        <CustomerProfileForm customerId={id} defaultValues={defaultValues} />
      </div>

      <div className="space-y-3">
        <h3 className="font-heading text-lg font-semibold">Abos</h3>
        <SubscriptionManager customerId={id} subscriptions={subscriptions} courses={courses} />
      </div>

      <div className="space-y-3">
        <h3 className="font-heading text-lg font-semibold">Guthaben und Empfehlung</h3>
        <div className="rounded-md border p-4 text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Eigener Empfehlungscode: </span>
            <span className="font-mono">{profile.referral_code ?? "—"}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Geworben von: </span>
            {werber ? (
              <Link href={`/admin/kunden/${werber.id}`} className="underline">
                {werber.full_name ?? "Unbenannt"}
              </Link>
            ) : (
              "—"
            )}
            {profile.referred_by && !profile.referral_rewarded_at && (
              <span className="text-muted-foreground"> — Guthaben noch offen, es entsteht nach der ersten erfolgreichen Abbuchung</span>
            )}
          </p>
        </div>
        <CreditManager customerId={id} balance={creditBalance} entries={creditEntries} />
      </div>
    </div>
  );
}
