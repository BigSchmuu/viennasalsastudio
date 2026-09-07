/** Die eigene Adresse, unter der die App erreichbar sein soll. */
export const ZIEL_HOST = "app.viennasalsastudio.at";

/**
 * Die festen Vercel-Adressen der Produktion.
 *
 * Bewusst eine Aufzählung und kein Muster auf `.vercel.app`: Jede
 * Vorschau-Bereitstellung liegt ebenfalls dort, und würde sie mitumgeleitet,
 * liesse sich nichts mehr vor dem Ausrollen ansehen — man landete jedes Mal
 * auf der Produktion. Kommt später eine Adresse dazu, leitet sie eben nicht
 * um; das ist der harmlosere der beiden Fehler.
 */
export const ALTE_HOSTS = [
  "viennasalsastudio.vercel.app",
  "viennasalsastudio-vienna-salsa-studio.vercel.app",
  "viennasalsastudio-git-main-vienna-salsa-studio.vercel.app",
];

/**
 * Das Umleitungsziel für eine Anfrage — oder `null`, wenn sie bleiben darf.
 *
 * Pfad und Abfrage bleiben erhalten: Auf bereits verschickten Tickets stehen
 * QR-Codes mit der alten Adresse, und die sollen weiterhin an der richtigen
 * Stelle ankommen statt auf der Startseite.
 */
export function umleitungsZiel(url: URL, host: string | null | undefined): URL | null {
  if (!host) return null;

  // Der Host-Kopf kann einen Port tragen; für den Vergleich zählt der Name.
  const name = host.toLowerCase().split(":")[0];
  if (!ALTE_HOSTS.includes(name)) return null;

  const ziel = new URL(url.toString());
  ziel.protocol = "https:";
  ziel.host = ZIEL_HOST;
  ziel.port = "";
  return ziel;
}
