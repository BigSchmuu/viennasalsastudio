"use server";

import { createClient } from "@/lib/supabase/server";
import { isLocale } from "@/i18n/routing";

/**
 * Merkt sich die Sprachwahl am Kundenkonto (PROJ-43).
 *
 * Das Sprach-Cookie allein genügt nicht: Benachrichtigungen entstehen im
 * Hintergrund, wenn niemand vor dem Bildschirm sitzt. Nur was am Konto steht,
 * ist dann noch da.
 *
 * Bewusst still: Ein Gast hat kein Konto, an dem sich etwas merken ließe — die
 * Umschaltung selbst funktioniert für ihn trotzdem, über das Cookie. Ein
 * Fehler wäre hier also kein Fehler, sondern der Normalfall.
 */
export async function rememberLanguage(locale: string): Promise<void> {
  if (!isLocale(locale)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ language: locale }).eq("id", user.id);
}
