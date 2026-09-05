import type { ReactNode } from "react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Gemeinsamer Rahmen für Anmelden, Registrieren und die beiden
 * Passwort-Seiten.
 *
 * Vorher stand auf jeder dieser Seiten dieselbe Karte auf grauem Grund — der
 * erste Bildschirm, den ein Interessent nach dem Klick auf „Login" sieht, und
 * der einzige im Kundenbereich ohne jede Bildsprache.
 *
 * Nebenbei behoben: Die vier Seiten setzten `min-h-screen` *innerhalb* eines
 * Layouts, das bereits Kopf- und Fußzeile hat. Die Karte wurde damit in eine
 * volle Bildschirmhöhe unterhalb des Kopfes zentriert, die Fußzeile rutschte
 * hinaus und es entstand Scrollen ohne Inhalt.
 *
 * Das Bild erscheint erst ab `md`. Am Telefon gehört die Fläche dem Formular;
 * ein Foto darüber schöbe die Eingabefelder unter die Tastatur.
 */
export async function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const t = await getTranslations("home");

  // Auf dem Desktop die verfügbare Höhe füllen und darin mittig sitzen: sonst
  // klebt der Block oben und darunter klafft bis zur Fußzeile eine leere
  // Fläche. 10rem entspricht Kopf- plus Fußzeile.
  //
  // Am Telefon *nicht*: dort ist die Fußzeile höher, und die Mindesthöhe plus
  // Innenabstand erzwang Scrollen auf einer Seite, die auf den Schirm passt.
  return (
    <div className="mx-auto grid w-full max-w-5xl content-center items-center gap-10 px-4 py-10 md:min-h-[calc(100vh-10rem)] md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] md:py-16">
      <Card className="rounded-card border-border/60 bg-card/80 shadow-soft backdrop-blur">
        <CardHeader>
          <CardTitle className="font-heading text-2xl tracking-[-0.5px]">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>

      <div className="relative hidden min-h-[28rem] overflow-hidden rounded-card shadow-soft md:block">
        <Image
          src="/media/hero-piran.webp"
          alt=""
          fill
          sizes="(min-width: 768px) 40vw, 0px"
          className="object-cover"
        />
        {/* Von unten abdunkeln, damit die Schrift auf jedem Bildausschnitt
            lesbar bleibt — nicht als Effekt, sondern als Kontrastgrundlage. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
        <div className="absolute inset-x-7 bottom-7 text-white">
          <p className="nav-label text-white/85">{t("heroKicker")}</p>
          <p className="mt-2 max-w-sm font-heading text-xl font-bold leading-snug tracking-[-0.5px]">
            {t("heroLead")}
          </p>
        </div>
      </div>
    </div>
  );
}
