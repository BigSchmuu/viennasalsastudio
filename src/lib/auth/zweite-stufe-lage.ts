import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { MERKER_NAME } from "@/lib/auth/zweite-stufe";

/**
 * Wie weit ist ein Verwaltungskonto bei der zweiten Stufe? (PROJ-58)
 *
 * - `einrichten`  — es hängt noch keine Authenticator-App am Konto
 * - `bestaetigen` — eine App ist hinterlegt, aber dieses Gerät hat sie in
 *                   dieser Anmeldung nicht benutzt
 * - `erfuellt`    — bestätigt, und das Gerät gilt noch
 */
export type ZweiteStufeLage = "einrichten" | "bestaetigen" | "erfuellt";

/**
 * Die Auskunft steckt im Anmeldetoken, das ohnehin vorliegt — es geht keine
 * Anfrage an Supabase hinaus. `cache()` hält sie trotzdem für die Dauer einer
 * Anfrage fest, weil Rahmen und Seite dieselbe Frage stellen.
 *
 * Bei einem Fehler lautet die Antwort `einrichten`, nicht `erfuellt`. Ein
 * Torwächter, der im Zweifel durchlässt, ist keiner.
 */
export const zweiteStufeLage = cache(async (): Promise<ZweiteStufeLage> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error || !data) return "einrichten";

  // `nextLevel` steht erst auf aal2, wenn wirklich eine App hinterlegt ist.
  if (data.nextLevel !== "aal2") return "einrichten";
  if (data.currentLevel !== "aal2") return "bestaetigen";

  // Die Anmeldung hat die zweite Stufe bestätigt. Ob *dieses Gerät* noch als
  // bestätigt gilt, entscheidet der Merker: Ohne Häkchen ist er beim Schließen
  // des Browsers verschwunden, mit Häkchen nach 30 Tagen.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "einrichten";

  const store = await cookies();
  return store.get(MERKER_NAME)?.value === user.id ? "erfuellt" : "bestaetigen";
});
