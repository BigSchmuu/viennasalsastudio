"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { mandateSchema } from "@/lib/validations/sepa";
import { normalizeIban } from "@/lib/sepa/iban";
import { nameWeichtAb } from "@/lib/sepa/kontoinhaber";
import { generateMandateReference } from "@/lib/sepa/mandate-reference";
import type { ActionResult } from "@/lib/actions/types";

type MandateRow = {
  id: string;
  iban: string;
  accountHolderName: string;
  mandateReference: string;
  consentedAt: string;
};

type MandateResult = { error: string } | { success: true; mandate: MandateRow };

export async function upsertMandate(formData: FormData): Promise<MandateResult> {
  const parsed = mandateSchema.safeParse({
    iban: formData.get("iban"),
    account_holder_name: formData.get("account_holder_name"),
    consent: formData.get("consent") === "true",
    foreign_holder_confirmed: formData.get("foreign_holder_confirmed") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Nicht eingeloggt" };
  }

  // PROJ-7: Der Name auf dem Konto ist der einzige Anhaltspunkt dafür, wem die
  // IBAN gehört — prüfen lässt sich das beim Lastschriftverfahren nicht. Eine
  // Abweichung ist kein Verdacht (Eltern zahlen fürs Kind, Partner teilen ein
  // Konto), aber sie gehört einmal bestätigt und festgehalten.
  //
  // Die Prüfung steht hier und nicht im Schema: Sie braucht den Profilnamen,
  // und den kennt nur der Server.
  const { data: profil } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const weichtAb = nameWeichtAb(profil?.full_name ?? null, parsed.data.account_holder_name);
  if (weichtAb && !parsed.data.foreign_holder_confirmed) {
    return {
      error:
        "Das Konto läuft auf einen anderen Namen. Bitte bestätige, dass du es benutzen darfst.",
    };
  }

  // Beweiskraft für den Streitfall: Bei einer Rückbuchung mit der Begründung
  // „nie erteilt" ist das der Unterschied zwischen „wir haben nichts" und
  // „erteilt am … von dieser Adresse". Bewusst sparsam — Adresse und
  // Browserkennung, sonst nichts.
  const kopfzeilen = await headers();
  const adresse =
    kopfzeilen.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    kopfzeilen.get("x-real-ip") ||
    null;

  // Revoke any existing active mandate before inserting the replacement.
  // SEPA requires retaining mandate records after use, so this updates
  // revoked_at instead of deleting the row.
  await supabase
    .from("sepa_mandates")
    .update({ revoked_at: new Date().toISOString() })
    .eq("customer_id", user.id)
    .is("revoked_at", null);

  const { data, error } = await supabase
    .from("sepa_mandates")
    .insert({
      customer_id: user.id,
      iban: normalizeIban(parsed.data.iban),
      account_holder_name: parsed.data.account_holder_name,
      mandate_reference: generateMandateReference(),
      consent_ip: adresse,
      consent_user_agent: kopfzeilen.get("user-agent"),
      // Der Profilname von damals, nicht der heutige: Der sagt nichts darüber,
      // was der Kunde bei der Zustimmung vor Augen hatte.
      profile_name_at_consent: profil?.full_name ?? null,
    })
    .select("id, iban, account_holder_name, mandate_reference, consented_at")
    .single();

  if (error || !data) {
    return { error: "Mandat konnte nicht gespeichert werden." };
  }

  revalidatePath("/profil");
  return {
    success: true,
    mandate: {
      id: data.id,
      iban: data.iban,
      accountHolderName: data.account_holder_name,
      mandateReference: data.mandate_reference,
      consentedAt: data.consented_at,
    },
  };
}

export async function revokeMandate(mandateId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Nicht eingeloggt" };
  }

  const { error } = await supabase
    .from("sepa_mandates")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", mandateId)
    .eq("customer_id", user.id);

  if (error) {
    return { error: "Mandat konnte nicht entfernt werden." };
  }

  revalidatePath("/profil");
  return { success: true };
}
