import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vienna Salsa Studio",
    short_name: "Vienna Salsa Studio",
    description: "Kurse buchen, Abo verwalten und Beispiel-Videos ansehen.",
    start_url: "/",
    // Ausdruecklich gesetzt statt aus start_url abgeleitet: Der Geltungsbereich
    // entscheidet, welche Adressen die App auf dem Home-Bildschirm noch selbst
    // oeffnet. Alles darunter bleibt ohne Adressleiste — auch /lehrer und
    // /admin, die ausserhalb der Sprachebene liegen.
    scope: "/",
    id: "/",
    display: "standalone",
    background_color: "#0b0b0b",
    theme_color: "#0b0b0b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
