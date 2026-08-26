"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { pricingSchema } from "@/lib/validations/booking";
import type { ActionResult } from "@/lib/actions/types";

/**
 * Ein leeres Feld ist kein Preis von 0 €, sondern „nicht gepflegt". Nur so
 * kann der Buchungsdialog einen Hinweis zeigen statt eine Kachel mit 0,00 €.
 */
function readPrice(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return Number(raw);
}

/**
 * Bei den Belohnungsbeträgen ist 0 eine Aussage, leer dagegen ein Versehen.
 * Ein leeres Feld wird deshalb nicht als 0 gelesen — sonst schaltete ein
 * versehentlich geleertes Feld das Empfehlungsprogramm still ab.
 */
function readReward(value: FormDataEntryValue | null): number | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  return Number(raw);
}

export async function updatePricing(formData: FormData): Promise<ActionResult> {
  const parsed = pricingSchema.safeParse({
    normal_price: Number(formData.get("normal_price")),
    student_price: Number(formData.get("student_price")),
    course_price: readPrice(formData.get("course_price")),
    course_student_price: readPrice(formData.get("course_student_price")),
    flatrate_price: readPrice(formData.get("flatrate_price")),
    flatrate_student_price: readPrice(formData.get("flatrate_student_price")),
    referral_reward_referrer: readReward(formData.get("referral_reward_referrer")),
    referral_reward_referee: readReward(formData.get("referral_reward_referee")),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();

  const { data: existing } = await supabase.from("dropin_pricing").select("id").limit(1).single();
  if (!existing) {
    return { error: "Preiseinstellungen nicht gefunden." };
  }

  const { error } = await supabase
    .from("dropin_pricing")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", existing.id);

  if (error) {
    return { error: "Preise konnten nicht gespeichert werden." };
  }

  // Die Preise erscheinen im Buchungsdialog auf allen drei Wegen zur Buchung.
  revalidatePath("/admin/buchungen");
  revalidatePath("/kurse");
  revalidatePath("/stundenplan");
  return { success: true };
}
