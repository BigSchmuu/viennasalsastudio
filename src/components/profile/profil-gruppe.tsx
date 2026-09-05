import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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
        <Accordion type="multiple">{children}</Accordion>
      </CardContent>
    </Card>
  );
}

/**
 * Ein Abschnitt darin. Der Aufbau — fette Überschrift, darunter eine
 * Erläuterung in gedämpfter Schrift — stand vorher achtmal wortgleich in der
 * Seite.
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
    <AccordionItem value={wert} className={letzter ? "border-b-0" : undefined}>
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
