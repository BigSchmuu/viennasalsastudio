"use client";

import { useState, useTransition } from "react";
import { legeZyklusAn, aendereZyklus, entferneZyklus } from "@/lib/actions/admin/zyklen";
import { endeZu, luecke } from "@/lib/sepa/zyklus-vorschlag";
import type { Ferienzeitraum } from "@/lib/scheduling/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
// Nicht formatShortDate: Das lässt die Jahreszahl weg, und der erste Zyklus
// des Studios läuft über den Jahreswechsel — „So, 10.01." wäre dort eine
// Falle. Bei Zeiträumen, für die Geld fließt, steht das Jahr dabei.
import { formatDate } from "@/lib/formatting";

/**
 * Vier Zustände, und der vierte ist der wichtige: `offen` heißt vorbei und nie
 * abgerechnet. Genau diese Lage — ein Zeitraum, für den niemand eingezogen hat
 * — war am 2026-11-17 der Anlass für dieses Vorhaben, und sie war nirgends zu
 * sehen.
 */
export type ZyklusZustand = "abgerechnet" | "laufend" | "kuenftig" | "offen";

export type ZyklusZeile = {
  id: string;
  von: string;
  bis: string;
  tage: number;
  laeufe: number;
  zustand: ZyklusZustand;
};

export type Vorschlag = {
  von: string;
  bis: string;
  ohneSchliesstage: string;
  schliesstage: number;
};

const ZUSTAND_TEXT: Record<ZyklusZustand, string> = {
  abgerechnet: "abgerechnet",
  laufend: "laufend",
  kuenftig: "künftig",
  offen: "nicht abgerechnet",
};

const ZUSTAND_FARBE: Record<ZyklusZustand, "default" | "secondary" | "outline" | "destructive"> = {
  abgerechnet: "secondary",
  laufend: "default",
  kuenftig: "outline",
  offen: "destructive",
};

/**
 * Die Zahlungszyklen verwalten (PROJ-107).
 *
 * Vier Wochen sind hier nur der **Vorschlag**: Die ferienbewusste Rechnung
 * belegt die Felder vor und legt ihre Zwischenschritte offen, der Betreiber
 * bestätigt oder überschreibt. Wer schließt, setzt das Ende später an — damit
 * verlässt die Ferienarithmetik die Abrechnung, und genau das ist der Gewinn.
 *
 * Was die Datenbank verbietet, verbietet dieses Formular nicht noch einmal:
 * Überschneidungen und das Ändern abgerechneter Zyklen werden dort abgewiesen
 * und hier nur als Satz gezeigt. Eine **Lücke** ist erlaubt — sie wird
 * benannt, bevor sie entsteht.
 */
