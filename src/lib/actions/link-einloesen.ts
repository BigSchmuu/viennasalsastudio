"use server";

import { headers } from "next/headers";
import { redirect as pfadRedirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { linkTyp } from "@/lib/auth/einmal-link";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { zweiteStufeUmweg } from "@/lib/auth/zweite-stufe-weiche";

/**
 * Löst einen Link aus einer Supabase-Mail ein — erst hier, wenn der Kunde auf
 * /bestaetigen den Knopf drückt. Warum nicht schon beim Öffnen des Links:
 * lib/auth/einmal-link.ts.
 */
export async function linkEinloesen(formData: FormData): Promise<void> {
  const locale = await getLocale();
  const tokenHash = String(formData.get("token_hash") ?? "");
  const typ = linkTyp(String(formData.get("type") ?? ""));
  // `next` stammt aus dem Link und damit womöglich von einem Angreifer: Nur
  // Ziele auf der eigenen Domain, sonst wird ein echter Link zur Umleitung auf
  // eine Phishing-Seite.
  const origin = (await headers()).get("origin") ?? undefined;
  const ziel = safeRedirectPath(String(formData.get("next") ?? ""), "/profil", origin);

  if (tokenHash && typ) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: typ, token_hash: tokenHash });
    if (!error) {
      return await weiter(ziel, locale);
    }

    // Warum Supabase abgelehnt hat, sagt der Code: abgelaufen, schon eingelöst
    // oder durch eine neuere Mail ersetzt. Weder Token noch Adresse gehören
    // ins Log.
    console.error("auth/bestaetigen: Link abgelehnt", {
      type: typ,
      code: error.code,
      status: error.status,
    });

    // Schon eingelöst — etwa weil der Knopf zweimal abgeschickt wurde — und in
    // diesem Browser angemeldet: Dann ist das Ziel erreichbar, und die
    // Fehlerseite wäre genau die falsche Auskunft.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return await weiter(ziel, locale);
    }
  } else {
    console.error("auth/bestaetigen: Link unvollständig", {
      tokenHash: Boolean(tokenHash),
      type: formData.get("type"),
    });
  }

  return redirect({ href: "/login?error=confirm_failed", locale });
}

/**
 * Zum Ziel — bei einem Verwaltungskonto aber erst über die zweite Stufe.
 *
 * PROJ-73: Vorher ging es direkt zum Ziel, und das Layout des Kundenbereichs
 * schickte ein Verwaltungskonto von dort auf die Code-Seite. Die kannte das
 * Ziel nicht und landete im Dashboard — der Admin sah das Passwortformular
 * nie, der Einmal-Link war verbraucht. Jetzt nimmt der Umweg das Ziel mit.
 *
 * Der Umweg wird ohne Sprachebene angesteuert (`next/navigation`): /sicherheit
 * liegt neben dem Kundenbereich und ist einsprachig deutsch.
 */
async function weiter(ziel: string, locale: string): Promise<never> {
  const umweg = await zweiteStufeUmweg(ziel);
  // Ausdrücklich mit `return`, obwohl `redirect` eine Ausnahme wirft: Sonst
  // hängt der Ablauf an einer Eigenschaft, die nirgends hier steht — und ein
  // Test, der sie nachbaut, läuft ins Leere.
  if (umweg) return pfadRedirect(umweg);
  return redirect({ href: ziel, locale });
}
