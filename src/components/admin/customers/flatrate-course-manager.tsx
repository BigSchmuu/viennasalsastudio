"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { danceRoleLabel, danceRoleOptions } from "@/lib/constants/booking";
import { adminKursplatzHinzufuegen, adminKursplatzEntfernen } from "@/lib/actions/flatrate";

export type FlatrateKursplatz = {
  kursId: string;
  kursName: string;
  tanzrolle: string | null;
};

/**
 * Die Kursliste einer Flatrate, vom Betreiber aus (PROJ-50).
 *
 * Derselbe Vorgang wie beim Kunden, nur mit einem Unterschied: Der Betreiber
 * darf die Kursgrenze überschreiben. Ein Kurs ist manchmal für einen Menschen
 * voll und für einen anderen nicht — diese Entscheidung gehört ihm. Dem Kunden
 * gerade nicht, sonst ist die Grenze keine.
 *
 * Erscheint nur bei Kunden mit laufender Flatrate. Ein kursgebundenes Abo trägt
 * seinen Kurs weiterhin selbst; dort gibt es nichts zu verwalten.
 */
export function FlatrateCourseManager({
  customerId,
  kursplaetze,
  kurse,
}: {
  customerId: string;
  kursplaetze: FlatrateKursplatz[];
  kurse: { id: string; name: string }[];
}) {
  const [kursId, setKursId] = useState("");
  const [rolle, setRolle] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [grenzeVoll, setGrenzeVoll] = useState(false);
  const [laeuft, starte] = useTransition();

  const belegteIds = new Set(kursplaetze.map((k) => k.kursId));
  const waehlbar = kurse.filter((k) => !belegteIds.has(k.id));

  function hinzufuegen(grenzeUebergehen: boolean) {
    if (!kursId) return;
    setFehler(null);
    starte(async () => {
      const ergebnis = await adminKursplatzHinzufuegen(customerId, kursId, rolle, grenzeUebergehen);
      if ("ok" in ergebnis) {
        setKursId("");
        setRolle("");
        setGrenzeVoll(false);
        return;
      }
      if ("full" in ergebnis) {
        // Nicht abweisen, sondern fragen: Der Betreiber darf das entscheiden,
        // er soll es nur bewusst tun.
        setGrenzeVoll(true);
        return;
      }
      setFehler("error" in ergebnis ? ergebnis.error : "Das hat nicht geklappt.");
    });
  }

  function entfernen(kurs: FlatrateKursplatz) {
    setFehler(null);
    starte(async () => {
      const ergebnis = await adminKursplatzEntfernen(customerId, kurs.kursId);
      if (!("ok" in ergebnis)) {
        setFehler("error" in ergebnis ? ergebnis.error : "Das hat nicht geklappt.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium">Kurse dieser Flatrate</p>
        <p className="text-sm text-muted-foreground">
          Änderungen wirken sofort — es entsteht kein zweites Abo und keine zusätzliche Abbuchung.
        </p>
      </div>

      {fehler && (
        <Alert variant="destructive">
          <AlertDescription>{fehler}</AlertDescription>
        </Alert>
      )}

      {kursplaetze.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Dieser Kunde ist über seine Flatrate in keinem Kurs eingeschrieben.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {kursplaetze.map((k) => (
            <li key={k.kursId} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <span className="font-medium">
                {k.kursName}
                {k.tanzrolle && (
                  <Badge variant="secondary" className="ml-2">
                    {danceRoleLabel(k.tanzrolle)}
                  </Badge>
                )}
              </span>
              <Button variant="ghost" size="sm" onClick={() => entfernen(k)} disabled={laeuft}>
                Entfernen
              </Button>
            </li>
          ))}
        </ul>
      )}

      {grenzeVoll && (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>Dieser Kurs ist voll. Trotzdem eintragen?</span>
            <Button size="sm" onClick={() => hinzufuegen(true)} disabled={laeuft}>
              Trotzdem eintragen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setGrenzeVoll(false)} disabled={laeuft}>
              Abbrechen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[14rem] flex-1">
          <Select value={kursId} onValueChange={(v) => { setKursId(v); setGrenzeVoll(false); }}>
            <SelectTrigger>
              <SelectValue placeholder="Kurs wählen…" />
            </SelectTrigger>
            <SelectContent>
              {waehlbar.map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[10rem]">
          <Select value={rolle} onValueChange={setRolle}>
            <SelectTrigger>
              <SelectValue placeholder="Tanzrolle (optional)" />
            </SelectTrigger>
            <SelectContent>
              {danceRoleOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => hinzufuegen(false)} disabled={laeuft || !kursId}>
          Kurs hinzufügen
        </Button>
      </div>
    </div>
  );
}
