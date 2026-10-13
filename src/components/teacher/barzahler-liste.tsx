"use client";

import { useState } from "react";
import { Banknote, Undo2 } from "lucide-react";
import { erfasseBarzahlung, nimmBarzahlungZurueck } from "@/lib/actions/teacher/barzahlung";
import { offeneSumme, zustandText, type BarzahlerZeile } from "@/lib/barzahlungen/offen";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

export type BarzahlerAnsicht = BarzahlerZeile & {
  /** Die Kennung der heutigen Zahlung — nur dann lässt sie sich zurücknehmen. */
  heutigeZahlungId: string | null;
};

/**
 * Die Barzahler eines Kurses (PROJ-81).
 *
 * Steht bei der Anwesenheitsliste, weil die Lehrkraft am Kursabend genau diese
 * Seite offen hat. Eine zweite Stelle wäre eine, die man vergisst.
 *
 * Offene zuerst, mit Betrag — die Lehrkraft sammelt Geld ein und muss wissen,
 * wie viel. Bezahlte bleiben stehen, damit niemand zweimal gefragt wird.
 */
export function BarzahlerListe({
  courseId,
  zeilen: anfangsZeilen,
}: {
  courseId: string;
  zeilen: BarzahlerAnsicht[];
}) {
  const [zeilen, setZeilen] = useState(anfangsZeilen);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laufendeId, setLaufendeId] = useState<string | null>(null);

  async function abhaken(zeile: BarzahlerAnsicht) {
    setLaufendeId(zeile.aboId);
    setFehler(null);
    try {
      const ergebnis = await erfasseBarzahlung(zeile.aboId, courseId);
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      // Die Zeile wandert nicht: Sie bleibt stehen, nur als bezahlt. Ein
      // Sprung mitten im Abhaken ließe die Lehrkraft die Zeile verlieren.
      setZeilen((bisher) =>
        bisher.map((z) =>
          z.aboId === zeile.aboId
            ? { ...z, offen: false, letzteBarzahlung: heute(), heutigeZahlungId: ergebnis.zahlungId }
            : z
        )
      );
    } finally {
      setLaufendeId(null);
    }
  }

  async function zurueck(zeile: BarzahlerAnsicht) {
    if (!zeile.heutigeZahlungId) return;
    setLaufendeId(zeile.aboId);
    setFehler(null);
    try {
      const ergebnis = await nimmBarzahlungZurueck(zeile.heutigeZahlungId, courseId);
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      setZeilen((bisher) =>
        bisher.map((z) =>
          z.aboId === zeile.aboId
            ? { ...z, offen: true, letzteBarzahlung: null, heutigeZahlungId: null }
            : z
        )
      );
    } finally {
      setLaufendeId(null);
    }
  }

  const summe = offeneSumme(zeilen);

  return (
    <Card role="region" aria-labelledby="barzahler-titel">
      <CardHeader>
        <CardTitle id="barzahler-titel" className="font-heading text-lg flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" />
          Barzahler
        </CardTitle>
        <CardDescription>
          Teilnehmer ohne SEPA-Mandat. Offene zuerst — abgehakt wird hier, sobald das Geld da ist.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {fehler && (
          <Alert variant="destructive">
            <AlertDescription>{fehler}</AlertDescription>
          </Alert>
        )}

        {zeilen.length === 0 ? (
          // Eine leere Fläche ließe offen, ob niemand bar zahlt oder die Liste
          // nicht geladen wurde.
          <p className="text-sm text-muted-foreground">
            In diesem Kurs zahlt niemand bar — alle haben ein SEPA-Mandat.
          </p>
        ) : (
          <>
            {summe > 0 && (
              <p className="text-sm">
                <span className="font-medium">Heute einzusammeln:</span>{" "}
                <span className="tabular-nums">{EUR.format(summe)}</span>
              </p>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[160px]">Name</TableHead>
                    <TableHead>Betrag</TableHead>
                    <TableHead>Zustand</TableHead>
                    <TableHead className="text-right">Kassiert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zeilen.map((zeile) => {
                    const ohnePreis = zeile.betrag === null || zeile.betrag <= 0;
                    return (
                      <TableRow key={zeile.aboId}>
                        <TableCell className="font-medium">
                          <div className="flex flex-wrap items-center gap-2">
                            {zeile.kundeName}
                            {/* Eine Flatrate gilt für alle Kurse — der Betrag
                                ist nicht der dieses Kurses. */}
                            {zeile.istFlatrate && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                Flatrate
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {ohnePreis ? "—" : EUR.format(zeile.betrag!)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {zustandText(zeile)}
                        </TableCell>
                        <TableCell className="text-right">
                          {zeile.offen ? (
                            <Button
                              size="sm"
                              disabled={ohnePreis || laufendeId === zeile.aboId}
                              onClick={() => void abhaken(zeile)}
                              aria-label={`Barzahlung von ${zeile.kundeName} erfassen`}
                            >
                              {laufendeId === zeile.aboId ? "…" : "Bezahlt"}
                            </Button>
                          ) : zeile.heutigeZahlungId ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={laufendeId === zeile.aboId}
                              onClick={() => void zurueck(zeile)}
                              aria-label={`Barzahlung von ${zeile.kundeName} zurücknehmen`}
                            >
                              <Undo2 className="mr-1 h-3.5 w-3.5" />
                              Zurücknehmen
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">✓</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Der heutige Tag als „JJJJ-MM-TT" — nur für die Anzeige nach dem Abhaken. */
function heute(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(new Date());
}
