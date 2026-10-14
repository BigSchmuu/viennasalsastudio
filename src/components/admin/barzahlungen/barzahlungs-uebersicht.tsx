"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { erfasseBarzahlung, nimmBarzahlungZurueck } from "@/lib/actions/teacher/barzahlung";
import { offeneSumme, zustandText, type BarzahlerZeile } from "@/lib/barzahlungen/offen";

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

export type EingesammeltZeile = {
  id: string;
  kundeId: string;
  kundeName: string;
  tag: string;
  betrag: number;
  kassiertVon: string;
};

function datum(wert: string): string {
  return new Date(`${wert}T00:00:00`).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Barzahlungen in der Verwaltung (PROJ-81, Erfassen ab PROJ-83).
 *
 * Zwei Listen, weil zwei Fragen: Wer ist offen — dort ist etwas zu tun. Und was
 * ist hereingekommen — dort ist nichts zu tun, aber es muss nachvollziehbar
 * sein, von wem.
 *
 * Erfasst wird seit PROJ-83 auch hier. Vorher gab es den Knopf nur auf der
 * Kursseite, und daraus folgten zwei Fälle ohne Ausweg: eine Flatrate, die
 * gerade in keinem Kurs hängt, und Geld, das im Büro über den Tisch geht.
 *
 * Nach jedem Schreiben wird die Seite neu geladen statt nachgerechnet: Am
 * Schreibtisch kostet das nichts, und die Zahl kommt dann aus derselben
 * Rechnung wie vorher.
 */
export function BarzahlungsUebersicht({
  zeilen,
  eingesammelt,
  zeitraumText,
}: {
  zeilen: BarzahlerZeile[];
  eingesammelt: EingesammeltZeile[];
  zeitraumText: string;
}) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [laufendeId, setLaufendeId] = useState<string | null>(null);
  const [teilZeile, setTeilZeile] = useState<string | null>(null);
  const [teilBetrag, setTeilBetrag] = useState("");

  const offene = zeilen.filter((z) => z.offen);
  const summeOffen = offeneSumme(zeilen);
  const summeEingesammelt = eingesammelt.reduce((s, z) => s + z.betrag, 0);

  async function erfassen(zeile: BarzahlerZeile, eingabe?: string) {
    setLaufendeId(zeile.aboId);
    setFehler(null);
    try {
      // Ohne Kurs: Die Verwaltung erfasst am Abo, nicht an einem Kursabend.
      const ergebnis = await erfasseBarzahlung(zeile.aboId, "", eingabe);
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      setTeilZeile(null);
      setTeilBetrag("");
      router.refresh();
    } finally {
      setLaufendeId(null);
    }
  }

  async function zurueck(zahlung: EingesammeltZeile) {
    setLaufendeId(zahlung.id);
    setFehler(null);
    try {
      const ergebnis = await nimmBarzahlungZurueck(zahlung.id, "");
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      router.refresh();
    } finally {
      setLaufendeId(null);
    }
  }

  return (
    <div className="space-y-6">
      {fehler && (
        <Alert variant="destructive">
          <AlertDescription>{fehler}</AlertDescription>
        </Alert>
      )}

      <Card role="region" aria-labelledby="barzahlungen-offen">
        <CardHeader>
          <CardTitle id="barzahlungen-offen" className="font-heading text-lg">
            Offen
            <Badge variant="outline" className="ml-2 align-middle">
              {offene.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Barzahler mit offenem Betrag — über alle Kurse, ohne Zeitraumgrenze. Ein Rest aus einem
            früheren Zyklus ist mitgezählt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {offene.length === 0 ? (
            <p className="text-sm text-muted-foreground">Derzeit ist keine Barzahlung offen.</p>
          ) : (
            <>
              <p className="mb-3 text-sm">
                <span className="font-medium">Summe offen:</span>{" "}
                <span className="tabular-nums">{EUR.format(summeOffen)}</span>
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Abo</TableHead>
                      <TableHead>Offen</TableHead>
                      <TableHead>Zustand</TableHead>
                      <TableHead className="text-right">Erfassen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {offene.map((z) => {
                      const ohnePreis = z.betrag === null || z.betrag <= 0;
                      return (
                        <TableRow key={z.aboId}>
                          <TableCell className="font-medium">
                            <Link href={`/admin/kunden/${z.kundeId}`} className="hover:underline">
                              {z.kundeName}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {/* Ein Blockelement, kein Absatz-Element: Das Badge ist
                                ein div, und in einem span zerlegt der Browser den
                                Baum — der Sentry-Fehler vom 2026-09-27. */}
                            <div className="flex flex-wrap items-center gap-2">
                              {z.aboName}
                              {z.istFlatrate && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  Flatrate
                                </Badge>
                              )}
                              {/* PROJ-83: Kein neues Soll mehr — gekündigt oder
                                  inzwischen mit Mandat. Der Rest bleibt offen. */}
                              {z.beendet && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  Restschuld
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums font-medium">
                            {EUR.format(z.saldo)}
                          </TableCell>
                          {/* „Kein Preis am Abo" steht hier als Zustand: Die
                              Verwaltung ist die Stelle, die das beheben kann. */}
                          <TableCell className="text-sm text-muted-foreground">
                            {zustandText(z)}
                          </TableCell>
                          <TableCell className="text-right">
                            {teilZeile === z.aboId ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  value={teilBetrag}
                                  onChange={(e) => setTeilBetrag(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") void erfassen(z, teilBetrag);
                                  }}
                                  placeholder={String(z.saldo)}
                                  inputMode="decimal"
                                  className="h-8 w-24 text-right"
                                  aria-label={`Teilbetrag von ${z.kundeName}`}
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  disabled={laufendeId === z.aboId}
                                  onClick={() => void erfassen(z, teilBetrag)}
                                  aria-label={`Teilbetrag von ${z.kundeName} erfassen`}
                                >
                                  {laufendeId === z.aboId ? "…" : "OK"}
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
                                  disabled={ohnePreis || laufendeId === z.aboId}
                                  onClick={() => void erfassen(z)}
                                  aria-label={`Barzahlung von ${z.kundeName} erfassen`}
                                >
                                  {laufendeId === z.aboId ? "…" : `Bezahlt ${EUR.format(z.saldo)}`}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={ohnePreis || laufendeId === z.aboId}
                                  onClick={() => {
                                    setTeilZeile(z.aboId);
                                    setTeilBetrag("");
                                    setFehler(null);
                                  }}
                                  aria-label={`Teilbetrag für ${z.kundeName} eingeben`}
                                >
                                  Teilbetrag
                                </Button>
                              </div>
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

      <Card role="region" aria-labelledby="barzahlungen-eingesammelt">
        <CardHeader>
          <CardTitle id="barzahlungen-eingesammelt" className="font-heading text-lg">
            Eingesammelt
            <Badge variant="outline" className="ml-2 align-middle">
              {eingesammelt.length}
            </Badge>
          </CardTitle>
          <CardDescription>{zeitraumText}</CardDescription>
        </CardHeader>
        <CardContent>
          {eingesammelt.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              In diesem Zeitraum wurde keine Barzahlung erfasst.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm">
                <span className="font-medium">Summe im Zeitraum:</span>{" "}
                <span className="tabular-nums">{EUR.format(summeEingesammelt)}</span>
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kunde</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Betrag</TableHead>
                      <TableHead>Kassiert von</TableHead>
                      <TableHead className="text-right">Korrigieren</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eingesammelt.map((z) => (
                      <TableRow key={z.id}>
                        <TableCell className="font-medium">
                          <Link href={`/admin/kunden/${z.kundeId}`} className="hover:underline">
                            {z.kundeName}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {datum(z.tag)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {EUR.format(z.betrag)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{z.kassiertVon}</TableCell>
                        <TableCell className="text-right">
                          {/* Die Verwaltung darf jede Zahlung zurücknehmen, nicht
                              nur die heutige — die Lehrkraft nur die von heute.
                              Das prüft die Datenbank, nicht diese Seite. */}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={laufendeId === z.id}
                            onClick={() => void zurueck(z)}
                            aria-label={`Zahlung von ${z.kundeName} am ${datum(z.tag)} zurücknehmen`}
                          >
                            <Undo2 className="mr-1 h-3.5 w-3.5" />
                            {laufendeId === z.id ? "…" : "Zurücknehmen"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
