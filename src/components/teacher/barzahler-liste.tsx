"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, ChevronDown, Plus, Trash2, Undo2 } from "lucide-react";
import {
  aendereEintrag,
  entferneEintrag,
  erfasseBarzahlung,
  legeEintragAn,
  nimmBarzahlungZurueck,
} from "@/lib/actions/teacher/barzahlung";
import { legeBarzahlerAn } from "@/lib/actions/teacher/barzahler-anlegen";
import {
  offeneSumme,
  teileNachKurs,
  zustandText,
  type EintragsZeile,
} from "@/lib/barzahlungen/offen";
import type { Kandidat } from "@/lib/barzahlungen/laden";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

export type BarzahlerAnsicht = EintragsZeile;

/**
 * Die Barzahler eines Kurses (PROJ-84).
 *
 * Steht bei der Anwesenheitsliste, weil die Lehrkraft am Kursabend genau diese
 * Seite offen hat. Eine zweite Stelle wäre eine, die man vergisst.
 *
 * Zwei Gruppen: oben die Teilnehmer dieses Kurses — die Arbeit des Abends.
 * Darunter eingeklappt die übrigen Flatrate-Einträge: Ein Flatrater kann in
 * jedem Kurs vorbeikommen, und dann muss hier kassiert werden können, ohne
 * dass diese Leute die Liste jedes Kursabends zuwachsen lassen.
 */
