"use client";

import { useState, useTransition } from "react";
import { ferienAnlegen, ferienEntfernen } from "@/lib/actions/admin/ferien";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
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
import { formatShortDate } from "@/lib/formatting";

export type FerienZeile = { id: string; name: string; von: string; bis: string };

/**
 * Ferien verwalten (PROJ-51).
 *
 * Ein Eintrag lässt alle Kurstermine im Zeitraum ausfallen — statt bei zwanzig
 * Kursen je zwei Wochen einzeln einzutragen.
 *
 * Die einzeln gepflegten Ausfalltage bleiben davon unberührt. Das ist wichtig
 * beim Löschen: Wer die Weihnachtsferien entfernt, soll nicht nebenbei den
 * Abend mitlöschen, an dem der Lehrer krank war.
 */
export function FerienManager({ ferien }: { ferien: FerienZeile[] }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [zuEntfernen, setZuEntfernen] = useState<FerienZeile | null>(null);
  const [laeuft, starte] = useTransition();

  function anlegen(formData: FormData) {
    setFehler(null);
    starte(async () => {
      const ergebnis = await ferienAnlegen(formData);
      if ("error" in ergebnis) setFehler(ergebnis.error);
    });
  }

  function entfernen(zeile: FerienZeile) {
    setFehler(null);
    starte(async () => {
      const ergebnis = await ferienEntfernen(zeile.id);
      setZuEntfernen(null);
      if ("error" in ergebnis) setFehler(ergebnis.error);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold">Ferien</h2>
        <p className="text-sm text-muted-foreground">
          In diesen Zeiträumen findet kein Kurs statt. Ein Eintrag gilt für alle Kurse — die
          einzelnen Ausfalltage an den Kursen bleiben davon unberührt.
        </p>
      </div>

      {fehler && (
        <Alert variant="destructive">
          <AlertDescription>{fehler}</AlertDescription>
        </Alert>
      )}

      <form action={anlegen} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="min-w-[14rem] flex-1">
          <Label htmlFor="ferien-name">Anlass</Label>
          <Input id="ferien-name" name="name" placeholder="Weihnachtsferien" required />
        </div>
        <div>
          <Label htmlFor="ferien-von">Von</Label>
          <Input id="ferien-von" name="starts_on" type="date" required />
        </div>
        <div>
          <Label htmlFor="ferien-bis">Bis</Label>
          <Input id="ferien-bis" name="ends_on" type="date" required />
        </div>
        <Button type="submit" disabled={laeuft}>
          Ferien eintragen
        </Button>
      </form>

      {ferien.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Keine Ferien eingetragen. Alle Kurse finden nach Plan statt.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Anlass</TableHead>
              <TableHead>Von</TableHead>
              <TableHead>Bis</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ferien.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell className="tabular-nums">{formatShortDate(f.von)}</TableCell>
                <TableCell className="tabular-nums">{formatShortDate(f.bis)}</TableCell>
                <TableCell className="text-right">
                  {/* min-h-11 = 44 px, die Projektnorm für Tippflächen.
                      `size="sm"` allein wären 36 px (QA 2026-09-11, BUG-6). */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setZuEntfernen(f)}
                    disabled={laeuft}
                  >
                    Entfernen
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={zuEntfernen !== null} onOpenChange={(o) => !o && setZuEntfernen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ferien entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Kurstermine in diesem Zeitraum finden danach wieder statt. Einzeln eingetragene
              Ausfalltage bleiben bestehen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={laeuft}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => zuEntfernen && entfernen(zuEntfernen)}
              disabled={laeuft}
            >
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
