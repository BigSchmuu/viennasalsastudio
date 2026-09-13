"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { enqueueAndDispatch } from "@/lib/notifications/dispatch";
import { heuteInWien } from "@/lib/constants/zeitzone";
import { bestaetigtesKonto } from "@/lib/auth/bestehendes-konto";
import {
  anmeldefehler,
  registrierungsfehler,
  bestaetigungsfehler,
  zuruecksetzfehler,
} from "@/lib/auth/fehler";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export type ActionResult = { error: string } | { success: true };
export type SignInResult = { error: string } | { success: true; role: string };

export async function signIn(formData: FormData): Promise<SignInResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errInvalidInput" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Ein Schlüssel statt eines Satzes — das Formular übersetzt ihn. Und ein
    // erreichtes Limit wird benannt, statt als „falsches Passwort" zu
    // erscheinen (siehe lib/auth/fehler.ts).
    return { error: anmeldefehler(error.code) };
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();

  return { success: true, role: profile?.role ?? "customer" };
}

export async function signUp(formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errInvalidInput" };
  }

  // Vor der Registrierung nachsehen, nicht danach: signUp legt eine neue
  // Adresse sofort an, und die Suche danach fand das eben angelegte Konto. Jede
  // Neuregistrierung bekam deshalb neben der Bestätigungsmail auch „Du hast
  // bereits ein Konto bei uns". Gemeldet aus dem Betrieb am 2026-09-13.
  const bestehendesKonto = await findeBestaetigtesKonto(parsed.data.email);

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/profil`,
    },
  });

  // Supabase antwortet bei einer bereits bestätigten Adresse absichtlich genau
  // wie bei einer neuen und verschickt nichts — „an obfuscated user response
  // with no verification email sent. This prevents user enumeration attacks."
  // Für den Besucher am Formular bleibt das so: Wer fremde Adressen
  // durchprobiert, erfährt weiterhin nichts.
  //
  // Der Inhaber des Postfachs erfährt es dagegen sehr wohl — per Mail. Nur wer
  // Zugriff auf das Postfach hat, bekommt die Information, und das ist genau
  // der Richtige. Vorher stand der Kunde vor einer Seite, die eine Mail
  // versprach, die nie kam.
  if (bestehendesKonto) {
    await benachrichtigeUeberBestehendesKonto(bestehendesKonto);
  }

  if (error) {
    // Mit eingeschaltetem Schutz gegen geleakte Passwörter weist Supabase
    // kompromittierte Passwörter mit diesem Code ab. Ohne eigenen Zweig läse
    // der Kunde „bitte versuche es erneut" — und derselbe Versuch schlüge
    // wieder fehl, endlos. Der Code wird wie email_not_confirmed vom Formular
    // übersetzt.
    // Bisher wurde alles außer „schwaches Passwort" zu „Registrierung
    // fehlgeschlagen, bitte erneut" — auch ein erreichtes Mailversand-Limit,
    // bei dem der nächste Versuch genauso scheitert.
    return { error: registrierungsfehler(error.code) };
  }

  return { success: true };
}

export async function resendConfirmationEmail(email: string): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errInvalidInput" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
  });

  if (error) {
    return { error: bestaetigungsfehler(error.code) };
  }

  return { success: true };
}

export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errInvalidInput" };
  }

  const supabase = await createClient();
  // Result intentionally ignored: same neutral response whether or not the
  // email exists, to avoid leaking which addresses are registered.
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/passwort-zuruecksetzen`,
  });

  return { success: true };
}

export async function resetPassword(formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "errInvalidInput" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    // Vor der Link-Meldung prüfen: ein abgelehntes Passwort hat mit dem Link
    // nichts zu tun, und „Link abgelaufen" schickt den Kunden auf die falsche
    // Fährte.
    return { error: zuruecksetzfehler(error.code) };
  }

  return { success: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

/**
 * Die ID des bestätigten Kontos mit dieser Adresse — oder `null`. Wer die
 * Nachricht bekommt und wer nicht, steht in `lib/auth/bestehendes-konto.ts`.
 *
 * Scheitert nie nach außen: Ohne Auskunft geht eben keine Nachricht hinaus,
 * die Registrierung selbst darf daran nicht hängen.
 */
async function findeBestaetigtesKonto(email: string): Promise<string | null> {
  try {
    const service = createServiceClient();
    // `profiles` kennt keine E-Mail-Adresse, die liegt in `auth.users`. Bei
    // rund 75 Konten genügt eine Seite; wächst das Studio in die Tausende,
    // gehört hier eine gezielte Suche hin statt einer vollen Liste.
    const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
    return bestaetigtesKonto(data?.users ?? [], email);
  } catch (fehler) {
    console.error("findeBestaetigtesKonto fehlgeschlagen", fehler);
    return null;
  }
}

/**
 * Schickt dem Inhaber eines bestehenden Kontos eine Nachricht, dass jemand
 * versucht hat, sich mit seiner Adresse erneut zu registrieren.
 *
 * Scheitert nie nach außen: Die Registrierung darf daran nicht hängen, und der
 * Rückgabewert des Formulars bleibt in jedem Fall derselbe — sonst wäre am
 * Antwortverhalten doch wieder ablesbar, ob es das Konto gibt.
 */
async function benachrichtigeUeberBestehendesKonto(kontoId: string): Promise<void> {
  try {
    const heute = heuteInWien();
    await enqueueAndDispatch({
      customerId: kontoId,
      eventType: "konto_existiert",
      payload: { attemptedAt: heute },
      // Höchstens eine Nachricht je Konto und Tag. Ohne diese Sperre ließe sich
      // über das offene Registrierungsformular ein fremdes Postfach zuschütten.
      dedupeKey: `konto_existiert:${kontoId}:${heute}`,
    });
  } catch (fehler) {
    console.error("benachrichtigeUeberBestehendesKonto fehlgeschlagen", fehler);
  }
}
