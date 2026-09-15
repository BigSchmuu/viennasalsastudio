import { deflateSync } from "node:zlib";

/**
 * Ein echtes PNG erzeugen — für Tests, die wirklich hochladen (PROJ-55).
 *
 * Ein vorgefertigtes Bild im Projekt abzulegen wäre einfacher, aber die Tests
 * brauchen verschiedene Maße (quer, hoch, sehr groß) und einen eigenen
 * Metadaten-Eintrag, an dem sich zeigen lässt, dass er beim Hochladen
 * verschwindet. Also wird es hier gebaut.
 */

const TABELLE = (() => {
  const tabelle = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let wert = i;
    for (let bit = 0; bit < 8; bit++) {
      wert = wert & 1 ? 0xedb88320 ^ (wert >>> 1) : wert >>> 1;
    }
    tabelle[i] = wert >>> 0;
  }
  return tabelle;
})();

function crc32(daten: Buffer): number {
  let wert = 0xffffffff;
  for (const byte of daten) wert = TABELLE[(wert ^ byte) & 0xff] ^ (wert >>> 8);
  return (wert ^ 0xffffffff) >>> 0;
}

function abschnitt(art: string, inhalt: Buffer): Buffer {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(inhalt.length);
  const kopf = Buffer.concat([Buffer.from(art, "latin1"), inhalt]);
  const pruefsumme = Buffer.alloc(4);
  pruefsumme.writeUInt32BE(crc32(kopf));
  return Buffer.concat([laenge, kopf, pruefsumme]);
}

/**
 * Ein PNG in der gewünschten Größe.
 *
 * `merkmal` landet als Texteintrag im Bild — dieselbe Art von Beiwerk, in der
 * ein Handyfoto seine GPS-Koordinaten mitbringt. Taucht es in der
 * hochgeladenen Datei nicht mehr auf, ist das Bild unterwegs neu gezeichnet
 * worden.
 */
export function erzeugePng(breite: number, hoehe: number, merkmal?: string): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8; // 8 Bit je Farbe
  ihdr[9] = 2; // Farbtyp 2: RGB ohne Transparenz
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Ein sichtbarer Verlauf statt einer leeren Fläche — so sieht man auf einem
  // Bildschirmfoto, ob das richtige Bild geladen wurde.
  const zeilen = Buffer.alloc(hoehe * (1 + breite * 3));
  let stelle = 0;
  for (let y = 0; y < hoehe; y++) {
    zeilen[stelle++] = 0; // kein Zeilenfilter
    for (let x = 0; x < breite; x++) {
      zeilen[stelle++] = Math.floor((255 * x) / Math.max(1, breite - 1));
      zeilen[stelle++] = Math.floor((255 * y) / Math.max(1, hoehe - 1));
      zeilen[stelle++] = 180;
    }
  }

  const teile = [
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    abschnitt("IHDR", ihdr),
  ];
  if (merkmal) {
    teile.push(abschnitt("tEXt", Buffer.from(`Comment\0${merkmal}`, "latin1")));
  }
  teile.push(abschnitt("IDAT", deflateSync(zeilen)), abschnitt("IEND", Buffer.alloc(0)));
  return Buffer.concat(teile);
}
