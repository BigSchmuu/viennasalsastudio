"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * PROJ-101: Darf dieser Besucher den Studierendenpreis wählen?
 *
 * Die Antwort kommt aus `studentenpreis_auskunft()` in der Datenbank, also aus
 * derselben Quelle wie die Prüfung beim Buchen. Absichtlich keine Rechnung im
 * Browser: Das Geburtsdatum müsste dafür an die Oberfläche wandern, und zwei
 * Rechenwege für dieselbe Grenze driften.
 *
 * Die Oberfläche bekommt auch den Grund, nicht nur das Nein — „kein
 * Geburtsdatum“ und „zu alt“ brauchen verschiedene Sätze, und der erste braucht
 * einen Weg ins Profil.
 */
export type StudentenpreisGrund =
  | "ok"
  | "zu_alt"
  | "kein_geburtsdatum"
  | "nicht_angemeldet"
  /** Die Auskunft war nicht zu holen. Lieber sagen als raten. */
  | "unbekannt";

export type StudentenpreisAuskunft = { moeglich: boolean; grund: StudentenpreisGrund };

const GRUENDE: StudentenpreisGrund[] = ["ok", "zu_alt", "kein_geburtsdatum", "nicht_angemeldet"];

export async function studentenpreisAuskunft(): Promise<StudentenpreisAuskunft> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("studentenpreis_auskunft");

  if (error) {
    console.error("PROJ-101: Studentenpreis-Auskunft nicht lesbar", error);
    return { moeglich: false, grund: "unbekannt" };
  }

  // `returns table` liefert eine Liste, auch bei genau einer Zeile.
  const zeile = (data ?? [])[0];
  if (!zeile) return { moeglich: false, grund: "unbekannt" };

  const grund = GRUENDE.includes(zeile.grund as StudentenpreisGrund)
    ? (zeile.grund as StudentenpreisGrund)
    : "unbekannt";

  return { moeglich: zeile.moeglich === true, grund };
}
