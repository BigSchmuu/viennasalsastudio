import type { Metadata, Viewport } from "next";
import { getLocale } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { Inter, Raleway } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SentryInit } from "@/components/monitoring/sentry-init";
import "./globals.css";
import { NICHT_INDEXIEREN, SITE_URL } from "@/lib/seo/regeln";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const raleway = Raleway({ subsets: ["latin"], variable: "--font-raleway" });

export const metadata: Metadata = {
  // PROJ-57: Die Grundadresse, damit aus relativen Pfaden in den Angaben
  // vollständige Adressen werden.
  metadataBase: new URL(SITE_URL),
  // PROJ-57: „Nicht aufnehmen" gilt für die ganze App. Nur Eventseiten und
  // Serienseiten widersprechen ausdrücklich. Andersherum — jede Seite einzeln
  // ausschließen — wäre eine Liste, die beim nächsten neuen Bereich jemand zu
  // ergänzen vergisst, und dann steht „Mein Bereich" bei Google.
  robots: NICHT_INDEXIEREN,
  title: "Vienna Salsa Studio",
  description: "Kurse buchen, Abo verwalten und Beispiel-Videos ansehen.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Vienna Salsa Studio",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0b",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // PROJ-43: Die Sprache steht in der Adresse und wird von der Middleware
  // gesetzt. Sie hier auszulesen hält das lang-Attribut ehrlich — ein fest
  // eingetragenes "de" würde Screenreadern und Übersetzern die falsche Sprache
  // ansagen, sobald ein Kunde auf Englisch liest.
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body className={`${inter.variable} ${raleway.variable} font-sans antialiased`}>
        {/* Written by the server, read by SentryInit — see its comment for why. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__SENTRY_DSN__=${JSON.stringify(process.env.NEXT_PUBLIC_SENTRY_DSN ?? "")};`,
          }}
        />
        <SentryInit />
        {/* Ganz aussen, damit auch die Mitarbeiterbereiche Sprachkontext
            haben: Kopf- und Fusszeile sind dort dieselben Komponenten, und
            ihre Links muessen wissen, ob ein Praefix gehoert. Fuer /admin,
            /lehrer und /checkin liefert getLocale() Deutsch — sie bleiben
            damit unveraendert. */}
        <NextIntlClientProvider>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
