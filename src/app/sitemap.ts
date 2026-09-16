import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPathname } from "@/i18n/navigation";
import { locales, defaultLocale } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo/regeln";
import { SERIE_AKTIV } from "@/lib/events/serie";

/**
 * Die Sitemap (PROJ-57).
 *
 * Darin steht, was gefunden werden soll: kommende Einzelevents und laufende
 * Serien. Serientermine bleiben draußen — sonst stünden binnen eines Jahres
 * fünfzig fast gleiche Seiten derselben Party im Index, von denen achtundvierzig
 * nicht mehr existieren.
 *
 * Gerechnet wird bei jedem Abruf. Google holt die Datei selten, die Abfrage ist
 * klein, und eine Sitemap, die ein abgesagtes Event noch nennt, ist schlimmer
 * als eine, die eine halbe Sekunde braucht.
 */
export const dynamic = "force-dynamic";

/** Eine Adresse mit ihren Sprachfassungen, wie die Sitemap sie erwartet. */
function eintrag(pfad: string, geaendert?: string): MetadataRoute.Sitemap[number] {
  const adresse = (sprache: string) => `${SITE_URL}${getPathname({ href: pfad, locale: sprache })}`;

  const languages: Record<string, string> = {};
  for (const sprache of locales) languages[sprache] = adresse(sprache);
  // Dieselbe Vorgabe wie in den Seitenangaben: Wessen Sprache Google nicht
  // zuordnen kann, landet auf Deutsch.
  languages["x-default"] = adresse(defaultLocale);

  return {
    url: adresse(defaultLocale),
    lastModified: geaendert ? new Date(geaendert) : undefined,
    alternates: { languages },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const jetzt = new Date();
  // Die Datenbank wählt grob vor; die genaue Grenze zieht die Abfrage unten.
  const vorEinemTag = new Date(jetzt.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [eventsRes, serienRes] = await Promise.all([
    supabase
      .from("events")
      .select("slug, starts_at, ends_at")
      .eq("status", "geplant")
      // Serientermine gehören nicht hinein — die Serienseite vertritt sie.
      .is("series_id", null)
      .or(`ends_at.gt.${jetzt.toISOString()},starts_at.gt.${vorEinemTag}`)
      .order("starts_at", { ascending: true }),
    supabase.from("event_series").select("slug").eq("status", SERIE_AKTIV).order("weekday", { ascending: true }),
  ]);

  // Kein Auffangen: Eine leere Sitemap wäre für Google eine Aussage — es
  // hielte die bekannten Adressen für erledigt. Ein Fehler ist keine Aussage,
  // und Google kommt wieder.
  if (eventsRes.error) throw new Error(`Sitemap: Events nicht lesbar — ${eventsRes.error.message}`);
  if (serienRes.error) throw new Error(`Sitemap: Serien nicht lesbar — ${serienRes.error.message}`);

  const events = (eventsRes.data ?? []).filter((event) => {
    const ende = event.ends_at ? Date.parse(event.ends_at) : Date.parse(event.starts_at) + 24 * 60 * 60 * 1000;
    return ende > jetzt.getTime();
  });

  return [
    ...events.map((event) => eintrag(`/events/${event.slug}`, event.starts_at)),
    ...(serienRes.data ?? []).map((serie) => eintrag(`/events/${serie.slug}`)),
  ];
}
