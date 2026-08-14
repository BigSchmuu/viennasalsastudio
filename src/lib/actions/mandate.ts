"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mandateSchema } from "@/lib/validations/sepa";
import { normalizeIban } from "@/lib/sepa/iban";
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
