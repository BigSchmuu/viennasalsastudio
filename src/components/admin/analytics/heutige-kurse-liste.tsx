import Link from "next/link";
import { CalendarCheck, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { HeutigerKursEintrag } from "@/lib/dashboard/heutige-kurse-laden";

function uhrzeit(zeit: string | null): string {
  if (!zeit) return "—";
  // „19:00:00" → „19:00". Die Sekunden stehen in der Datenbank, interessieren
  // aber niemanden, der vor der Tür steht.
  return zeit.slice(0, 5);
}

/**
 * „Heute" im Admin-Dashboard (PROJ-75).
 *
 * Der ganze Eintrag ist der Weg zur Anwesenheitsliste — nicht ein kleiner Link
 * am Rand. Wer am Kursabend mit zwanzig Leuten vor sich im Studio steht, trifft
 * eine Zeile, nicht ein Wort.
 *
 * Abgehakt wird dort und nur dort. Ein Häkchen hier wäre ein zweiter Ort für
 * dieselbe Sache — und damit ein zweiter Ort für Fehler.
 */
export function HeutigeKurseListe({ eintraege }: { eintraege: HeutigerKursEintrag[] }) {
  return (
    // Ein benannter Bereich: Das Dashboard besteht aus mehreren Karten, und ein
    // Screenreader kann sie sonst nicht auseinanderhalten — ansprechbar wird sie
    // damit auch für Tests.
    <Card role="region" aria-labelledby="heutige-kurse-titel">
      <CardHeader>
        <CardTitle id="heutige-kurse-titel" className="font-heading text-lg flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          Heute
        </CardTitle>
        <CardDescription>
          Kurse von heute — ein Klick führt in die Anwesenheitsliste zum Einchecken
        </CardDescription>
      </CardHeader>
      <CardContent>
        {eintraege.length === 0 ? (
          // Eine leere Fläche ließe offen, ob heute nichts stattfindet oder die
          // Liste nicht geladen wurde.
          <p className="text-sm text-muted-foreground">Heute findet kein Kurs statt.</p>
        ) : (
          <ul className="divide-y">
            {eintraege.map((eintrag) => (
              <li key={eintrag.kursId}>
                <Link
                  href={`/lehrer/${eintrag.kursId}`}
                  className="flex items-center gap-3 py-2.5 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 -mx-1"
                >
                  <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">
                    {uhrzeit(eintrag.startZeit)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{eintrag.kursName}</span>
                      {eintrag.laeuft && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          läuft jetzt
                        </Badge>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {eintrag.ort ?? "Ohne Ort"} · {eintrag.standText}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
