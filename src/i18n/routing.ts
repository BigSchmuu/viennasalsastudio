import { defineRouting } from "next-intl/routing";

export const locales = ["de", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "de";

export const routing = defineRouting({
  locales,
  defaultLocale,
  // "as-needed": Deutsch behält seine bisherigen Adressen (/kurse), nur
  // Englisch bekommt ein Präfix (/en/kurse). Ein Präfix auch für Deutsch wäre
  // im Schema sauberer — und würde am ersten Tag jedes gespeicherte Lesezeichen
  // und jeden bereits verschickten Link brechen.
  localePrefix: "as-needed",
  // Die Wahl eines Gastes überdauert den Besuch, ohne dass er ein Konto
  // braucht — sonst sähe genau die Gruppe, die gewonnen werden soll, weiter
  // die falsche Sprache.
  localeCookie: {
    name: "NEXT_LOCALE",
    maxAge: 60 * 60 * 24 * 365,
  },
  // Wer den Browser weder auf Deutsch noch auf Englisch stehen hat, kommt mit
  // Englisch weiter als mit Deutsch.
  localeDetection: true,
});

export function isLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}
