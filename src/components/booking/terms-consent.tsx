"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/**
 * Die Zustimmung zu den AGB (PROJ-42).
 *
 * Nie vorausgewählt: eine vorausgehakte Zustimmung ist keine. Der Link öffnet
 * einen neuen Tab, damit niemand seine halb ausgefüllte Buchung verliert, nur
 * weil er nachlesen wollte, wozu er gerade Ja sagt.
 */
export function TermsConsent({
  checked,
  onCheckedChange,
  id = "terms-accepted",
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Eigene id, wo zwei Dialoge gleichzeitig im DOM stehen könnten. */
  id?: string;
}) {
  return (
    <div className="flex items-start gap-2 border-t pt-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-0.5"
      />
      <Label htmlFor={id} className="font-normal leading-snug">
        Ich habe die{" "}
        <a
          href="/agb"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
          // Ohne das würde der Klick auf den Link auch das Häkchen umschalten,
          // weil der Link im Label sitzt.
          onClick={(e) => e.stopPropagation()}
        >
          AGB
        </a>{" "}
        gelesen und akzeptiere sie.
      </Label>
    </div>
  );
}
