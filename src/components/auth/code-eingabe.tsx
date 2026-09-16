"use client";

import { Input } from "@/components/ui/input";
import { CODE_LAENGE, nurZiffern } from "@/lib/auth/zweite-stufe";

/**
 * Das Feld für den sechsstelligen Code.
 *
 * Ein einziges Feld, nicht sechs einzelne Kästchen. Die Kästchen sehen zwar
 * hübscher aus, aber iOS und Android füllen einen Code nur dann von selbst
 * ein, wenn er in *ein* Feld mit `one-time-code` passt — bei sechs Kästchen
 * landet alles im ersten oder gar nichts. Da die Einrichtung typischerweise am
 * Handy passiert, wiegt das schwerer als das Aussehen.
 */
export function CodeEingabe({
  wert,
  aufAenderung,
  deaktiviert,
  beschriftung = "Sechsstelliger Code aus deiner Authenticator-App",
}: {
  wert: string;
  aufAenderung: (wert: string) => void;
  deaktiviert?: boolean;
  beschriftung?: string;
}) {
  return (
    <Input
      value={wert}
      onChange={(e) => aufAenderung(nurZiffern(e.target.value))}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={CODE_LAENGE}
      disabled={deaktiviert}
      autoFocus
      aria-label={beschriftung}
      placeholder="000000"
      className="h-14 text-center font-mono text-2xl tracking-[0.4em] placeholder:tracking-[0.4em] placeholder:text-muted-foreground/40"
    />
  );
}
