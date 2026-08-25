"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { locales, defaultLocale, type Locale } from "@/i18n/routing";
import { rememberLanguage } from "@/lib/actions/language";
import { cn } from "@/lib/utils";

const labels: Record<Locale, string> = { de: "DE", en: "EN" };
const titles: Record<Locale, string> = { de: "Auf Deutsch anzeigen", en: "Show in English" };

/**
 * Sprachumschalter (PROJ-43).
 *
 * Wechselt auf dieselbe Seite in der anderen Sprache — `/kurse` wird zu
 * `/en/kurse`, nicht zur Startseite. Für eingeloggte Kunden wandert die Wahl
 * zusätzlich ans Konto, damit auch E-Mails in ihrer Sprache ankommen.
 *
 * Bewusst ein echter Seitenwechsel statt einer weichen Navigation: Das
 * `lang`-Attribut sitzt im äußersten Rahmen, der bei einer weichen Navigation
 * nicht neu gerendert wird — die Seite behielte `lang="de"`, während sie
 * englisch dasteht. Screenreader und die Übersetzungsfunktion des Browsers
 * würden dann die falsche Sprache annehmen. Bei einem Sprachwechsel ändert
 * sich ohnehin die ganze Seite; ein Neuaufbau ist hier nichts, was auffällt.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const aktiv = useLocale() as Locale;
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  async function wechseln(ziel: Locale) {
    if (ziel === aktiv || pending) return;
    setPending(true);
    // Erst merken, dann wechseln: ein Seitenwechsel bricht eine noch laufende
    // Server-Aktion ab, und die Sprache wäre nicht am Konto gelandet.
    await rememberLanguage(ziel);
    const praefix = ziel === defaultLocale ? "" : `/${ziel}`;
    // assign() statt einer Zuweisung an location.href: der React-Compiler
    // beanstandet das Beschreiben eines Werts von ausserhalb der Komponente.
    window.location.assign(`${praefix}${pathname}${window.location.search}`);
  }

  return (
    <div className={cn("flex items-center gap-1", className)} role="group" aria-label="Sprache">
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => void wechseln(locale)}
          disabled={pending}
          aria-current={locale === aktiv ? "true" : undefined}
          title={titles[locale]}
          className={cn(
            "rounded px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-50",
            locale === aktiv
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {labels[locale]}
        </button>
      ))}
    </div>
  );
}
