import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/regeln";

/**
 * robots.txt (PROJ-57).
 *
 * Hier stehen nur die Bereiche hinter der Anmeldung. Was aus dem Index
 * bleiben soll, aber öffentlich ist — Startseite, Kurse, Stundenplan —, wird
 * **nicht** hier gesperrt, sondern sagt auf der Seite selbst „nicht
 * aufnehmen". Der Unterschied ist wichtig: Eine gesperrte Seite darf Google
 * gar nicht erst ansehen und bekommt das „nicht aufnehmen" nie zu Gesicht —
 * sie kann dann trotzdem im Index landen, nur ohne Inhalt.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/admin", "/checkin", "/lehrer", "/mein-bereich", "/profil", "/rechnungen", "/api", "/auth"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
