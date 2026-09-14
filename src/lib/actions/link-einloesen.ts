"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { linkTyp } from "@/lib/auth/einmal-link";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

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
      return redirect({ href: ziel, locale });
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
      return redirect({ href: ziel, locale });
    }
  } else {
    console.error("auth/bestaetigen: Link unvollständig", {
      tokenHash: Boolean(tokenHash),
      type: formData.get("type"),
    });
  }

  return redirect({ href: "/login?error=confirm_failed", locale });
}