export function ZyklenManager({
  zyklen,
  vorschlag,
  letztesEnde,
  vorlaufTage,
  ferien,
}: {
  zyklen: ZyklusZeile[];
  vorschlag: Vorschlag;
  letztesEnde: string | null;
  vorlaufTage: number | null;
  ferien: Ferienzeitraum[];
}) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [von, setVon] = useState(vorschlag.von);
  const [bis, setBis] = useState(vorschlag.bis);
  const [zuAendern, setZuAendern] = useState<ZyklusZeile | null>(null);
  const [zuEntfernen, setZuEntfernen] = useState<ZyklusZeile | null>(null);
  const [laeuft, starte] = useTransition();

  const offeneLuecke = luecke(letztesEnde, von);

  // Die Rechnung gehört zum **eingetippten** Beginn, nicht zum Vorschlag, mit
  // dem die Seite geladen wurde. Sonst erklärt sie ein Ende, das längst nicht
  // mehr gilt — am 2026-11-17 genau so gemeldet: Vorgeschlagen war „heute bis
  // in vier Wochen", und wer den Beginn auf den 30.11. setzte, behielt das
  // alte Ende.
  const gueltigerBeginn = /^\d{4}-\d{2}-\d{2}$/.test(von);
  const rechnung = gueltigerBeginn ? endeZu(von, ferien) : null;
  const abweichend = rechnung !== null && bis !== rechnung.bis;

  function beginnGeaendert(neu: string) {
    setVon(neu);
    // Das Ende folgt dem Beginn. Wer es danach von Hand ändert, behält seine
    // Eingabe — bis er den Beginn wieder anfasst.
    if (/^\d{4}-\d{2}-\d{2}$/.test(neu)) setBis(endeZu(neu, ferien).bis);
  }

  function anlegen(formData: FormData) {
    setFehler(null);
    starte(async () => {
      const ergebnis = await legeZyklusAn(formData);
      if ("error" in ergebnis) setFehler(ergebnis.error);
    });
  }

  function aendern(formData: FormData) {
    const zeile = zuAendern;
    if (!zeile) return;
    setFehler(null);
    starte(async () => {
      const ergebnis = await aendereZyklus(zeile.id, formData);
      if ("error" in ergebnis) setFehler(ergebnis.error);
      else setZuAendern(null);
    });
  }

  function entfernen(zeile: ZyklusZeile) {
    setFehler(null);
    starte(async () => {
      const ergebnis = await entferneZyklus(zeile.id);
      setZuEntfernen(null);
      if ("error" in ergebnis) setFehler(ergebnis.error);
    });
  }

  return (
    <div className="space-y-6" data-testid="zyklen-verwaltung">
      <div>
        <h2 className="font-heading text-2xl font-bold">Zahlungszyklen</h2>
        <p className="text-sm text-muted-foreground">
          Ein Zyklus gilt für alle Abos. Daran hängt, was ein Lastschriftlauf aufnimmt — je Abo
          einmal pro Zyklus. Vier Kurswochen sind der Vorschlag; Schließungen verlängern den
          Zyklus, indem du das Ende später ansetzt.
        </p>
      </div>

      {fehler && (
        <Alert variant="destructive">
          <AlertDescription>{fehler}</AlertDescription>
        </Alert>
      )}

      {zyklen.some((z) => z.zustand === "offen") && (
        <Alert variant="destructive" data-testid="zyklen-offen-warnung">
          <AlertDescription>
            Für einen vergangenen Zyklus wurde nie eingezogen. Prüfe, ob der Beitrag dafür
            geflossen ist — über einen Lastschriftlauf oder die Barzahlungsliste.
          </AlertDescription>
        </Alert>
      )}

      {vorlaufTage !== null && vorlaufTage < 28 && (
        <Alert data-testid="zyklen-vorlauf-warnung">
          <AlertDescription>
            Der letzte eingetragene Zyklus endet am {formatDate(letztesEnde!)} — das sind nur{" "}
            {vorlaufTage} {vorlaufTage === 1 ? "Tag" : "Tage"} Vorlauf. Trage den nächsten ein,
            bevor er beginnt: Für einen Fälligkeitstag ohne Zyklus gilt die alte Vier-Wochen-Regel.
          </AlertDescription>
        </Alert>
      )}

      <form action={anlegen} className="rounded-md border p-4 space-y-3">
        <p className="text-sm font-medium">Nächsten Zyklus anlegen</p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="zyklus-von">Erster Tag</Label>
            <Input
              id="zyklus-von"
              name="starts_on"
              type="date"
              value={von}
              onChange={(e) => beginnGeaendert(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="zyklus-bis">Letzter Tag</Label>
            <Input
              id="zyklus-bis"
              name="ends_on"
              type="date"
              value={bis}
              onChange={(e) => setBis(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={laeuft}>
            {laeuft ? "Wird angelegt…" : "Zyklus anlegen"}
          </Button>
        </div>

        {/* Die Rechnung offengelegt: Wer sie nachvollziehen kann, kann sie auch
            überschreiben. */}
        {rechnung && (
          <p className="text-sm text-muted-foreground" data-testid="zyklus-rechnung">
            Vorgeschlagen: vier Kurswochen wären der {formatDate(rechnung.ohneSchliesstage)}
            {rechnung.schliesstage > 0
              ? `, dazu ${rechnung.schliesstage} eingetragene Schließtage — also der ${formatDate(rechnung.bis)}.`
              : " — in diesem Zeitraum sind keine Schließtage eingetragen."}
            {abweichend && (
              <span className="block font-medium text-amber-700 dark:text-amber-500">
                Dein Ende weicht davon ab: {formatDate(bis)}. Gewollt, wenn du es selbst gesetzt
                hast.
              </span>
            )}
          </p>
        )}

        {offeneLuecke > 0 && (
          <Alert data-testid="zyklus-luecke-warnung">
            <AlertDescription>
              Zwischen dem letzten Zyklus und diesem Beginn liegen {offeneLuecke}{" "}
              {offeneLuecke === 1 ? "Tag" : "Tage"}, die zu keinem Zyklus gehören. Erlaubt — aber
              für einen Lauf an einem solchen Tag gilt die alte Vier-Wochen-Regel.
            </AlertDescription>
          </Alert>
        )}
      </form>

      {zyklen.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="zyklen-leer">
          Noch kein Zyklus eingetragen. Bis dahin stellt jeder Lastschriftlauf sich nach der alten
          Regel zusammen: vier Wochen Abstand zum letzten Einzug je Abo.
        </p>
      ) : (
        <Table data-testid="zyklen-liste">
          <TableHeader>
            <TableRow>
              <TableHead>Zeitraum</TableHead>
              <TableHead>Tage</TableHead>
              <TableHead>Zustand</TableHead>
              <TableHead className="text-right">Läufe</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {zyklen.map((z) => (
              <TableRow key={z.id}>
                <TableCell className="font-medium">
                  {formatDate(z.von)} – {formatDate(z.bis)}
                </TableCell>
                <TableCell className="tabular-nums">{z.tage}</TableCell>
                <TableCell>
                  <Badge variant={ZUSTAND_FARBE[z.zustand]}>{ZUSTAND_TEXT[z.zustand]}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{z.laeufe}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {/* Ein Zyklus mit Lauf ist unveränderlich — das verbietet die
                      Datenbank. Hier wird der Knopf gar nicht erst angeboten,
                      damit niemand gegen eine Wand läuft. */}
                  {z.laeufe === 0 ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => setZuAendern(z)}>
                        Ändern
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setZuEntfernen(z)}>
                        Entfernen
                      </Button>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">abgerechnet</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={zuAendern !== null} onOpenChange={(o) => !o && !laeuft && setZuAendern(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Zyklus ändern</DialogTitle>
            <DialogDescription>
              Meist, weil eine Schließung nachträglich eingetragen wurde und das Ende später liegt.
            </DialogDescription>
          </DialogHeader>
          {zuAendern && (
            <form action={aendern} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="aendern-von">Erster Tag</Label>
                <Input
                  id="aendern-von"
                  name="starts_on"
                  type="date"
                  defaultValue={zuAendern.von}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="aendern-bis">Letzter Tag</Label>
                <Input
                  id="aendern-bis"
                  name="ends_on"
                  type="date"
                  defaultValue={zuAendern.bis}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={laeuft}>
                  {laeuft ? "Wird gespeichert…" : "Speichern"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={zuEntfernen !== null} onOpenChange={(o) => !o && setZuEntfernen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zyklus entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {zuEntfernen && (
                <>
                  {formatDate(zuEntfernen.von)} – {formatDate(zuEntfernen.bis)}. Für Tage
                  ohne Zyklus gilt die alte Vier-Wochen-Regel.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => zuEntfernen && entfernen(zuEntfernen)}>
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
