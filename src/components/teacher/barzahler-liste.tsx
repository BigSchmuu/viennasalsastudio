"use client";

import { useState } from "react";
import { Banknote, Plus, Undo2 } from "lucide-react";
import { erfasseBarzahlung, nimmBarzahlungZurueck } from "@/lib/actions/teacher/barzahlung";
import { legeBarzahlerAn } from "@/lib/actions/teacher/barzahler-anlegen";
import { offeneSumme, zustandText, type BarzahlerZeile } from "@/lib/barzahlungen/offen";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  // PROJ-83: Welche Zeile gerade einen Teilbetrag eingibt, und wie viel.
  const [teilZeile, setTeilZeile] = useState<string | null>(null);
  const [teilBetrag, setTeilBetrag] = useState("");
  // PROJ-82: Wer vor der Lehrkraft steht und sich nie registriert hat.
  const [formOffen, setFormOffen] = useState(false);
  const [neuerName, setNeuerName] = useState("");
  const [neuerBetrag, setNeuerBetrag] = useState("");
  const [legtAn, setLegtAn] = useState(false);

  /**
   * Erfassen -- ohne Betrag den gesamten offenen Rest, mit Betrag genau diesen.
   *
   * Der verbuchte Betrag kommt von der Datenbank zurueck und wird hier in die
   * Zeile gerechnet. Selbst zu rechnen hiesse, die Rundung ein zweites Mal zu
   * machen, und zwei Rundungen driften.
   */
  async function erfassen(zeile: BarzahlerAnsicht, eingabe?: string) {
    setLaufendeId(zeile.aboId);
    setFehler(null);
    try {
      const ergebnis = await erfasseBarzahlung(zeile.aboId, courseId, eingabe);
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      // Die Zeile wandert nicht: Sie bleibt stehen, nur mit neuem Stand. Ein
      // Sprung mitten im Abhaken liesse die Lehrkraft die Zeile verlieren.
      setZeilen((bisher) =>
        bisher.map((z) =>
          z.aboId === zeile.aboId
            ? neuerStand(z, ergebnis.betrag, ergebnis.zahlungId)
            : z
        )
      );
      setTeilZeile(null);
      setTeilBetrag("");
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
      // Hier wird neu geladen und nicht nachgerechnet: Wie viel die
      // zurueckgenommene Zahlung ausmachte, weiss diese Seite nach einem
      // Neuaufbau nicht mehr -- sie kennt nur ihre Kennung. Ein Ruecknehmen ist
      // die Ausnahme, ein falscher Saldo waere schlimmer als ein Neuladen.
      window.location.reload();
    } finally {
      setLaufendeId(null);
    }
  }

  async function eintragen() {
    setLegtAn(true);
    setFehler(null);
    try {
      const ergebnis = await legeBarzahlerAn(courseId, neuerName, neuerBetrag);
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      // Die Seite lädt sich neu: Der neue Kunde gehört in die Anwesenheitsliste
      // und in die Kursgrenze, nicht nur in diese Tabelle. Alles andere hier
      // nachzuziehen hieße, dieselbe Rechnung zweimal zu führen.
      setFormOffen(false);
      setNeuerName("");
      setNeuerBetrag("");
      window.location.reload();
    } finally {
      setLegtAn(false);
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
                    <TableHead>Beitrag</TableHead>
                    <TableHead>Offen</TableHead>
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
                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                          {ohnePreis ? "—" : EUR.format(zeile.betrag!)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums font-medium">
                          {/* Der offene Betrag, nicht der Zyklusbeitrag: Bei
                              einer Restschuld ist er höher, und eingesammelt
                              wird dieser. */}
                          {zeile.offen ? EUR.format(zeile.saldo) : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {zustandText(zeile)}
                        </TableCell>
                        <TableCell className="text-right">
                          {zeile.offen ? (
                            teilZeile === zeile.aboId ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  value={teilBetrag}
                                  onChange={(e) => setTeilBetrag(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") void erfassen(zeile, teilBetrag);
                                  }}
                                  placeholder={String(zeile.saldo)}
                                  inputMode="decimal"
                                  className="h-8 w-20 text-right"
                                  aria-label={`Teilbetrag von ${zeile.kundeName}`}
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  disabled={laufendeId === zeile.aboId}
                                  onClick={() => void erfassen(zeile, teilBetrag)}
                                  aria-label={`Teilbetrag von ${zeile.kundeName} erfassen`}
                                >
                                  {laufendeId === zeile.aboId ? "…" : "OK"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setTeilZeile(null);
                                    setTeilBetrag("");
                                    setFehler(null);
                                  }}
                                >
                                  Abbrechen
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  disabled={ohnePreis || laufendeId === zeile.aboId}
                                  onClick={() => void erfassen(zeile)}
                                  aria-label={`Barzahlung von ${zeile.kundeName} erfassen`}
                                >
                                  {laufendeId === zeile.aboId
                                    ? "…"
                                    : `Bezahlt ${EUR.format(zeile.saldo)}`}
                                </Button>
                                {/* PROJ-83: Wer nicht alles dabei hat. */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={ohnePreis || laufendeId === zeile.aboId}
                                  onClick={() => {
                                    setTeilZeile(zeile.aboId);
                                    setTeilBetrag("");
                                    setFehler(null);
                                  }}
                                  aria-label={`Teilbetrag für ${zeile.kundeName} eingeben`}
                                >
                                  Teilbetrag
                                </Button>
                              </div>
                            )
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

        {/* PROJ-82: Ein Gast, der bar zahlt und sich nie registriert hat, wird
            hier ein echter Kunde — mit Kursplatz und Preis. Er zählt damit
            überall mit: Anwesenheit, Kursgrenze, Auswertung. */}
        {formOffen ? (
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-1">
                <Label htmlFor="barzahler-name">Name</Label>
                <Input
                  id="barzahler-name"
                  value={neuerName}
                  onChange={(e) => setNeuerName(e.target.value)}
                  placeholder="Vor- und Nachname"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="barzahler-betrag">Betrag</Label>
                <Input
                  id="barzahler-betrag"
                  value={neuerBetrag}
                  onChange={(e) => setNeuerBetrag(e.target.value)}
                  placeholder="50"
                  inputMode="decimal"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Wird ein Teilnehmer dieses Kurses mit diesem Beitrag je Zyklus — ohne Konto, ohne
              E-Mail. Die Verwaltung kann später eine Adresse nachtragen.
            </p>
            <div className="flex gap-2">
              <Button size="sm" disabled={legtAn} onClick={() => void eintragen()}>
                {legtAn ? "Wird angelegt…" : "Eintragen"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={legtAn}
                onClick={() => {
                  setFormOffen(false);
                  setFehler(null);
                }}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setFormOffen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Barzahler eintragen
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Der heutige Tag als „JJJJ-MM-TT“ — nur für die Anzeige nach dem Abhaken. */
function heute(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(new Date());
}

/**
 * Die Zeile nach einer erfassten Zahlung.
 *
 * Gerechnet wird auf der Haben-Seite und der Rest daraus — dieselbe Rechnung
 * wie in `barzahlerZeilen`, nur ohne einen Seitenaufbau abzuwarten. Bei einem
 * Teilbetrag bleibt die Zeile offen, und genau das ist der Sinn.
 */
function neuerStand(
  zeile: BarzahlerAnsicht,
  betrag: number,
  zahlungId: string
): BarzahlerAnsicht {
  const haben = Math.round((zeile.haben + betrag) * 100) / 100;
  const saldo = Math.round((zeile.soll - haben) * 100) / 100;
  return {
    ...zeile,
    haben,
    saldo,
    offen: saldo > 0.005,
    teilweise: saldo > 0.005 && haben > 0.005,
    guthaben: saldo < -0.005 ? Math.round(-saldo * 100) / 100 : 0,
    letzteZahlung: heute(),
    heutigeZahlungId: zahlungId,
  };
}
