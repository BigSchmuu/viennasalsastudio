import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isTeachingUser } from "@/lib/auth/teaches-courses";

/**
 * Wer schaut gerade zu — einmal pro Anfrage ermittelt.
 *
 * Vorher fragte jede Seite selbst `auth.getUser()`, und der gemeinsame Rahmen
 * noch einmal. Jeder Aufruf geht an den Auth-Dienst, also drei Runden für eine
 * Antwort, die sich innerhalb einer Anfrage nicht ändern kann.
 *
 * `cache()` von React merkt sich das Ergebnis für die Dauer **einer** Anfrage.
 * Kein Zwischenspeicher über Anfragen hinweg: Zwei Besucher bekommen niemals
 * dasselbe Ergebnis, und ein Abmelden wirkt sofort.
 *
 * Die Middleware bleibt außen vor — sie läuft in einem eigenen Umfeld und
 * frischt dort die Sitzung auf. Diese Runde ist nötig und bleibt.
 */
export const getViewer = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export type ViewerContext = {
  user: Awaited<ReturnType<typeof getViewer>>;
  isAdmin: boolean;
  isTeacher: boolean;
};

/**
 * Rolle und Lehrerstatus, ebenfalls einmal pro Anfrage.
 *
 * Der Rahmen brauchte dafür zwei weitere Abfragen vor **jeder** Seite — auch
 * vor solchen, die davon nichts wissen wollen.
 */
export const getViewerContext = cache(async (): Promise<ViewerContext> => {
  const user = await getViewer();
  if (!user) return { user: null, isAdmin: false, isTeacher: false };

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  return {
    user,
    isAdmin: profile?.role === "admin",
    // PROJ-40: auch ein Admin, der tatsächlich unterrichtet.
    isTeacher: await isTeachingUser(supabase, user.id, profile?.role),
  };
});
