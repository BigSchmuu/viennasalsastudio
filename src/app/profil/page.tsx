import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/auth/profile-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { PaymentMethodSection, type MandateData } from "@/components/payments/payment-method-section";
import { createClient } from "@/lib/supabase/server";
import type { ProfileInput } from "@/lib/validations/auth";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/profil");
  }

  const [{ data: profile }, { data: mandateRow }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, birthdate, gender").eq("id", user.id).single(),
    supabase
      .from("sepa_mandates")
      .select("id, iban, account_holder_name, consented_at")
      .eq("customer_id", user.id)
      .is("revoked_at", null)
      .maybeSingle(),
  ]);

  const mandate: MandateData | null = mandateRow
    ? {
        id: mandateRow.id,
        iban: mandateRow.iban,
        accountHolderName: mandateRow.account_holder_name,
        consentedAt: mandateRow.consented_at,
      }
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="font-heading">Mein Profil</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
            <LogoutButton />
          </CardHeader>
          <CardContent>
            <ProfileForm
              defaultValues={{
                full_name: profile?.full_name ?? "",
                phone: profile?.phone ?? "",
                birthdate: profile?.birthdate ?? "",
                gender: (profile?.gender ?? "") as ProfileInput["gender"],
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg">Zahlungsmethode</CardTitle>
            <CardDescription>SEPA-Lastschriftmandat für deine Abo-Zahlungen</CardDescription>
          </CardHeader>
          <CardContent>
            <PaymentMethodSection mandate={mandate} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
