"use client";

import { useState, useTransition } from "react";
import {
  kursUmwandlungVormerken,
  kursUmwandlungZuruecknehmen,
} from "@/lib/actions/admin/courses";
import { levelValues, levelLabel } from "@/lib/constants/levels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatShortDate } from "@/lib/formatting";

/**
 * „Kurs umwandeln" (PROJ-51).
 *
 * Aus Beginner 1 wird Beginner 2: **derselbe** Kurs, dieselben Kunden, nur
 * Name und Level ändern sich. Deshalb eine Vormerkung und kein neuer Kurs —
 * Abos, Kursplätze, Anwesenheitshistorie und Notizen hängen an der
 * Kurs-Kennung und bleiben ohne Zutun daran.
 *
 * Wirksam wird sie zum Stichtag, vollzogen vom nächtlichen Lauf. Bis dahin
 * lässt sie sich zurücknehmen — und der Stundenplan kündigt sie an.
 *
 * Der Preis bleibt außen vor: Eine Preisänderung an einem bestehenden Vertrag
 * ist etwas anderes als ein neuer Kursname und gehört ausdrücklich angekündigt.
 */
export function CourseConversionSection({
  courseId,
  aktuellerName,
  vormerkung,
}: {
  courseId: string;
  aktuellerName: string;
  vormerkung: { name: string; level: string | null; datum: string; laeuftBis: string | null } | null;
}) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  function vormerken(formData: FormData) {
    setFehler(null);
    starte(async () => {
      const ergebnis = await kursUmwandlungVormerken(courseId, formData);
      if ("error" in ergebnis) setFehler(ergebnis.error);
    });
  }

  function zuruecknehmen() {
    setFehler(null);
    starte(async () => {
      const ergebnis = await kursUmwandlungZuruecknehmen(courseId);
      if ("error" in ergebnis) setFehler(ergebnis.error);
    });
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <div>
        <h3 className="font-medium">Kurs umwandeln</h3>
        <p className="text-sm text-muted-foreground">
          Für die nächste Staffel: Der Kurs bekommt zum Stichtag einen neuen Namen, ein neues Level
          und einen neuen Zeitraum. Die eingeschriebenen Kunden bleiben dabei, ebenso Anwesenheiten
          und Notizen. Der Stichtag wird zum Beginn der neuen Staffel.
        </p>
      </div>

      {fehler && (
        <Alert variant="destructive">
          <AlertDescription>{fehler}</AlertDescription>
        </Alert>
      )}

      {vormerkung ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Ab <strong>{formatShortDate(vormerkung.datum)}</strong> heißt {aktuellerName} dann{" "}
              <strong>{vormerkung.name}</strong>
              {vormerkung.level ? ` (${levelLabel(vormerkung.level)})` : ""} und läuft{" "}
              {vormerkung.laeuftBis
                ? `bis ${formatShortDate(vormerkung.laeuftBis)}`
                : "unbefristet weiter"}
              .
            </span>
            <Button variant="outline" size="sm" onClick={zuruecknehmen} disabled={laeuft}>
              Vormerkung zurücknehmen
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <form action={vormerken} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <Label htmlFor="pending-name">Neuer Name</Label>
            <Input id="pending-name" name="pending_name" placeholder="Salsa Beginner 2" required />
          </div>
          <div className="min-w-[10rem]">
            <Label htmlFor="pending-level">Neues Level</Label>
            <Select name="pending_level" required>
              <SelectTrigger id="pending-level">
                <SelectValue placeholder="Level wählen…" />
              </SelectTrigger>
              <SelectContent>
                {levelValues.map((l) => (
                  <SelectItem key={l} value={l}>
                    {levelLabel(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pending-date">Ab wann</Label>
            <Input id="pending-date" name="pending_effective_date" type="date" required />
          </div>
          <div>
            {/* Ohne dieses Feld behielt der Kurs das Ende der *alten* Staffel
                und verschwand am Tag seiner Umwandlung aus dem Stundenplan
                (QA 2026-09-11, BUG-1). Leer heißt unbefristet. */}
            <Label htmlFor="pending-bis">Neue Staffel läuft bis (optional)</Label>
            <Input id="pending-bis" name="pending_runs_until" type="date" />
          </div>
          <Button type="submit" disabled={laeuft}>
            Umwandlung vormerken
          </Button>
        </form>
      )}
    </div>
  );
}
