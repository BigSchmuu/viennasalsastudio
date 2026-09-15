import { MAX_KANTE, zielGroesse } from "@/lib/events/medien";

/**
 * Ein Bild vor dem Hochladen verkleinern und neu zeichnen (PROJ-55).
 *
 * Drei Dinge auf einmal: Ein 6000-Pixel-Foto vom Telefon wird auf eine
 * vernünftige Kantenlänge gebracht, der Upload gelingt auch bei schwachem
 * Netz, und sämtliche Metadaten fallen weg — auch die GPS-Koordinaten, die
 * Handyfotos mitbringen. Sie fallen weg, weil hier nicht die Datei kopiert,
 * sondern das Bild neu gezeichnet wird: Was die Leinwand ausgibt, enthält
 * nichts als Bildpunkte.
 *
 * Läuft nur im Browser. Der Server prüft danach noch einmal Typ und Größe —
 * eine Prüfung, die nur hier steht, lässt sich umgehen.
 */
export type VerkleinertesBild = {
  datei: File;
  breite: number;
  hoehe: number;
};

const AUSGABETYP = "image/webp";
const GUETE = 0.85;

export async function verkleinereBild(datei: File, maxKante = MAX_KANTE): Promise<VerkleinertesBild> {
  const bild = await ladeBild(datei);
  const { breite, hoehe } = zielGroesse(bild.width, bild.height, maxKante);

  const leinwand = document.createElement("canvas");
  leinwand.width = breite;
  leinwand.height = hoehe;

  const stift = leinwand.getContext("2d");
  if (!stift) throw new Error("Bild konnte nicht verarbeitet werden.");
  stift.drawImage(bild, 0, 0, breite, hoehe);
  // Der Bildspeicher des Browsers wird sonst erst beim Aufräumen frei — bei
  // zwanzig Fotos hintereinander ist das zu spät.
  if ("close" in bild) bild.close();

  const rohdaten = await new Promise<Blob | null>((fertig) => leinwand.toBlob(fertig, AUSGABETYP, GUETE));
  if (!rohdaten) throw new Error("Bild konnte nicht verarbeitet werden.");

  return {
    datei: new File([rohdaten], `${dateiname(datei.name)}.webp`, { type: AUSGABETYP }),
    breite,
    hoehe,
  };
}

/**
 * Das Bild in den Speicher holen.
 *
 * `createImageBitmap` kann das direkt; wo es fehlt, tut es das gute alte
 * Bildelement. Safari auf älteren Telefonen gehört zum Publikum.
 */
async function ladeBild(datei: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(datei);
  }

  const adresse = URL.createObjectURL(datei);
  try {
    return await new Promise<HTMLImageElement>((fertig, scheitern) => {
      const bild = new Image();
      bild.onload = () => fertig(bild);
      bild.onerror = () => scheitern(new Error("Bild konnte nicht gelesen werden."));
      bild.src = adresse;
    });
  } finally {
    URL.revokeObjectURL(adresse);
  }
}

/** Aus „IMG_0042.HEIC" wird „img-0042" — lesbar und ohne Überraschungen im Pfad. */
function dateiname(name: string): string {
  const ohneEndung = name.replace(/\.[^.]+$/, "");
  const sauber = ohneEndung
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return sauber || "bild";
}
