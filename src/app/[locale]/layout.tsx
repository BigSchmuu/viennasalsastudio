import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

/**
 * Sprachebene des Kundenbereichs (PROJ-43).
 *
 * Hält die Sprache aus der Adresse fest, damit alle Seiten darunter dieselbe
 * verwenden. Der Provider für die Client-Komponenten sitzt eine Ebene höher im
 * äußersten Rahmen — dort erreicht er auch die Mitarbeiterbereiche, die
 * dieselbe Kopf- und Fußzeile benutzen.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  return children;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
