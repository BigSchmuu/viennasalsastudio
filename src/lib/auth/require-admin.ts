import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { zweiteStufeLage } from "@/lib/auth/zweite-stufe-lage";
import { WEG_CODE, WEG_EINRICHTEN } from "@/lib/auth/zweite-stufe";

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/admin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  // PROJ-58: Der eine Torwächter, durch den alles geht — die Verwaltungsseiten
  // über das Layout, und jede Server-Action, die hier hereinschaut. Damit sind
  // auch die Handgriffe mit Generalschlüssel abgedeckt: Sie umgehen zwar die
  // Regeln der Datenbank, aber nicht diese Prüfung.
  const lage = await zweiteStufeLage();
  if (lage === "einrichten") {
    redirect(WEG_EINRICHTEN);
  }
  if (lage === "bestaetigen") {
    redirect(WEG_CODE);
  }

  return { supabase, user };
}
