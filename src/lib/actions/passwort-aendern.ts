"use server";

import { createClient } from "@/lib/supabase/server";
import { createPruefClient } from "@/lib/supabase/pruefung";
import { passwortaenderungsfehler } from "@/lib/auth/fehler";
import { changePasswordSchema } from "@/lib/validations/auth";
import type { ActionResult } from "@/lib/actions/auth";

/**
 * Das eigene Passwort im angemeldeten Zustand ändern (PROJ-73).
 *
 * Die Reihenfolge der vier Schritte ist nicht beliebig:
 *
 * 1. Eingaben prüfen — ohne Rückfrage an Supabase.
 * 2. Das **aktuelle** Passwort gegenprüfen, über eine cookie-freie Verbindung
 *    (lib/supabase/pruefung.ts). Mit dem gewöhnlichen Server-Client ginge dabei
 *    die laufende Sitzung verloren.
 * 3. Das neue Passwort setzen — mit der echten Sitzung.
 * 4. Andere Anmeldungen beenden. Das räumt zugleich die Sitzung weg, die
 *    Schritt 2 bei Supabase angelegt hat; umgekehrt bliebe sie stehen.
 *
 * Schritt 4 darf die Aktion nicht scheitern lassen: Das Passwort ist dann
 * schon geändert, und „fehlgeschlagen" verleitete zum zweiten Versuch — der
 * dann am alten Passwort scheitern würde.
 */
export async function passwortAendern(formData: FormData): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errInvalidInput" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Kein Konto, keine Adresse: Das Formular stand offen, während die Sitzung
  // ablief. Das neue Passwort still zu verwerfen wäre richtig, es still zu
  // setzen wäre falsch — gesagt werden muss es trotzdem.
  if (!user?.email) {
    return { error: "errSessionExpired" };
  }

  const pruef = createPruefClient();
  const { error: pruefFehler } = await pruef.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (pruefFehler) {
    // Ein Limit wird benannt, statt als „Passwort falsch" durchzugehen: Sonst
    // tippt jemand dasselbe richtige Passwort immer wieder ein.
    const grund = passwortaenderungsfehler(pruefFehler.code);
    return { error: grund === "errPasswordChangeFailed" ? "errCurrentPasswordWrong" : grund };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: passwortaenderungsfehler(error.code) };
  }

  // „others" und nicht „global": Das eigene Gerät bleibt angemeldet. Ein
  // globales Abmelden warf den Nutzer hier selbst hinaus — und ein Admin müsste
  // danach die zweite Stufe erneut bestätigen.
  const { error: abmeldefehler } = await supabase.auth.signOut({ scope: "others" });
  if (abmeldefehler) {
    console.error("passwortAendern: andere Geräte blieben angemeldet", {
      code: abmeldefehler.code,
      status: abmeldefehler.status,
    });
  }

  return { success: true };
}
