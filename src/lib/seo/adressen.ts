import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { locales, defaultLocale } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo/regeln";

/**
 * Die Adressen einer Seite in allen Sprachen (PROJ-57).
 *
 * Gebaut mit der Adressberechnung der App, nicht von Hand: Deutsch läuft ohne
 * Präfix, Englisch mit, und das selbst zusammenzusetzen ist in PROJ-53 schon
 * einmal schiefgegangen — damals führte ein Link englische Besucher zurück ins
 * Deutsche.
 */
export function sprachAdressen(pfad: string, locale: string): NonNullable<Metadata["alternates"]> {
  const adresse = (sprache: string) => `${SITE_URL}${getPathname({ href: pfad, locale: sprache })}`;

  const languages: Record<string, string> = {};
  for (const sprache of locales) languages[sprache] = adresse(sprache);
  // Wessen Sprache Google nicht zuordnen kann, landet auf Deutsch — das Studio
  // steht in Wien.
  languages["x-default"] = adresse(defaultLocale);

  return { canonical: adresse(locale), languages };
}
