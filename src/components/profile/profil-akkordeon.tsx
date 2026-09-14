"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Accordion } from "@/components/ui/accordion";

/**
 * Öffnet den Profil-Abschnitt, auf den die Adresse zeigt — z. B. `/profil#tickets`.
 *
 * „Mein Bereich" verlinkte schon länger auf `#abo`, `#buchungen`,
 * `#zahlungsweise` und `#warteliste`. Aber kein Abschnitt trug diese Kennung,
 * und keiner öffnete sich: Wer auf „Mandat hinterlegen" tippte, landete oben
 * auf dem Profil und musste selbst suchen. Aufgefallen bei PROJ-53
 * (2026-09-14), als „Du hast ein Ticket" denselben Weg brauchte.
 *
 * Ein unbekannter Anker öffnet nichts: Die Gruppe enthält dann einfach keinen
 * Abschnitt mit diesem Wert.
 */
export function ProfilAkkordeon({ children }: { children: ReactNode }) {
  const [offen, setOffen] = useState<string[]>([]);

  useEffect(() => {
    function ausAdresse() {
      const ziel = decodeURIComponent(window.location.hash.slice(1));
      if (!ziel) return;
      setOffen((bisher) => (bisher.includes(ziel) ? bisher : [...bisher, ziel]));
    }
    ausAdresse();
    window.addEventListener("hashchange", ausAdresse);
    return () => window.removeEventListener("hashchange", ausAdresse);
  }, []);

  return (
    <Accordion type="multiple" value={offen} onValueChange={setOffen}>
      {children}
    </Accordion>
  );
}
