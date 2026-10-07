/**
 * Die Kündigungsgründe (PROJ-80).
 *
 * Freiwillig, nie Pflicht: Ein Pflichtfeld würde das Kündigen schwerer machen
 * als das Abschließen. Die Liste macht die Gründe zählbar, die Notiz fängt das
 * Besondere auf.
 *
 * Wer hier einen Grund ergänzt, braucht eine Migration dazu — die Liste steht
 * auch als CHECK in der Datenbank. Ohne sie scheitert das Speichern, und zwar
 * erst beim Kunden im Formular.
 */

export const KUENDIGUNGSGRUENDE = [
  { wert: "zu_teuer", label: "Zu teuer" },
  { wert: "keine_zeit", label: "Keine Zeit mehr" },
  { wert: "umzug", label: "Umzug" },
  { wert: "gesundheit", label: "Verletzung oder Gesundheit" },
  { wert: "kurs_passt_nicht", label: "Kurs passt nicht" },
  { wert: "sonstiges", label: "Sonstiger Grund" },
] as const;

export type Kuendigungsgrund = (typeof KUENDIGUNGSGRUENDE)[number]["wert"];

/** Englische Beschriftungen für den Kundenbereich (PROJ-43). */
const LABELS_EN: Record<Kuendigungsgrund, string> = {
  zu_teuer: "Too expensive",
  keine_zeit: "No time any more",
  umzug: "Moving away",
  gesundheit: "Injury or health",
  kurs_passt_nicht: "The course isn't a fit",
  sonstiges: "Another reason",
};

export function istKuendigungsgrund(wert: unknown): wert is Kuendigungsgrund {
  return KUENDIGUNGSGRUENDE.some((g) => g.wert === wert);
}

/**
 * Die Beschriftung eines Grundes — oder der rohe Wert.
 *
 * Unbekanntes kommt unverändert durch statt als leere Stelle: Ein roher Wert ist
 * ein Fehler, den man sieht und melden kann; „—" wäre einer, den niemand
 * bemerkt. Dieselbe Entscheidung wie bei `fehlertext` in lib/auth/fehler.ts.
 */
export function grundLabel(wert: string | null | undefined, locale = "de"): string {
  if (!wert) return "Keine Angabe";
  if (!istKuendigungsgrund(wert)) return wert;
  if (locale === "en") return LABELS_EN[wert];
  return KUENDIGUNGSGRUENDE.find((g) => g.wert === wert)!.label;
}

export type GrundZaehlung = {
  /** Die Gründe mit ihrer Anzahl, häufigster zuerst. */
  gruende: { wert: string; label: string; anzahl: number }[];
  /** Wie viele Kündigungen überhaupt gezählt wurden. */
  gesamt: number;
  /** Wie viele davon einen Grund nennen. */
  mitGrund: number;
};

/**
 * Die Gründe eines Zeitraums zusammenzählen.
 *
 * Häufigster zuerst, bei Gleichstand in der Reihenfolge der Liste — sonst
 * springen zwei gleich häufige Gründe bei jedem Laden.
 *
 * „Ohne Angabe" steht **nicht** unter den Gründen, sondern als eigene Zahl
 * daneben: Sie ist kein Grund, sondern die Antwort auf „wie belastbar ist das
 * hier?".
 */
export function zaehleGruende(werte: (string | null | undefined)[]): GrundZaehlung {
  const anzahlen = new Map<string, number>();
  let mitGrund = 0;

  for (const wert of werte) {
    if (!wert) continue;
    mitGrund += 1;
    anzahlen.set(wert, (anzahlen.get(wert) ?? 0) + 1);
  }

  const reihenfolge = KUENDIGUNGSGRUENDE.map((g) => g.wert as string);
  const gruende = [...anzahlen.entries()]
    .map(([wert, anzahl]) => ({ wert, label: grundLabel(wert), anzahl }))
    .sort((a, b) => {
      if (b.anzahl !== a.anzahl) return b.anzahl - a.anzahl;
      const ia = reihenfolge.indexOf(a.wert);
      const ib = reihenfolge.indexOf(b.wert);
      // Unbekannte Werte nach hinten, nicht nach vorn.
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  return { gruende, gesamt: werte.length, mitGrund };
}
