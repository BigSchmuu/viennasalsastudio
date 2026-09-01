"use client";

import { useEffect, useRef } from "react";
import type { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form";

/**
 * Übernimmt, was der Browser vor der Hydration in die Felder geschrieben hat.
 *
 * Ein Passwortmanager füllt aus, sobald das HTML da ist — also bevor React
 * hydriert hat. Die Felder sind über `Controller` gesteuert, ihr Wert kommt
 * also aus dem Formularzustand, und der steht zu diesem Zeitpunkt noch auf
 * dem Leerstring. Beim Hydrieren setzt React das Feld darauf zurück: Der
 * Kunde sieht „ist erforderlich" bei einem Feld, in dem sichtbar etwas stand.
 *
 * Gefunden wurde das im Login. Dasselbe Muster steckte in allen anderen
 * Formularen des Kundenbereichs — deshalb steht die Lösung hier und nicht
 * viermal abgeschrieben.
 *
 * Rückgabe ist die Referenz, die auf das `<form>`-Element gehört.
 */
export function useAutofillUebernehmen<T extends FieldValues>(
  form: UseFormReturn<T>,
  felder: readonly Path<T>[]
) {
  const formularRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const formular = formularRef.current;
    if (!formular) return;

    for (const feld of felder) {
      const eingabe = formular.querySelector<HTMLInputElement>(`input[name="${feld}"]`);
      const wert = eingabe?.value ?? "";
      if (wert && wert !== form.getValues(feld)) {
        form.setValue(feld, wert as PathValue<T, Path<T>>, { shouldValidate: false });
      }
    }
    // Absichtlich nur einmal nach dem Hydrieren: der Browser füllt genau
    // einmal, und zwar vor diesem Zeitpunkt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return formularRef;
}
