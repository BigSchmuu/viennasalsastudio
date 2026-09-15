/**
 * Bilder und Videos an Events und Serien (PROJ-55).
 *
 * Hier stehen die Grenzen und die Prüfungen, die überall gelten müssen: in der
 * Verwaltung, bevor jemand vergeblich wartet, und auf dem Server, weil sich
 * eine Prüfung im Browser umgehen lässt.
 */

/** Höchstens so groß darf die Datei sein, die jemand auswählt: 10 MB. */
export const MAX_BILD_BYTES = 10 * 1024 * 1024;

/** Höchstens so viele Galeriebilder je Event oder Serie. */
export const MAX_GALERIE_BILDER = 20;

/**
 * Längste Kante nach dem Verkleinern.
 *
 * Reicht für die Großansicht auf einem großen Bildschirm; ein 6000-Pixel-Foto
 * vom Telefon dagegen lädt niemand herunter, um es 900 Pixel breit anzusehen.
 */
export const MAX_KANTE = 2000;

export const ERLAUBTE_BILDTYPEN = ["image/jpeg", "image/png", "image/webp"] as const;

/** Der Bereich im Bildspeicher, in dem die Eventbilder liegen. */
export const BILDER_BUCKET = "event-bilder";

export const BILD_TITEL = "cover";
export const BILD_GALERIE = "gallery";

export type BildRolle = typeof BILD_TITEL | typeof BILD_GALERIE;

export type EventBild = {
  id: string;
  rolle: BildRolle;
  pfad: string;
  beschreibung: string | null;
  breite: number;
  hoehe: number;
};

export type EventVideo = {
  id: string;
  youtubeId: string;
  titel: string | null;
};

/** Wohin ein Bild oder Video gehört — an ein Event oder an eine Serie. */
export type MedienZiel = { eventId: string; serieId?: never } | { eventId?: never; serieId: string };

/**
 * Warum diese Datei nicht in Frage kommt — oder `null`, wenn sie passt.
 *
 * Gibt einen Schlüssel zurück, keinen fertigen Satz: Der Text steht in den
 * Sprachdateien, und dieselbe Prüfung läuft auch dort, wo niemand zusieht.
 */
export type BildFehler = "typ" | "heic" | "zuGross";

export function bildFehler(datei: { type: string; size: number; name: string }): BildFehler | null {
  const erlaubt = (ERLAUBTE_BILDTYPEN as readonly string[]).includes(datei.type);
  if (!erlaubt) {
    // iPhone-Fotos kommen oft als HEIC. Der eigene Hinweis dazu erspart die
    // Suche nach dem Grund — umwandeln kann das Telefon selbst.
    const heic = /\.hei[cf]$/i.test(datei.name) || datei.type === "image/heic" || datei.type === "image/heif";
    return heic ? "heic" : "typ";
  }
  if (datei.size > MAX_BILD_BYTES) return "zuGross";
  return null;
}

/**
 * Die Maße nach dem Verkleinern — das Seitenverhältnis bleibt.
 *
 * Ein Bild, das schon klein genug ist, wird nicht vergrößert: Aus einem
 * 800-Pixel-Flyer würde sonst ein unscharfer 2000-Pixel-Flyer.
 */
export function zielGroesse(breite: number, hoehe: number, maxKante = MAX_KANTE) {
  const laengste = Math.max(breite, hoehe);
  if (laengste <= maxKante) return { breite, hoehe };

  const faktor = maxKante / laengste;
  return {
    breite: Math.max(1, Math.round(breite * faktor)),
    hoehe: Math.max(1, Math.round(hoehe * faktor)),
  };
}

/**
 * Die öffentliche Adresse eines Bildes im Speicher.
 *
 * Eine Tür für alle Stellen, die ein Bild anzeigen — sonst baut jede Seite den
 * Pfad selbst zusammen und eine davon macht es anders.
 */
export function bildUrl(pfad: string): string {
  const basis = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${basis}/storage/v1/object/public/${BILDER_BUCKET}/${pfad}`;
}

/** Der Alternativtext eines Bildes: die Beschreibung, sonst der Eventname. */
export function bildBeschriftung(beschreibung: string | null, eventName: string): string {
  const text = beschreibung?.trim();
  return text && text.length > 0 ? text : eventName;
}
