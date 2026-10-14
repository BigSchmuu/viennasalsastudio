"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Undo2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import {
  aendereEintrag,
  entferneEintrag,
  erfasseBarzahlung,
  legeEintragAn,
  nimmBarzahlungZurueck,
  schliesseZyklusAb,
} from "@/lib/actions/teacher/barzahlung";
import { offeneSumme, zustandText, type EintragsZeile } from "@/lib/barzahlungen/offen";

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

export type EingesammeltZeile = {
  id: string;
  kundeId: string;
  kundeName: string;
  tag: string;
  betrag: number;
  kassiertVon: string;
};

/** Ein Abo, das noch nicht auf der Liste steht. */
export type AboWahl = {
  aboId: string;
  kundeName: string;
  aboName: string | null;
  istFlatrate: boolean;
  preis: number | null;
  hatMandat: boolean;
};

function datum(wert: string): string {
  return new Date(`${wert}T00:00:00`).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Barzahlungen in der Verwaltung (PROJ-84).
 *
 * Zwei Listen, weil zwei Fragen: Wer steht auf der Liste des laufenden Zyklus —
 * dort ist etwas zu tun. Und was ist hereingekommen — dort ist nichts zu tun,
 * aber es muss nachvollziehbar sein, von wem.
 *
 * Nach jedem Schreiben wird neu geladen statt nachgerechnet: Am Schreibtisch
 * kostet das nichts, und die Zahlen kommen dann aus derselben Rechnung wie
 * vorher.
 */
export function BarzahlungsUebersicht({
  zeilen,
  aboWahl,
  eingesammelt,
  zeitraumText,
}: {
  zeilen: EintragsZeile[];
  aboWahl: AboWahl[];
  eingesammelt: EingesammeltZeile[];
  zeitraumText: string;
}) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laufendeId, setLaufendeId] = useState<string | null>(null);
  const [teilZeile, setTeilZeile] = useState<string | null>(null);
  const [teilBetrag, setTeilBetrag] = useState("");
  const [aendereZeile, setAendereZeile] = useState<string | null>(null);
  const [neuerBetrag, setNeuerBetrag] = useState("");

  const [formOffen, setFormOffen] = useState(false);
  const [gewaehltesAbo, setGewaehltesAbo] = useState("");
  const [eintragsBetrag, setEintragsBetrag] = useState("");
  const [tutGerade, setTutGerade] = useState(false);
  const [fragtAb, setFragtAb] = useState(false);

  const offene = zeilen.filter((z) => z.istOffen);
  const summeOffen = offeneSumme(zeilen);
  const summeEingesammelt = eingesammelt.reduce((s, z) => s + z.betrag, 0);
  const gewaehlt = aboWahl.find((a) => a.aboId === gewaehltesAbo);

  async function tun(id: string, aufgabe: () => Promise<{ error: string } | unknown>) {
    setLaufendeId(id);
    setFehler(null);
    setHinweis(null);
    try {
      const ergebnis = await aufgabe();
      if (ergebnis && typeof ergebnis === "object" && "error" in ergebnis) {
        setFehler((ergebnis as { error: string }).error);
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setLaufendeId(null);
    }
  }

  async function eintragen() {
    if (!gewaehlt) {
      setFehler("Bitte ein Abo auswählen.");
      return;
    }
    setTutGerade(true);
    setFehler(null);
    try {
      const ergebnis = await legeEintragAn(gewaehlt.aboId, eintragsBetrag, "");
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      setFormOffen(false);
      setGewaehltesAbo("");
      setEintragsBetrag("");
      router.refresh();
    } finally {
      setTutGerade(false);
    }
  }

  async function abschliessen() {
    setTutGerade(true);
    setFehler(null);
    try {
      const ergebnis = await schliesseZyklusAb();
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      setFragtAb(false);
      setHinweis(
        `${ergebnis.entfernt} ${ergebnis.entfernt === 1 ? "Eintrag" : "Einträge"} entfernt. Die erfassten Zahlungen stehen weiterhin unter „Eingesammelt“.`
      );
      router.refresh();
    } finally {
      setTutGerade(false);
    }
  }

  return (
    <div className="space-y-6">
      {fehler && (
        <Alert variant="destructive">
          <AlertDescription>{fehler}</AlertDescription>
        </Alert>
      )}
      {hinweis && (
        <Alert>
          <AlertDescription>{hinweis}</AlertDescription>
        </Alert>
      )}

      <Card role="region" aria-labelledby="barzahlungen-liste">
        <CardHeader>
          <CardTitle id="barzahlungen-liste" className="font-heading text-lg">
            Liste
            <Badge variant="outline" className="ml-2 align-middle">
              {zeilen.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Der laufende Zahlungszyklus. {offene.length} offen, Summe{" "}
            <span className="tabular-nums">{EUR.format(summeOffen)}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {zeilen.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Auf der Liste steht niemand. Trage ein, wer in diesem Zyklus bar zahlt.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Abo</TableHead>
                    <TableHead>Betrag</TableHead>
                    <TableHead>Offen</TableHead>
                    <TableHead>Zustand</TableHead>
                    <TableHead className="text-right">Erfassen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zeilen.map((z) => (
                    <TableRow key={z.eintragId}>
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
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {aendereZeile === z.eintragId ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={neuerBetrag}
                              onChange={(e) => setNeuerBetrag(e.target.value)}
                              inputMode="decimal"
                              className="h-8 w-24 text-right"
                              aria-label={`Betrag von ${z.kundeName}`}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              disabled={laufendeId === z.eintragId}
                              onClick={() =>
                                void tun(z.eintragId, () =>
                                  aendereEintrag(z.eintragId, neuerBetrag, "")
                                ).then((gut) => {
                                  if (gut) {
                                    setAendereZeile(null);
                                    setNeuerBetrag("");
                                  }
                                })
                              }
                              aria-label={`Betrag von ${z.kundeName} speichern`}
                            >
                              OK
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="underline-offset-2 hover:underline"
                            onClick={() => {
                              setAendereZeile(z.eintragId);
                              setNeuerBetrag(String(z.betrag));
                              setFehler(null);
                            }}
                            aria-label={`Betrag von ${z.kundeName} ändern`}
                          >
                            {EUR.format(z.betrag)}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums font-medium">
                        {z.istOffen ? EUR.format(z.offen) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {zustandText(z)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {z.istOffen &&
                            (teilZeile === z.eintragId ? (
                              <>
                                <Input
                                  value={teilBetrag}
                                  onChange={(e) => setTeilBetrag(e.target.value)}
                                  placeholder={String(z.offen)}
                                  inputMode="decimal"
                                  className="h-8 w-24 text-right"
                                  aria-label={`Teilbetrag von ${z.kundeName}`}
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  disabled={laufendeId === z.eintragId}
                                  onClick={() =>
                                    void tun(z.eintragId, () =>
                                      erfasseBarzahlung(z.eintragId, "", teilBetrag)
                                    ).then((gut) => {
                                      if (gut) {
                                        setTeilZeile(null);
                                        setTeilBetrag("");
                                      }
                                    })
                                  }
                                  aria-label={`Teilbetrag von ${z.kundeName} erfassen`}
                                >
                                  OK
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setTeilZeile(null);
                                    setTeilBetrag("");
                                  }}
                                >
                                  Abbrechen
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  disabled={laufendeId === z.eintragId}
                                  onClick={() =>
                                    void tun(z.eintragId, () => erfasseBarzahlung(z.eintragId, ""))
                                  }
                                  aria-label={`Barzahlung von ${z.kundeName} erfassen`}
                                >
                                  {laufendeId === z.eintragId
                                    ? "…"
                                    : `Bezahlt ${EUR.format(z.offen)}`}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={laufendeId === z.eintragId}
                                  onClick={() => {
                                    setTeilZeile(z.eintragId);
                                    setTeilBetrag("");
                                    setFehler(null);
                                  }}
                                  aria-label={`Teilbetrag für ${z.kundeName} eingeben`}
                                >
                                  Teilbetrag
                                </Button>
                              </>
                            ))}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={laufendeId === z.eintragId}
                            onClick={() =>
                              void tun(z.eintragId, () => entferneEintrag(z.eintragId, ""))
                            }
                            aria-label={`Eintrag von ${z.kundeName} entfernen`}
                            title="Von der Liste nehmen — erfasste Zahlungen bleiben"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {formOffen ? (
            <div className="space-y-3 rounded-md border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                <div className="space-y-1">
                  <Label htmlFor="barzahlung-abo">Kunde und Abo</Label>
                  <Select
                    value={gewaehltesAbo}
                    onValueChange={(wert) => {
                      setGewaehltesAbo(wert);
                      const wahl = aboWahl.find((a) => a.aboId === wert);
                      // Der Preis des Abos als Vorschlag — überschreibbar.
                      setEintragsBetrag(wahl?.preis ? String(wahl.preis) : "");
                    }}
                  >
                    <SelectTrigger id="barzahlung-abo" aria-label="Kunde und Abo auswählen">
                      <SelectValue placeholder="Auswählen…" />
                    </SelectTrigger>
                    <SelectContent>
                      {aboWahl.map((a) => (
                        <SelectItem key={a.aboId} value={a.aboId}>
                          {a.kundeName} — {a.istFlatrate ? "Flatrate" : (a.aboName ?? "Kursabo")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="barzahlung-betrag">Betrag</Label>
                  <Input
                    id="barzahlung-betrag"
                    value={eintragsBetrag}
                    onChange={(e) => setEintragsBetrag(e.target.value)}
                    placeholder="89"
                    inputMode="decimal"
                  />
                </div>
              </div>

              {/* Ein Verbot wäre hier eine Annahme über den Betrieb — es kommt
                  vor, dass jemand einmal bar zahlt. Gesagt werden muss es
                  trotzdem, denn die Lastschrift greift ebenfalls zu. */}
              {gewaehlt?.hatMandat && (
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  Für diesen Kunden liegt ein SEPA-Mandat vor — dieses Abo wird also auch
                  eingezogen.
                </p>
              )}

              <div className="flex gap-2">
                <Button size="sm" disabled={tutGerade} onClick={() => void eintragen()}>
                  {tutGerade ? "Wird eingetragen…" : "Eintragen"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={tutGerade}
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
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setFormOffen(true)}>
                <Plus className="mr-1 h-4 w-4" />
                Barzahler eintragen
              </Button>
              {zeilen.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setFragtAb(true)}>
                  Zyklus abschließen
                </Button>
              )}
            </div>
          )}

          {/* Die Bestätigung sagt vorher, was verschwindet — und was bleibt. */}
          {fragtAb && (
            <Alert>
              <AlertDescription className="space-y-3">
                <p>
                  Die ganze Liste wird geleert: {zeilen.length}{" "}
                  {zeilen.length === 1 ? "Eintrag" : "Einträge"}, davon {offene.length} noch offen
                  über <span className="tabular-nums">{EUR.format(summeOffen)}</span>. Die erfassten
                  Zahlungen bleiben unter „Eingesammelt“ stehen.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={tutGerade}
                    onClick={() => void abschliessen()}
                  >
                    {tutGerade ? "Wird geleert…" : "Liste leeren"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={tutGerade}
                    onClick={() => setFragtAb(false)}
                  >
                    Abbrechen
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
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
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={laufendeId === z.id}
                            onClick={() => void tun(z.id, () => nimmBarzahlungZurueck(z.id, ""))}
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