export function BarzahlerListe({
  courseId,
  zeilen: anfangsZeilen,
  kandidaten,
}: {
  courseId: string;
  zeilen: BarzahlerAnsicht[];
  kandidaten: Kandidat[];
}) {
  const router = useRouter();
  const [zeilen, setZeilen] = useState(anfangsZeilen);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laufendeId, setLaufendeId] = useState<string | null>(null);
  const [teilZeile, setTeilZeile] = useState<string | null>(null);
  const [teilBetrag, setTeilBetrag] = useState("");
  const [aendereZeile, setAendereZeile] = useState<string | null>(null);
  const [neuerBetrag, setNeuerBetrag] = useState("");

  // Eintragen: ein Teilnehmer dieses Kurses, der noch nicht auf der Liste steht.
  const [formOffen, setFormOffen] = useState(false);
  const [gewaehltesAbo, setGewaehltesAbo] = useState("");
  const [eintragsBetrag, setEintragsBetrag] = useState("");
  const [tutGerade, setTutGerade] = useState(false);

  // PROJ-82: Wer vor der Lehrkraft steht und sich nie registriert hat.
  const [gastOffen, setGastOffen] = useState(false);
  const [gastName, setGastName] = useState("");
  const [gastBetrag, setGastBetrag] = useState("");

  // Nach `router.refresh()` kommen neue Eigenschaften an, aber ein
  // `useState(anfangsZeilen)` behaelt seinen ersten Wert -- ein neu
  // eingetragener Barzahler waere auf dieser Seite erst nach einem
  // vollstaendigen Neuladen zu sehen. Dieselbe Falle wie bei den Filtern der
  // Admin-Listen.
  useEffect(() => {
    setZeilen(anfangsZeilen);
  }, [anfangsZeilen]);

  const { eigene, fremde } = teileNachKurs(zeilen);
  const summe = offeneSumme(eigene);

  /**
   * Erfassen — ohne Betrag den gesamten offenen Rest, mit Betrag genau diesen.
   *
   * Der verbuchte Betrag kommt von der Datenbank zurück und wird hier in die
   * Zeile gerechnet. Selbst zu rechnen hieße, die Rundung ein zweites Mal zu
   * machen, und zwei Rundungen driften.
   */
  async function erfassen(zeile: BarzahlerAnsicht, eingabe?: string) {
    setLaufendeId(zeile.eintragId);
    setFehler(null);
    try {
      const ergebnis = await erfasseBarzahlung(zeile.eintragId, courseId, eingabe);
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      // Die Zeile wandert nicht: Sie bleibt stehen, nur mit neuem Stand. Ein
      // Sprung mitten im Abhaken ließe die Lehrkraft die Zeile verlieren.
      setZeilen((bisher) =>
        bisher.map((z) =>
          z.eintragId === zeile.eintragId ? neuerStand(z, ergebnis.betrag, ergebnis.zahlungId) : z
        )
      );
      setTeilZeile(null);
      setTeilBetrag("");
    } finally {
      setLaufendeId(null);
    }
  }

  async function zurueck(zeile: BarzahlerAnsicht) {
    if (!zeile.letzteZahlungId) return;
    setLaufendeId(zeile.eintragId);
    setFehler(null);
    try {
      const ergebnis = await nimmBarzahlungZurueck(zeile.letzteZahlungId, courseId);
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      // Hier wird neu geladen und nicht nachgerechnet: Wie viel die
      // zurückgenommene Zahlung ausmachte, weiß diese Seite nach einem
      // Neuaufbau nicht mehr — sie kennt nur ihre Kennung.
      router.refresh();
    } finally {
      setLaufendeId(null);
    }
  }

  async function eintragen() {
    const kandidat = kandidaten.find((k) => k.aboId === gewaehltesAbo);
    if (!kandidat) {
      setFehler("Bitte einen Teilnehmer auswählen.");
      return;
    }
    setTutGerade(true);
    setFehler(null);
    try {
      const ergebnis = await legeEintragAn(kandidat.aboId, eintragsBetrag, courseId);
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

  async function betragAendern(zeile: BarzahlerAnsicht) {
    setLaufendeId(zeile.eintragId);
    setFehler(null);
    try {
      const ergebnis = await aendereEintrag(zeile.eintragId, neuerBetrag, courseId);
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      setAendereZeile(null);
      setNeuerBetrag("");
      router.refresh();
    } finally {
      setLaufendeId(null);
    }
  }

  async function entfernen(zeile: BarzahlerAnsicht) {
    setLaufendeId(zeile.eintragId);
    setFehler(null);
    try {
      const ergebnis = await entferneEintrag(zeile.eintragId, courseId);
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      router.refresh();
    } finally {
      setLaufendeId(null);
    }
  }

  async function gastEintragen() {
    setTutGerade(true);
    setFehler(null);
    try {
      const ergebnis = await legeBarzahlerAn(courseId, gastName, gastBetrag);
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      // Die Seite lädt sich neu: Der neue Kunde gehört in die
      // Anwesenheitsliste und in die Kursgrenze, nicht nur in diese Tabelle.
      setGastOffen(false);
      setGastName("");
      setGastBetrag("");
      window.location.reload();
    } finally {
      setTutGerade(false);
    }
  }

  function tabelle(gruppe: BarzahlerAnsicht[], istFremd = false) {
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[160px]">{istFremd ? "Flatrater" : "Name"}</TableHead>
              <TableHead>Betrag</TableHead>
              <TableHead>Offen</TableHead>
              <TableHead>Zustand</TableHead>
              <TableHead className="text-right">Kassiert</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gruppe.map((zeile) => (
              <TableRow key={zeile.eintragId}>
                <TableCell className="font-medium">
                  <div className="flex flex-wrap items-center gap-2">
                    {zeile.kundeName}
                    {zeile.istFlatrate && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        Flatrate
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                  {aendereZeile === zeile.eintragId ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={neuerBetrag}
                        onChange={(e) => setNeuerBetrag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void betragAendern(zeile);
                        }}
                        inputMode="decimal"
                        className="h-8 w-20 text-right"
                        aria-label={`Betrag von ${zeile.kundeName}`}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        disabled={laufendeId === zeile.eintragId}
                        onClick={() => void betragAendern(zeile)}
                        aria-label={`Betrag von ${zeile.kundeName} speichern`}
                      >
                        OK
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => {
                        setAendereZeile(zeile.eintragId);
                        setNeuerBetrag(String(zeile.betrag));
                        setFehler(null);
                      }}
                      aria-label={`Betrag von ${zeile.kundeName} ändern`}
                    >
                      {EUR.format(zeile.betrag)}
                    </button>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums font-medium">
                  {zeile.istOffen ? EUR.format(zeile.offen) : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{zustandText(zeile)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {zeile.istOffen ? (
                      teilZeile === zeile.eintragId ? (
                        <>
                          <Input
                            value={teilBetrag}
                            onChange={(e) => setTeilBetrag(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void erfassen(zeile, teilBetrag);
                            }}
                            placeholder={String(zeile.offen)}
                            inputMode="decimal"
                            className="h-8 w-20 text-right"
                            aria-label={`Teilbetrag von ${zeile.kundeName}`}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            disabled={laufendeId === zeile.eintragId}
                            onClick={() => void erfassen(zeile, teilBetrag)}
                            aria-label={`Teilbetrag von ${zeile.kundeName} erfassen`}
                          >
                            {laufendeId === zeile.eintragId ? "…" : "OK"}
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
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            disabled={laufendeId === zeile.eintragId}
                            onClick={() => void erfassen(zeile)}
                            aria-label={`Barzahlung von ${zeile.kundeName} erfassen`}
                          >
                            {laufendeId === zeile.eintragId
                              ? "…"
                              : `Bezahlt ${EUR.format(zeile.offen)}`}
                          </Button>
                          {/* Wer nicht alles dabei hat. */}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={laufendeId === zeile.eintragId}
                            onClick={() => {
                              setTeilZeile(zeile.eintragId);
                              setTeilBetrag("");
                              setFehler(null);
                            }}
                            aria-label={`Teilbetrag für ${zeile.kundeName} eingeben`}
                          >
                            Teilbetrag
                          </Button>
                        </>
                      )
                    ) : zeile.letzteZahlungId ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={laufendeId === zeile.eintragId}
                        onClick={() => void zurueck(zeile)}
                        aria-label={`Barzahlung von ${zeile.kundeName} zurücknehmen`}
                      >
                        <Undo2 className="mr-1 h-3.5 w-3.5" />
                        Zurücknehmen
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">✓</span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={laufendeId === zeile.eintragId}
                      onClick={() => void entfernen(zeile)}
                      aria-label={`Eintrag von ${zeile.kundeName} entfernen`}
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
    );
  }

  return (
    <Card role="region" aria-labelledby="barzahler-titel">
      <CardHeader>
        <CardTitle id="barzahler-titel" className="font-heading text-lg flex items-center gap-2">
          <Banknote className="h-5 w-5 text-primary" />
          Barzahler
        </CardTitle>
        <CardDescription>
          Von Hand geführt: eintragen, kassieren, entfernen. Der Betrag ist eure Entscheidung — die
          App rechnet keine Fälligkeiten.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {fehler && (
          <Alert variant="destructive">
            <AlertDescription>{fehler}</AlertDescription>
          </Alert>
        )}

        {eigene.length === 0 ? (
          // Eine leere Fläche ließe offen, ob niemand bar zahlt oder die Liste
          // nicht geladen wurde.
          <p className="text-sm text-muted-foreground">
            Für diesen Kurs steht niemand auf der Barzahler-Liste.
          </p>
        ) : (
          <>
            {summe > 0 && (
              <p className="text-sm">
                <span className="font-medium">Heute einzusammeln:</span>{" "}
                <span className="tabular-nums">{EUR.format(summe)}</span>
              </p>
            )}
            {tabelle(eigene)}
          </>
        )}

        {/* Flatrater aus anderen Kursen: eingeklappt, weil sie mit diesem
            Kursabend nichts zu tun haben — erreichbar, weil sie jederzeit
            vorbeikommen können. */}
        {fremde.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-start">
                <ChevronDown className="mr-1 h-4 w-4" />
                Flatrater anzeigen ({fremde.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <p className="mb-2 text-xs text-muted-foreground">
                Flatrate-Barzahler, die für diesen Kurs nicht angemeldet sind. Wer heute hier ist,
                kann hier bezahlen.
              </p>
              {tabelle(fremde, true)}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Einen Teilnehmer dieses Kurses auf die Liste setzen. */}
        {formOffen ? (
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-1">
                <Label htmlFor="barzahler-abo">Teilnehmer</Label>
                <Select
                  value={gewaehltesAbo}
                  onValueChange={(wert) => {
                    setGewaehltesAbo(wert);
                    const kandidat = kandidaten.find((k) => k.aboId === wert);
                    // Der Preis des Abos als Vorschlag — überschreibbar.
                    setEintragsBetrag(kandidat?.preis ? String(kandidat.preis) : "");
                  }}
                >
                  <SelectTrigger id="barzahler-abo" aria-label="Teilnehmer auswählen">
                    <SelectValue placeholder="Auswählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {kandidaten.map((k) => (
                      <SelectItem key={k.aboId} value={k.aboId}>
                        {k.kundeName} — {k.istFlatrate ? "Flatrate" : (k.aboName ?? "Kursabo")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="barzahler-eintrags-betrag">Betrag</Label>
                <Input
                  id="barzahler-eintrags-betrag"
                  value={eintragsBetrag}
                  onChange={(e) => setEintragsBetrag(e.target.value)}
                  placeholder="89"
                  inputMode="decimal"
                />
              </div>
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
          kandidaten.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setFormOffen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Barzahler eintragen
            </Button>
          )
        )}

        {/* PROJ-82: Ein Gast, der bar zahlt und sich nie registriert hat, wird
            hier ein echter Kunde — mit Kursplatz, Preis und Listeneintrag. */}
        {gastOffen ? (
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-1">
                <Label htmlFor="barzahler-name">Name</Label>
                <Input
                  id="barzahler-name"
                  value={gastName}
                  onChange={(e) => setGastName(e.target.value)}
                  placeholder="Vor- und Nachname"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="barzahler-betrag">Betrag</Label>
                <Input
                  id="barzahler-betrag"
                  value={gastBetrag}
                  onChange={(e) => setGastBetrag(e.target.value)}
                  placeholder="50"
                  inputMode="decimal"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Wird ein Teilnehmer dieses Kurses mit diesem Beitrag — ohne Konto, ohne E-Mail — und
              steht danach auf der Barzahler-Liste. Die Verwaltung kann später eine Adresse
              nachtragen.
            </p>
            <div className="flex gap-2">
              <Button size="sm" disabled={tutGerade} onClick={() => void gastEintragen()}>
                {tutGerade ? "Wird angelegt…" : "Gast anlegen"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={tutGerade}
                onClick={() => {
                  setGastOffen(false);
                  setFehler(null);
                }}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setGastOffen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Gast ohne Konto eintragen
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Der heutige Tag als „JJJJ-MM-TT" — nur für die Anzeige nach dem Abhaken. */
function heute(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(new Date());
}

/**
 * Die Zeile nach einer erfassten Zahlung.
 *
 * Dieselbe Rechnung wie in `eintragsZeilen`, nur ohne einen Seitenaufbau
 * abzuwarten. Bei einem Teilbetrag bleibt die Zeile offen, und genau das ist
 * der Sinn.
 */
function neuerStand(
  zeile: BarzahlerAnsicht,
  betrag: number,
  zahlungId: string
): BarzahlerAnsicht {
  const bezahlt = Math.round((zeile.bezahlt + betrag) * 100) / 100;
  const offen = Math.round((zeile.betrag - bezahlt) * 100) / 100;
  return {
    ...zeile,
    bezahlt,
    offen,
    istOffen: offen > 0.005,
    teilweise: offen > 0.005 && bezahlt > 0.005,
    letzteZahlung: heute(),
    letzteZahlungId: zahlungId,
  };
}
