"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { fuegeLaufPositionHinzu } from "@/lib/actions/admin/sepa-collections";
import { KundenLink } from "@/components/admin/customers/kunden-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  POSITION_BETRAG_MAX,
  betragAusEingabe,
  pruefePositionsbetrag,
} from "@/lib/sepa/laeufe";

/** Ein Abo, das dieser Lauf hätte einziehen können und ausgelassen hat. */
export type AusgelassenesAbo = {
  aboId: string;
  kundeId: string;
  kundenname: string;
  bezeichnung: string;
  /** Der Vorschlag für den Betrag — `null`, wenn am Abo kein Preis hängt. */
  preis: number | null;
  /** Der Grund als fertiger Satz; gebildet in `@/lib/sepa/ausgelassen`. */
  grundText: string;
  /** Ein Grund, der auf einen Datenfehler zeigt, nicht auf eine Regel. */
  datenfehler: boolean;
};

function euro(betrag: number): string {
  return betrag.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

/**
 * PROJ-103: Welche Abos dieser Lauf ausgelassen hat — mit Namen.
 *
 * Vorher stand hier ein Satz mit einer Zahl und zwei Möglichkeiten: „1 Abo
 * nicht aufgenommen. Entweder … oder …“. Um zu erfahren, **welches**, musste
 * der Betreiber den Dialog „Position hinzufügen“ öffnen und dort zwischen
 * allem, was dem Lauf fehlt, die Zeilen mit einem Hinweis heraussuchen.
 * Beurteilen konnte er den Fall erst danach.
 *
 * Jetzt steht jedes ausgelassene Abo hier: Kunde, Abo, Grund, Betrag — und der
 * Weg, es trotzdem aufzunehmen, in derselben Zeile. Beurteilen und Entscheiden
 * liegen damit an einer Stelle.
 *
 * Der Kasten erscheint nur am Entwurf und nur, wenn es etwas zu sagen gibt:
 * Eine Warnung, die immer da ist, bedeutet nichts mehr.
 */
export function AusgelasseneAbos({
  runId,
  abos,
}: {
  runId: string;
  abos: AusgelassenesAbo[];
}) {
  const router = useRouter();
  const [aufnehmen, setAufnehmen] = useState<AusgelassenesAbo | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  if (abos.length === 0) return null;

  function oeffne(abo: AusgelassenesAbo) {
    setAufnehmen(abo);
    // Der Preis des Abos als Vorschlag — fest übernommen würde er den Betreiber
    // um die Entscheidung bringen, die der Grund gerade von ihm verlangt.
    // Fehlt er, bleibt das Feld leer, und ohne Betrag geht es nicht weiter.
    setEingabe(abo.preis === null ? "" : abo.preis.toFixed(2).replace(".", ","));
    setFehler(null);
  }

  const fehlerListe = pruefePositionsbetrag(eingabe);
  const zuHoch = fehlerListe.includes("betrag_zu_hoch");

  async function bestaetigen() {
    if (!aufnehmen) return;
    setFehler(null);
    setLaeuft(true);
    try {
      const ergebnis = await fuegeLaufPositionHinzu(
        runId,
        { id: aufnehmen.aboId, art: "abo" },
        betragAusEingabe(eingabe)
      );
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      toast.success("Position hinzugefügt");
      setAufnehmen(null);
      router.refresh();
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div
      className="space-y-3 rounded-card border border-border bg-muted/50 px-4 py-3 text-sm"
      data-testid="ausgelassene-abos"
    >
      <p>
        <span className="font-medium">
          {abos.length} {abos.length === 1 ? "Abo" : "Abos"} nicht aufgenommen.
        </span>{" "}
        Hier stehen sie mit dem Grund. Wer trotzdem einziehen will, nimmt sie einzeln auf — der
        Grund steht dabei noch einmal daneben.
      </p>

      <ul className="divide-y divide-border">
        {abos.map((abo) => (
          <li
            key={abo.aboId}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 first:pt-0 last:pb-0"
          >
            <span className="min-w-[14rem] flex-1">
              <span className="block font-medium">
                <KundenLink kundeId={abo.kundeId}>{abo.kundenname}</KundenLink>
              </span>
              <span className="block text-muted-foreground">{abo.bezeichnung}</span>
              <span
                className={
                  abo.datenfehler
                    ? "block font-medium text-destructive"
                    : "block text-amber-700 dark:text-amber-500"
                }
              >
                {abo.grundText}
              </span>
            </span>
            <span className="tabular-nums text-muted-foreground">
              {abo.preis === null ? "—" : euro(abo.preis)}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => oeffne(abo)}>
              Trotzdem aufnehmen
            </Button>
          </li>
        ))}
      </ul>

      <Dialog
        open={aufnehmen !== null}
        onOpenChange={(offen) => {
          if (!offen && !laeuft) setAufnehmen(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Trotzdem aufnehmen?</DialogTitle>
            <DialogDescription>
              {aufnehmen?.kundenname} — {aufnehmen?.bezeichnung}
            </DialogDescription>
          </DialogHeader>

          {fehler && (
            <Alert variant="destructive">
              <AlertDescription>{fehler}</AlertDescription>
            </Alert>
          )}

          {/* Der Grund gehört neben die Entscheidung und nicht nur in die
              Zeile, aus der man gekommen ist: Ein Abo aufzunehmen, das der
              Lauf aus gutem Grund ausgelassen hat, ist genau der Doppeleinzug,
              den PROJ-70 verhindern soll. */}
          <p className="rounded-md bg-muted px-3 py-2">
            <span className="font-medium">Warum es fehlt: </span>
            {aufnehmen?.grundText}
          </p>

          <div className="space-y-2">
            <Label htmlFor="ausgelassen-betrag">Betrag</Label>
            <Input
              id="ausgelassen-betrag"
              inputMode="decimal"
              value={eingabe}
              onChange={(e) => setEingabe(e.target.value)}
              placeholder="0,00"
              autoFocus
            />
            {aufnehmen?.preis === null && (
              <p className="text-muted-foreground">
                Am Abo ist kein Preis hinterlegt — der Betrag muss hier eingetragen werden. Trag
                ihn danach auch am Abo nach, sonst fehlt es im nächsten Lauf wieder.
              </p>
            )}
            {zuHoch && (
              <p className="text-destructive">Höchstens {euro(POSITION_BETRAG_MAX)}.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAufnehmen(null)} disabled={laeuft}>
              Abbrechen
            </Button>
            <Button onClick={bestaetigen} disabled={laeuft || fehlerListe.length > 0}>
              {laeuft ? "Wird hinzugefügt…" : "Aufnehmen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
