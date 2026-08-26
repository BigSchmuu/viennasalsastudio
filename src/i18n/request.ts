import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { STUDIO_TIMEZONE } from "@/lib/constants/zeitzone";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    // Ohne Angabe nimmt next-intl die Zeitzone des Servers — bei Vercel UTC.
    // Das Studio steht in Wien.
    timeZone: STUDIO_TIMEZONE,
    // Fehlt eine Übersetzung, erscheint der deutsche Text. Eine leere Stelle
    // oder ein sichtbarer Schlüssel wäre ein Fehler, den der Kunde sieht.
    onError() {},
    getMessageFallback({ key }) {
      const deutsch = key.split(".").reduce<unknown>((wert, teil) => {
        if (wert && typeof wert === "object" && teil in wert) {
          return (wert as Record<string, unknown>)[teil];
        }
        return undefined;
      }, deutscheTexte);
      return typeof deutsch === "string" ? deutsch : key;
    },
  };
});

// Statisch importiert, damit der Rückfall ohne weiteren Ladevorgang greift.
import deutscheTexte from "../../messages/de.json";
