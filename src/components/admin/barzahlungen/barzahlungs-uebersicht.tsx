"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, ChevronDown, Plus, Trash2, Undo2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import {
  aendereEintrag,
  entferneEintrag,
  erfasseBarzahlung,
  ladeZyklusVorschau,
  legeEintragAn,
  nimmBarzahlungZurueck,
  nimmZyklusZurueck,
  schliesseZyklusAb,
  setzeNotiz,
  type VorschauZeile,
} from "@/lib/actions/teacher/barzahlung";
import {
  offeneSumme,
  produktText,
  restText,
  zustandText,
  type EintragsZeile,
} from "@/lib/barzahlungen/offen";
import type { ArchivZeile, ZyklusZeile } from "@/lib/barzahlungen/laden";

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

export type EingesammeltZeile = {
  id: string;
  kundeId: string;
  kundeName: string;
  tag: string;
  betrag: number;
  kassiertVon: string;
};

/** PROJ-87: Ein Aufschlag, den kein Lastschriftlauf abholt. */
export type OffenerAufschlag = {
  id: string;
  kundeName: string;
  betrag: number;
  grund: string;
};

/** Ein Abo, das noch nicht auf der Liste steht. */
export type AboWahl = {
  aboId: string;
  kundeName: string;
  aboName: string | null;
  istFlatrate: boolean;
  /** Die Stilrichtung, wenn das Abo ein Pass ist (PROJ-95) — sonst `null`. */
  passStil: string | null;
  preis: number | null;
  hatMandat: boolean;
  /**
   * Was dieses Abo im vorigen Zyklus schuldete (PROJ-99) — `null`, wenn es
   * dort nicht auf der Liste stand. Zugleich der Vorschlag für den Betrag und
   * das Merkmal für die Gruppe „Im vorigen Zyklus".
   */
  vorigerBetrag: number | null;
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
  aufschlaege,
  eingesammelt,
  zeitraumText,
  zyklen,
  archiv,
  zyklusStart,
  heute,
}: {
  zeilen: EintragsZeile[];
  aboWahl: AboWahl[];
  aufschlaege: OffenerAufschlag[];
  eingesammelt: EingesammeltZeile[];
  zeitraumText: string;
  /** Die abgeschlossenen Zyklen, der jüngste zuerst (PROJ-98). */
  zyklen: ZyklusZeile[];
  /** Die Abschriften aller Zyklen — gruppiert wird hier, geladen wird einmal. */
  archiv: ArchivZeile[];
  /** Der erste Tag des laufenden Zyklus; `null`, solange keiner abgeschlossen wurde. */
  zyklusStart: string | null;
  /**
   * Der heutige Wiener Kalendertag, vom Server.
   *
   * Nicht aus dem Browser: Dessen Uhr steht anderswo in einer anderen
   * Zeitzone, und von diesem Tag hängt ab, welches Enddatum der Dialog
   * vorschlägt und welches er abweist.
   */
  heute: string;
}) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laufendeId, setLaufendeId] = useState<string | null>(null);
  const [teilZeile, setTeilZeile] = useState<string | null>(null);
  const [teilBetrag, setTeilBetrag] = useState("");
  const [aendereZeile, setAendereZeile] = useState<string | null>(null);
  const [neuerBetrag, setNeuerBetrag] = useState("");
  // PROJ-86: Welche Zeile gerade ihre Notiz bearbeitet.
  const [notizZeile, setNotizZeile] = useState<string | null>(null);
  const [notizText, setNotizText] = useState("");

  const [formOffen, setFormOffen] = useState(false);
  const [gewaehltesAbo, setGewaehltesAbo] = useState("");
  const [eintragsBetrag, setEintragsBetrag] = useState("");
  const [eintragsNotiz, setEintragsNotiz] = useState("");
  const [tutGerade, setTutGerade] = useState(false);
  const [fragtAb, setFragtAb] = useState(false);

  // PROJ-98: Der Abschluss-Dialog. Das Enddatum ist mit heute vorbelegt — der
  // häufige Fall bleibt ein Druck —, Vergangenheit ist erlaubt und genau der
  // Zweck der Übung.
  const [enddatum, setEnddatum] = useState(heute);
  const [vorschau, setVorschau] = useState<VorschauZeile[] | null>(null);
  const [vorschauFehler, setVorschauFehler] = useState<string | null>(null);
  const [vorschauLaeuft, setVorschauLaeuft] = useState(false);
  const [fragtZurueck, setFragtZurueck] = useState(false);

  const offene = zeilen.filter((z) => z.istOffen);
  const summeOffen = offeneSumme(zeilen);
  const summeEingesammelt = eingesammelt.reduce((s, z) => s + z.betrag, 0);
  const gewaehlt = aboWahl.find((a) => a.aboId === gewaehltesAbo);

  // PROJ-99: Wer im vorigen Zyklus auf der Liste stand, steht oben — mit dem
  // Betrag von damals. Kein Sammelknopf: Wer aufgehört hat, soll auffallen.
  const vorige = aboWahl.filter((a) => a.vorigerBetrag !== null);
  const uebrige = aboWahl.filter((a) => a.vorigerBetrag === null);

  const zukunft = enddatum > heute;
  const gehen = vorschau?.filter((z) => z.geht) ?? [];
  const bleiben = vorschau?.filter((z) => !z.geht) ?? [];
  // Der Preis dieser Lösung, benannt statt versteckt: Wer nach dem Enddatum
  // gezahlt hat, wird dem neuen Zyklus zugerechnet. Hier steht er mit Namen
  // und Tag, damit das Enddatum notfalls ein anderes wird.
  const spaete = vorschau?.filter((z) => z.spaetBetrag > 0.005) ?? [];

  /**
   * Die Vorschau zum gewählten Enddatum — sie ändert nichts.
   *
   * Sie wird bei jeder Änderung des Datums neu geholt, und eine Antwort, die
   * zu einem älteren Datum gehört, wird verworfen: Sonst entschiede die
   * Reihenfolge der Antworten, welche Zahlen über dem Knopf stehen.
   */
  useEffect(() => {
    if (!fragtAb || zukunft) {
      setVorschau(null);
      return;
    }
    let verworfen = false;
    setVorschauLaeuft(true);
    setVorschauFehler(null);
    void ladeZyklusVorschau(enddatum).then((ergebnis) => {
      if (verworfen) return;
      if ("error" in ergebnis) {
        setVorschau(null);
        setVorschauFehler(ergebnis.error);
      } else {
        setVorschau(ergebnis.zeilen);
      }
      setVorschauLaeuft(false);
    });
    return () => {
      verworfen = true;
    };
  }, [fragtAb, enddatum, zukunft]);

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
      const ergebnis = await legeEintragAn(gewaehlt.aboId, eintragsBetrag, "", eintragsNotiz);
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      setFormOffen(false);
      setGewaehltesAbo("");
      setEintragsBetrag("");
      setEintragsNotiz("");
      router.refresh();
    } finally {
      setTutGerade(false);
    }
  }

  async function abschliessen() {
    setTutGerade(true);
    setFehler(null);
    try {
      const ergebnis = await schliesseZyklusAb(enddatum);
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      setFragtAb(false);
      setVorschau(null);
      setHinweis(
        `Zyklus bis ${datum(enddatum)} abgeschlossen: ${ergebnis.abgeschrieben} ` +
          `${ergebnis.abgeschrieben === 1 ? "Eintrag" : "Einträge"} archiviert, ` +
          `${ergebnis.entfernt} von der Liste genommen, ${ergebnis.geblieben} stehen geblieben.`
      );
      router.refresh();
    } finally {
      setTutGerade(false);
    }
  }

  /** Den letzten Abschluss zurücknehmen (PROJ-98). */
  async function zurueckNehmen() {
    setTutGerade(true);
    setFehler(null);
    try {
      const ergebnis = await nimmZyklusZurueck();
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      setFragtZurueck(false);
      setHinweis(
        `Der Abschluss ist zurückgenommen. ${ergebnis.zurueck} ` +
          `${ergebnis.zurueck === 1 ? "Eintrag steht" : "Einträge stehen"} wieder auf der Liste.`
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

      {/* PROJ-87: Ein Aufschlag reist im nächsten Lastschriftlauf mit — wer
          kein Mandat hat, kommt aber in keinen Lauf. Hier steht er, damit der
          Betrag nicht still liegen bleibt. */}
      {aufschlaege.length > 0 && (
        <Alert>
          <AlertDescription className="space-y-1">
            <p className="font-medium">
              Offene Aufschläge ohne Lastschrift —{" "}
              {EUR.format(aufschlaege.reduce((s, a) => s + a.betrag, 0))}
            </p>
            <ul className="text-sm">
              {aufschlaege.map((a) => (
                <li key={a.id}>
                  {a.kundeName}: <span className="tabular-nums">{EUR.format(a.betrag)}</span> ({a.grund})
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Diese Kunden haben kein SEPA-Mandat und kommen in keinen Lauf. Rechne den Betrag beim
              nächsten Eintrag mit ein.
            </p>
          </AlertDescription>
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
            Der laufende Zahlungszyklus{zyklusStart ? ` seit ${datum(zyklusStart)}` : ""}.{" "}
            {offene.length} offen, Summe{" "}
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
                          {/* PROJ-95: Nicht `istFlatrate` — ein Pass ist
                              ebenfalls kurslos, und „Bachata Pass [Flatrate]"
                              wäre ein Widerspruch in einer Zeile. */}
                          {produktText(z) && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {produktText(z)}
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
                        <div>{zustandText(z)}</div>
                        {/* PROJ-98: Der Rest aus dem vorigen Zyklus steht
                            daneben, nicht im Betrag. Eine Zahl aus zwei Zyklen
                            ist beim Kassieren nicht mehr zu trennen. */}
                        {restText(z) && (
                          <div className="text-xs text-amber-700 dark:text-amber-500">
                            {restText(z)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {notizZeile === z.eintragId ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={notizText}
                              onChange={(e) => setNotizText(e.target.value)}
                              maxLength={300}
                              placeholder="z. B. Rest aus September"
                              className="h-8 w-44"
                              aria-label={`Notiz von ${z.kundeName}`}
                              autoFocus
                            />
                            <Button
                              size="sm"
                              disabled={laufendeId === z.eintragId}
                              onClick={() =>
                                void tun(z.eintragId, () =>
                                  setzeNotiz(z.eintragId, notizText, "")
                                ).then((gut) => {
                                  if (gut) {
                                    setNotizZeile(null);
                                    setNotizText("");
                                  }
                                })
                              }
                              aria-label={`Notiz von ${z.kundeName} speichern`}
                            >
                              OK
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="max-w-[220px] truncate text-left underline-offset-2 hover:underline"
                            onClick={() => {
                              setNotizZeile(z.eintragId);
                              setNotizText(z.notiz ?? "");
                              setFehler(null);
                            }}
                            aria-label={`Notiz von ${z.kundeName} ändern`}
                          >
                            {z.notiz ?? "—"}
                          </button>
                        )}
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
                      // PROJ-99: Der Betrag des vorigen Zyklus schlägt den
                      // Preis des Abos — er ist die genauere Antwort auf „was
                      // zahlt dieser Mensch hier". Beides bleibt ein Vorschlag.
                      const vorschlag = wahl?.vorigerBetrag ?? wahl?.preis ?? null;
                      setEintragsBetrag(vorschlag ? String(vorschlag) : "");
                    }}
                  >
                    <SelectTrigger id="barzahlung-abo" aria-label="Kunde und Abo auswählen">
                      <SelectValue placeholder="Auswählen…" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* PROJ-99: Die Zahler des vorigen Zyklus oben. Die
                          Gruppe fehlt ganz, wenn es keinen gibt — ein leerer
                          Abschnitt sieht aus wie ein Fehler. */}
                      {vorige.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Im vorigen Zyklus</SelectLabel>
                          {vorige.map((a) => (
                            <SelectItem key={a.aboId} value={a.aboId}>
                              {a.kundeName} — {produktText(a) ?? a.aboName ?? "Kursabo"} (
                              {EUR.format(a.vorigerBetrag ?? 0)})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      <SelectGroup>
                        {vorige.length > 0 && <SelectLabel>Alle anderen</SelectLabel>}
                        {uebrige.map((a) => (
                          <SelectItem key={a.aboId} value={a.aboId}>
                            {a.kundeName} — {produktText(a) ?? a.aboName ?? "Kursabo"}
                          </SelectItem>
                        ))}
                      </SelectGroup>
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

              <div className="space-y-1">
                <Label htmlFor="barzahlung-notiz">Notiz (optional)</Label>
                <Input
                  id="barzahlung-notiz"
                  value={eintragsNotiz}
                  onChange={(e) => setEintragsNotiz(e.target.value)}
                  maxLength={300}
                  placeholder="z. B. Rest aus September"
                />
              </div>

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
              {/* Auch bei leerer Liste erlaubt: Ein Zyklus ohne Einträge ist
                  eine Aussage über den Zeitraum und kein Fehler. */}
              <Button variant="ghost" size="sm" onClick={() => setFragtAb(true)}>
                <CalendarCheck className="mr-1 h-4 w-4" />
                Zyklus abschließen
              </Button>
            </div>
          )}

          {/* PROJ-98: Der Abschluss sagt vorher, was er tut — und zwar für das
              gewählte Enddatum, nicht für heute. */}
          {fragtAb && (
            <Alert>
              <AlertDescription className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="zyklus-ende">Der Zyklus endete am</Label>
                  <Input
                    id="zyklus-ende"
                    type="date"
                    value={enddatum}
                    max={heute}
                    onChange={(e) => setEnddatum(e.target.value)}
                    className="w-44"
                  />
                  <p className="text-xs text-muted-foreground">
                    Vorbelegt mit heute. Wähle den Tag, an dem der Zyklus wirklich endete — wer
                    danach gezahlt hat, bleibt auf der Liste, und sein Geld zählt für den neuen
                    Zyklus.
                  </p>
                </div>

                {zukunft ? (
                  <p className="text-sm">
                    Dieser Zyklus läuft noch — bitte einen Tag bis heute wählen.
                  </p>
                ) : vorschauFehler ? (
                  <p className="text-sm">{vorschauFehler}</p>
                ) : vorschauLaeuft || vorschau === null ? (
                  <p className="text-sm text-muted-foreground">Wird geprüft…</p>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium tabular-nums">{gehen.length}</span>{" "}
                      {gehen.length === 1 ? "Eintrag verlässt" : "Einträge verlassen"} die Liste,{" "}
                      <span className="font-medium tabular-nums">{bleiben.length}</span>{" "}
                      {bleiben.length === 1 ? "bleibt" : "bleiben"} stehen. Ins Archiv kommt die
                      ganze Liste ({vorschau.length}).
                    </p>
                    {spaete.length > 0 && (
                      <div className="space-y-1">
                        <p className="font-medium">Nach dem {datum(enddatum)} wurde gezahlt:</p>
                        <ul>
                          {spaete.map((z) => (
                            <li key={z.aboId}>
                              {z.kundeName}:{" "}
                              <span className="tabular-nums">{EUR.format(z.spaetBetrag)}</span>
                              {z.spaetTag && ` am ${datum(z.spaetTag)}`}
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-muted-foreground">
                          Dieses Geld zählt für den neuen Zyklus. Gehört es noch zum alten, wähle
                          ein späteres Enddatum.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* „Jetzt abschließen" und nicht noch einmal „Zyklus
                    abschließen": Zwei Knöpfe mit demselben Namen sind für
                    Tastatur und Vorlesesoftware zwei gleich aussehende
                    Angebote — und für einen Test nicht unterscheidbar. */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={tutGerade || zukunft || vorschauLaeuft}
                    onClick={() => void abschliessen()}
                  >
                    {tutGerade ? "Wird abgeschlossen…" : "Jetzt abschließen"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={tutGerade}
                    onClick={() => {
                      setFragtAb(false);
                      setFehler(null);
                    }}
                  >
                    Abbrechen
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* PROJ-98: Das Archiv. Jeder abgeschlossene Zyklus ist ein Nachweis —
          aufschlagbar, aber nicht änderbar. Zurücknehmen geht nur beim
          jüngsten und nur, solange seither nichts passiert ist. */}
      <Card role="region" aria-labelledby="barzahlungen-archiv">
        <CardHeader>
          <CardTitle id="barzahlungen-archiv" className="font-heading text-lg">
            Abgeschlossene Zyklen
            <Badge variant="outline" className="ml-2 align-middle">
              {zyklen.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            Die Abschrift jeder Liste im Moment des Abschließens — mit dem Betrag, der damals
            galt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {zyklen.length === 0 ? (
            // Keine leere Tabelle: Die sähe aus wie ein Fehler.
            <p className="text-sm text-muted-foreground">
              Es wurde noch kein Zyklus abgeschlossen. Sobald du einen abschließt, steht seine
              Liste hier als Nachweis.
            </p>
          ) : (
            zyklen.map((y) => {
              const zeilenDesZyklus = archiv.filter((a) => a.zyklusId === y.zyklusId);
              return (
                <Collapsible key={y.zyklusId} className="rounded-md border">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="h-auto w-full justify-start py-2 text-left">
                      <ChevronDown className="mr-2 h-4 w-4 shrink-0" />
                      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-medium tabular-nums">
                          {datum(y.von)} – {datum(y.bis)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {y.eintraege} {y.eintraege === 1 ? "Eintrag" : "Einträge"}
                        </span>
                        <span className="text-xs tabular-nums">
                          Eingesammelt {EUR.format(y.eingesammelt)} von {EUR.format(y.geschuldet)}
                        </span>
                        {y.offen > 0.005 && (
                          <span className="text-xs tabular-nums text-amber-700 dark:text-amber-500">
                            Offen geblieben {EUR.format(y.offen)}
                          </span>
                        )}
                      </span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 px-3 pb-3">
                    <p className="text-xs text-muted-foreground">
                      Abgeschlossen am{" "}
                      {new Date(y.abgeschlossenAm).toLocaleDateString("de-AT", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                      {y.abgeschlossenVon ? ` von ${y.abgeschlossenVon}` : ""}.
                    </p>

                    {zeilenDesZyklus.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        In diesem Zyklus stand niemand auf der Liste.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Kunde</TableHead>
                              <TableHead>Abo</TableHead>
                              <TableHead>Geschuldet</TableHead>
                              <TableHead>Gezahlt</TableHead>
                              <TableHead>Offen</TableHead>
                              <TableHead>Notiz</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {zeilenDesZyklus.map((a) => {
                              const offen = Math.round((a.betrag - a.gezahlt) * 100) / 100;
                              return (
                                <TableRow key={a.zeileId}>
                                  <TableCell className="font-medium">
                                    <Link
                                      href={`/admin/kunden/${a.kundeId}`}
                                      className="hover:underline"
                                    >
                                      {a.kundeName}
                                    </Link>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    <div className="flex flex-wrap items-center gap-2">
                                      {a.aboName}
                                      {produktText(a) && (
                                        <Badge
                                          variant="outline"
                                          className="px-1.5 py-0 text-[10px]"
                                        >
                                          {produktText(a)}
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap tabular-nums">
                                    {EUR.format(a.betrag)}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap tabular-nums">
                                    {EUR.format(a.gezahlt)}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap tabular-nums font-medium">
                                    {offen > 0.005 ? EUR.format(offen) : "—"}
                                  </TableCell>
                                  <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                                    {a.notiz ?? "—"}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Nur am jüngsten, und nur solange seither nichts
                        kassiert und kein Eintrag angelegt wurde. */}
                    {y.kannZurueck &&
                      (fragtZurueck ? (
                        <div className="space-y-2 rounded-md border p-3 text-sm">
                          <p>
                            Die Liste steht danach wieder wie vor dem Abschluss, und dieser Zyklus
                            verschwindet aus dem Archiv.
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={tutGerade}
                              onClick={() => void zurueckNehmen()}
                            >
                              {tutGerade ? "Wird zurückgenommen…" : "Ja, zurücknehmen"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={tutGerade}
                              onClick={() => setFragtZurueck(false)}
                            >
                              Abbrechen
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setFragtZurueck(true);
                            setFehler(null);
                          }}
                        >
                          <Undo2 className="mr-1 h-3.5 w-3.5" />
                          Abschluss zurücknehmen
                        </Button>
                      ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })
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
