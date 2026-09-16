"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { MERKER_DAUER, MERKER_NAME } from "@/lib/auth/zweite-stufe";

/**
 * Den Merker für dieses Gerät setzen (PROJ-58).
 *
 * `merken = true` → er bleibt 30 Tage liegen, das Gerät fragt so lange nicht
 * erneut nach einem Code.
 * `merken = false` → er endet mit dem Browser. Genau das ist der Unterschied
 * zwischen „mein Handy" und „der Rechner an der Rezeption".
 *
 * Aufgerufen wird das erst *nach* bestandener Codeprüfung — vorher wüsste der
 * Merker nicht, wessen Gerät er sich merkt.
 */
export async function geraetMerken(merken: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const store = await cookies();
  store.set(MERKER_NAME, user.id, {
    // Ohne maxAge entsteht ein Cookie, das der Browser beim Schließen vergisst.
    ...(merken ? { maxAge: MERKER_DAUER } : {}),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

/** Das Gerät wieder vergessen — beim Abmelden aller Geräte. */
export async function geraetVergessen(): Promise<void> {
  const store = await cookies();
  store.delete(MERKER_NAME);
}
