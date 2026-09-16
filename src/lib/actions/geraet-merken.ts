"use server";

import { cookies } from "next/headers";
import { MERKER_DAUER, MERKER_NAME } from "@/lib/auth/zweite-stufe";

/**
 * Den Merker für ein gemerktes Gerät setzen oder löschen (PROJ-58).
 *
 * Der Merker ist bewusst inhaltsleer. Er sagt nur: „Die Anmeldung in diesem
 * Browser darf das Schließen überdauern." Er ist kein Ausweis — wer ihn kopiert,
 * hat damit gar nichts, weil er allein keine Sitzung eröffnet.
 *
 * Die zweite Hälfte — die Lebensdauer der Anmeldecookies daran auszurichten —
 * gehört zur Sitzungsauffrischung und wird in /backend nachgezogen.
 */
export async function geraetMerken(merken: boolean): Promise<void> {
  const store = await cookies();

  if (!merken) {
    store.delete(MERKER_NAME);
    return;
  }

  store.set(MERKER_NAME, "1", {
    maxAge: MERKER_DAUER,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
