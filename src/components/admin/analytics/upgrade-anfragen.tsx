"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  confirmFlatrateUpgrade,
  declineFlatrateUpgrade,
} from "@/lib/actions/admin/flatrate-upgrade";

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

function datum(wert: string): string {
  return new Date(`${wert}T00:00:00`).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export type AnrechnungsZeile = {
  bezeichnung: string;
  betrag: number;
  eingang: string;
  art: "lastschrift" | "barzahlung";
};

export type UpgradeAnfrage = {
  aboId: string;
  kundeId: string;
  kundeName: string;
  kursName: string | null;
  bisher: number | null;
  angefragtAm: string;
  /** PROJ-88: Was im laufenden Zyklus tatsächlich bezahlt wurde. */
  anrechnung: AnrechnungsZeile[];
  /** PROJ-88: Welche weiteren Kursabos mit der Bestätigung enden. */
  endendeAbos: string[];
};

/**
 * Offene Upgrade-Anfragen (PROJ-87).
 *
 * Im Dashboard, weil der Betreiber es täglich offen hat und die Anfrage eine
 * Handlung von einem Druck ist. Eine eigene Seite wäre eine, die man vergisst.
 *
 * Beide Preise stehen als Knopf da — der Tarif ist die einzige Entscheidung,
 * die hier getroffen wird. Daneben die Differenz, die in den nächsten Lauf
 * geht, damit niemand sie überschlagen muss.
 */
export function UpgradeAnfragen({
  anfragen,
  flatrateNormal,
  flatrateStudent,
}: {
  anfragen: UpgradeAnfrage[];
  flatrateNormal: number | null;
  flatrateStudent: number | null;
}) {
  const router = useRouter();
  const [fehler, setFehler] = useState<string | null>(null);
  const [laufendeId, setLaufendeId] = useState<string | null>(null);
  // Welche Anfrage gerade einen eigenen Differenzbetrag bekommt, und welchen.
  const [eigeneZeile, setEigeneZeile] = useState<string | null>(null);
  const [eigenerBetrag, setEigenerBetrag] = useState("");

  if (anfragen.length === 0) return null;

  async function tun(aboId: string, aufgabe: () => Promise<{ error: string } | unknown>) {
    setLaufendeId(aboId);
    setFehler(null);
    try {
      const ergebnis = await aufgabe();
      if (ergebnis && typeof ergebnis === "object" && "error" in ergebnis) {
        setFehler((ergebnis as { error: string }).error);
        return;
      }
      router.refresh();
    } finally {
      setLaufendeId(null);
    }
  }

  /**
   * Die Differenz gegen das **tatsächlich Bezahlte**, nicht gegen den Preis
   * eines einzelnen Abos (PROJ-88). Wer zwei Kurse einzeln zahlt, hat schon
   * beides bezahlt; wer nichts bezahlt hat, zahlt die ganze Differenz.
   */
  function differenzWert(anfrage: UpgradeAnfrage, neu: number | null): number {
    if (neu === null) return 0;
    const angerechnet = anfrage.anrechnung.reduce((s, z) => s + z.betrag, 0);
    return Math.max(Math.round((neu - angerechnet) * 100) / 100, 0);
  }

  function differenz(anfrage: UpgradeAnfrage, neu: number | null): string {
    if (neu === null) return "—";
    // Ist ein eigener Betrag eingetragen, steht **der** auf dem Knopf: Sonst
    // bestätigte der Betreiber eine Zahl und sähe eine andere.
    if (eigeneZeile === anfrage.aboId && eigenerBetrag.trim() !== "") {
      const zahl = Number(eigenerBetrag.trim().replace(",", "."));
      if (Number.isFinite(zahl) && zahl >= 0) return EUR.format(zahl);
    }
    return EUR.format(differenzWert(anfrage, neu));
  }

  /** Der Betrag, der mit dem Druck mitgeht — leer heißt „rechne selbst". */
  function mitgegebenerBetrag(anfrage: UpgradeAnfrage): string | undefined {
    return eigeneZeile === anfrage.aboId ? eigenerBetrag : undefined;
  }

  return (
    <Card role="region" aria-labelledby="upgrade-anfragen">
      <CardHeader>
        <CardTitle id="upgrade-anfragen" className="font-heading text-lg flex items-center gap-2">
          <ArrowUpCircle className="h-5 w-5 text-primary" />
          Upgrade auf Flatrate
          <Badge variant="outline" className="align-middle">
            {anfragen.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Mit der Bestätigung gilt die Flatrate sofort, und die Differenz kommt in den nächsten
          Lastschriftlauf.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {fehler && (
          <Alert variant="destructive">
            <AlertDescription>{fehler}</AlertDescription>
          </Alert>
        )}

        {flatrateNormal === null && (
          <Alert>
            <AlertDescription>
              In der Preisliste fehlt der Flatrate-Preis — ohne ihn lässt sich keine Anfrage
              bestätigen.
            </AlertDescription>
          </Alert>
        )}

        <ul className="space-y-3">
          {anfragen.map((a) => {
            const laeuft = laufendeId === a.aboId;
            return (
              <li key={a.aboId} className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium">
                    <Link href={`/admin/kunden/${a.kundeId}`} className="hover:underline">
                      {a.kundeName}
                    </Link>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {a.kursName ?? "Kursabo"} ·{" "}
                    <span className="tabular-nums">
                      {a.bisher === null ? "kein Preis" : EUR.format(a.bisher)}
                    </span>{" "}
                    bisher
                  </p>
                </div>

                {/* PROJ-88: Die Rechnung offen hingeschrieben. Ferien können
                    einen Zyklus verlängern (PROJ-70) — ein deshalb älterer
                    Einzug fällt aus dem 28-Tage-Fenster und wird nicht
                    angerechnet. Deshalb steht hier, was angerechnet wird und
                    wann es einging: Sieht es falsch aus, lieber ablehnen und
                    von Hand machen. */}
                {a.anrechnung.length > 0 ? (
                  <ul className="text-sm text-muted-foreground">
                    {a.anrechnung.map((z, i) => (
                      <li key={`${a.aboId}-${i}`}>
                        angerechnet: <span className="tabular-nums">{EUR.format(z.betrag)}</span> —{" "}
                        {z.bezeichnung}, {z.art === "barzahlung" ? "bar" : "Einzug"} vom{" "}
                        {datum(z.eingang)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-amber-700 dark:text-amber-500">
                    Im laufenden Zyklus ist nichts eingegangen — die ganze Differenz kommt dazu.
                  </p>
                )}

                {a.endendeAbos.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Endet mit der Bestätigung: {a.endendeAbos.join(", ")} — die Kurse bleiben als
                    Plätze an der Flatrate.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={laeuft || flatrateNormal === null}
                    onClick={() =>
                      void tun(a.aboId, () =>
                        confirmFlatrateUpgrade(a.aboId, false, mitgegebenerBetrag(a))
                      )
                    }
                    aria-label={`Upgrade von ${a.kundeName} zum Normaltarif bestätigen`}
                  >
                    {laeuft
                      ? "…"
                      : `Normal ${flatrateNormal === null ? "" : EUR.format(flatrateNormal)} (+${differenz(a, flatrateNormal)})`}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={laeuft || flatrateStudent === null}
                    onClick={() =>
                      void tun(a.aboId, () =>
                        confirmFlatrateUpgrade(a.aboId, true, mitgegebenerBetrag(a))
                      )
                    }
                    aria-label={`Upgrade von ${a.kundeName} zum Studierendentarif bestätigen`}
                  >
                    {laeuft
                      ? "…"
                      : `Studierende ${flatrateStudent === null ? "—" : EUR.format(flatrateStudent)} (+${differenz(a, flatrateStudent)})`}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={laeuft}
                    onClick={() => void tun(a.aboId, () => declineFlatrateUpgrade(a.aboId))}
                    aria-label={`Upgrade von ${a.kundeName} ablehnen`}
                  >
                    Ablehnen
                  </Button>
                </div>

                {/* Die Anrechnung rechnet, was eingegangen ist — das stimmt
                    meistens. Bei zwei Abos mit verschiedenen Zyklen oder einem
                    durch Ferien verlängerten Zyklus stimmt es nicht, und dann
                    braucht die Zahl einen Menschen. Leer heißt „rechne
                    selbst". */}
                {eigeneZeile === a.aboId ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label htmlFor={`differenz-${a.aboId}`} className="text-xs">
                        Differenz statt der gerechneten
                      </Label>
                      <Input
                        id={`differenz-${a.aboId}`}
                        value={eigenerBetrag}
                        onChange={(e) => setEigenerBetrag(e.target.value)}
                        inputMode="decimal"
                        className="h-8 w-28 text-right"
                        aria-label={`Differenz für ${a.kundeName}`}
                        autoFocus
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEigeneZeile(null);
                        setEigenerBetrag("");
                        setFehler(null);
                      }}
                    >
                      Gerechneten Betrag nehmen
                    </Button>
                    <p className="w-full text-xs text-muted-foreground">
                      0 ist erlaubt und heißt „nichts dazu“. Der Betrag steht auf den Knöpfen
                      darüber, bevor du drückst.
                    </p>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="px-0"
                    onClick={() => {
                      setEigeneZeile(a.aboId);
                      setEigenerBetrag(String(differenzWert(a, flatrateNormal)));
                      setFehler(null);
                    }}
                    aria-label={`Differenz für ${a.kundeName} anpassen`}
                  >
                    Differenz anpassen
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
