import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

/**
 * Sprachebene des Kundenbereichs (PROJ-43).
 *
 * Kopf- und Fußzeile sitzen eine Ebene tiefer im (site)-Rahmen. Diese Ebene
 * hält die Sprache aus der Adresse fest und reicht sie an die
 * Client-Komponenten weiter — ohne den Provider fänden diese keine Sprache und
 * die Seite bliebe leer.
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
  return <NextIntlClientProvider>{children}</NextIntlClientProvider>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}
