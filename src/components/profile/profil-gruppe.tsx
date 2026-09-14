import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ProfilAkkordeon } from "@/components/profile/profil-akkordeon";

/**
 * Eine Gruppe verwandter Profil-Abschnitte.
 *
 * Vorher standen alle acht Abschnitte als eine Liste gleichrangig
 * untereinander — Zahlungsweise neben Warteliste neben Benachrichtigungen.
 * Wer eine Rechnung suchte, musste die ganze Liste lesen.
 *
 * Seit dem Dashboard ist das Profil die Verwaltungsseite, nicht mehr die
 * tägliche Anlaufstelle. Sie darf nüchtern sein — aber auffindbar.
 */
export function ProfilGruppe({
  titel,
  hinweis,
  children,
}: {
  titel: string;
  hinweis: string;
  children: ReactNode;
}) {
  return (
    <Card className="rounded-card shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-lg tracking-[-0.5px]">{titel}</CardTitle>
        <CardDescription>{hinweis}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ProfilAkkordeon>{children}</ProfilAkkordeon>
      </CardContent>
    </Card>
  );
}

/**
 * Ein Abschnitt darin. Der Aufbau — fette Überschrift, darunter eine
 * Erläuterung in gedämpfter Schrift — stand vorher achtmal wortgleich in der
 * Seite.
 *
 * `wert` ist zugleich die Kennung für Links wie `/profil#tickets`: Der Browser
 * springt zum Abschnitt, `ProfilAkkordeon` klappt ihn auf. Der Abstand oben
 * hält die Überschrift unter der fixierten Kopfzeile sichtbar.
 */
export function ProfilAbschnitt({
  wert,
  titel,
  hinweis,
  letzter = false,
  children,
}: {
  wert: string;
  titel: string;
  hinweis: string;
  letzter?: boolean;
  children: ReactNode;
}) {
  return (
    <AccordionItem
      value={wert}
      id={wert}
      className={letzter ? "scroll-mt-24 border-b-0" : "scroll-mt-24"}
    >
      <AccordionTrigger>
        <div className="text-left">
          <p className="font-heading font-semibold">{titel}</p>
          <p className="text-sm font-normal text-muted-foreground">{hinweis}</p>
        </div>
      </AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}
