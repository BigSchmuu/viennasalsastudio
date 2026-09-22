import { BILD_TITEL, type BildRolle, type EventBild } from "@/lib/events/medien";
import { begrenzeAusschnitt } from "@/lib/events/ausschnitt";

/**
 * Bildzeilen aus der Datenbank in die Form bringen, in der die Seiten sie
 * verwenden (PROJ-55).
 *
 * Eine Tür für alle Stellen, die Bilder mitladen — Übersicht, Eventseite,
 * Serienseite. Ohne sie schriebe jede Seite dieselbe Umbenennung noch einmal,
 * und eine davon vergäße die Maße; dann springt der Text beim Laden.
 */
export const BILD_SPALTEN =
  "event_images(id, role, storage_path, alt_text, width, height, position, focus_percent)";

/** Dieselben Spalten, wenn nur das Titelbild gebraucht wird. */
export const TITELBILD_SPALTEN = BILD_SPALTEN;

export type BildZeile = {
  id: string;
  role: string;
  storage_path: string;
  alt_text: string | null;
  width: number;
  height: number;
  position: number;
  focus_percent: number;
};

export function alsBild(zeile: BildZeile): EventBild {
  return {
    id: zeile.id,
    rolle: zeile.role as BildRolle,
    pfad: zeile.storage_path,
    beschreibung: zeile.alt_text,
    breite: zeile.width,
    hoehe: zeile.height,
    ausschnitt: begrenzeAusschnitt(zeile.focus_percent),
  };
}

export function titelbildAus(zeilen: BildZeile[] | null): EventBild | null {
  const treffer = (zeilen ?? []).find((zeile) => zeile.role === BILD_TITEL);
  return treffer ? alsBild(treffer) : null;
}

/** Die Galeriebilder in ihrer Reihenfolge. */
export function galerieAus(zeilen: BildZeile[] | null): EventBild[] {
  return (zeilen ?? [])
    .filter((zeile) => zeile.role !== BILD_TITEL)
    .sort((a, b) => a.position - b.position)
    .map(alsBild);
}
