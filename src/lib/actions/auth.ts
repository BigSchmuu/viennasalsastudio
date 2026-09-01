"use server";

import { createClient } from "@/lib/supabase/server";
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
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "email_not_confirmed" };
    }
    return { error: "E-Mail oder Passwort falsch" };
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
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/profil`,
    },
  });

  if (error) {
    // Mit eingeschaltetem Schutz gegen geleakte Passwörter weist Supabase
    // kompromittierte Passwörter mit diesem Code ab. Ohne eigenen Zweig läse
    // der Kunde „bitte versuche es erneut" — und derselbe Versuch schlüge
    // wieder fehl, endlos. Der Code wird wie email_not_confirmed vom Formular
    // übersetzt.
    if (error.code === "weak_password") {
      return { error: "weak_password" };
    }
    return { error: "Registrierung fehlgeschlagen. Bitte versuche es erneut." };
  }

  return { success: true };
}

export async function resendConfirmationEmail(email: string): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
  });

  if (error) {
    return { error: "Bestätigungs-E-Mail konnte nicht gesendet werden." };
  }

  return { success: true };
}

export async function requestPasswordReset(formData: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
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
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    // Vor der Link-Meldung prüfen: ein abgelehntes Passwort hat mit dem Link
    // nichts zu tun, und „Link abgelaufen" schickt den Kunden auf die falsche
    // Fährte.
    if (error.code === "weak_password") {
      return { error: "weak_password" };
    }
    return { error: "Der Link ist abgelaufen oder wurde bereits verwendet. Bitte fordere einen neuen Link an." };
  }

  return { success: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
