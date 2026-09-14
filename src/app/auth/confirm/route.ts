import { type NextRequest, NextResponse } from "next/server";
import { linkTyp } from "@/lib/auth/einmal-link";

/**
 * Einstieg für die Links aus den Supabase-Mails — löst selbst nichts ein.
 *
 * Bis 2026-09-14 rief diese Route `verifyOtp` schon beim Öffnen auf. Mail-Apps
 * und Scanner, die Links vorab aufrufen, verbrauchten damit das Token, und der
 * Kunde sah „ungültig oder abgelaufen“ (lib/auth/einmal-link.ts). Jetzt reicht
 * die Route nur an /bestaetigen weiter; eingelöst wird dort per Knopf.
 *
 * Die Adresse selbst bleibt, weil die Mailvorlagen im Supabase-Dashboard auf
 * sie zeigen — siehe PROJ-2, Nachtrag vom 2026-08-13.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const typ = linkTyp(searchParams.get("type"));

  if (tokenHash && typ) {
    const ziel = new URL("/bestaetigen", origin);
    ziel.searchParams.set("token_hash", tokenHash);
    ziel.searchParams.set("type", typ);
    const next = searchParams.get("next");
    if (next) ziel.searchParams.set("next", next);
    return NextResponse.redirect(ziel);
  }

  // Fehlt `type` oder ist er unbekannt, ist die Mailvorlage im Dashboard falsch
  // zusammengesetzt. Weder Token noch Adresse gehören ins Log.
  console.error("auth/confirm: Link unvollständig", {
    tokenHash: Boolean(tokenHash),
    type: searchParams.get("type"),
  });
  return NextResponse.redirect(`${origin}/login?error=confirm_failed`);
}
