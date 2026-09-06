"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

function euro(betrag: number): string {
  return betrag.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

export type PositionsErgebnis = { error: string } | { success: true };

/** Ein Abo oder Ticket, das dieser Lauf noch nicht erfasst hat. */
export type OffenePosition = {
  /** Abo- oder Ticket-Kennung — welche, sagt `art`. */
  id: string;
  art: "abo" | "ticket";
  kundenname: string;
  bezeichnung: string;
  vorschlagsbetrag: number;
};

/**
 * Den Betrag einer Entwurfsposition ändern.
 *
 * Der häufigste Anlass für dieses ganze Vorhaben: Der Abo-Preis wurde nicht
 * nachgeführt. Deshalb steht der bisherige Betrag im Feld und ist markiert —
 * überschreiben, fertig.
 */
export function BetragDialog({
  offen,
  onOffenChange,
  kundenname,
  bisher,
  onBestaetigen,
}: {
  offen: boolean;
  onOffenChange: (offen: boolean) => void;
  kundenname: string;
  bisher: number;
  onBestaetigen: (betrag: number) => Promise<PositionsErgebnis>;
}) {
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  // Beim Öffnen den bisherigen Betrag vorlegen. Ein leeres Feld zwänge dazu,
  // den unveränderten Teil abzutippen.
  useEffect(() => {
    if (offen) {
      setEingabe(bisher.toFixed(2).replace(".", ","));
      setFehler(null);
    }
  }, [offen, bisher]);

  const fehlerListe = pruefePositionsbetrag(eingabe);
  const zuHoch = fehlerListe.includes("betrag_zu_hoch");
  const neuerBetrag = betragAusEingabe(eingabe);
  const unveraendert = fehlerListe.length === 0 && neuerBetrag === bisher;

  async function bestaetigen() {
    setFehler(null);
    setLaeuft(true);
    try {
      const ergebnis = await onBestaetigen(neuerBetrag);
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      onOffenChange(false);
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Dialog open={offen} onOpenChange={onOffenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Betrag ändern</DialogTitle>
          <DialogDescription>
            {kundenname} — bisher {euro(bisher)}. Die Änderung gilt nur für diesen Lauf; der
            Abo-Preis bleibt, wie er ist.
          </DialogDescription>
        </DialogHeader>

        {fehler && (
          <Alert variant="destructive">
            <AlertDescription>{fehler}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="position-betrag">Neuer Betrag</Label>
          <Input
            id="position-betrag"
            inputMode="decimal"
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            placeholder="0,00"
            autoFocus
          />
          {zuHoch && (
            <p className="text-sm text-destructive">
              Höchstens {euro(POSITION_BETRAG_MAX)}. Bei einem höheren Betrag ist ein Vertipper
              wahrscheinlicher als eine echte Abbuchung.
            </p>
          )}
        </div>

        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Verrechnetes Guthaben wird zurückgegeben und gegen den neuen Betrag neu verrechnet.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOffenChange(false)} disabled={laeuft}>
            Abbrechen
          </Button>
          <Button onClick={bestaetigen} disabled={laeuft || fehlerListe.length > 0 || unveraendert}>
            {laeuft ? "Wird gespeichert…" : "Betrag ändern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Eine übersehene Position nachtragen.
 *
 * Die Auswahl zeigt nur, was dieser Lauf noch nicht erfasst hat und was ein
 * gültiges Mandat besitzt — ohne Mandat gibt es keine IBAN, und ohne IBAN
 * keine Position. Das ist keine Entwurfsentscheidung, sondern eine Folge des
 * Schemas.
 */
export function PositionHinzufuegenDialog({
  offen,
  onOffenChange,
  offenePositionen,
  onBestaetigen,
}: {
  offen: boolean;
  onOffenChange: (offen: boolean) => void;
  offenePositionen: OffenePosition[];
  onBestaetigen: (auswahl: OffenePosition, betrag: number) => Promise<PositionsErgebnis>;
}) {
  const [gewaehlteId, setGewaehlteId] = useState<string>("");
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const gewaehlt = offenePositionen.find((p) => p.id === gewaehlteId) ?? null;

  useEffect(() => {
    if (offen) {
      setGewaehlteId("");
      setEingabe("");
      setFehler(null);
    }
  }, [offen]);

  // Der Vorschlag kommt aus dem Abo, bleibt aber überschreibbar. Fest
  // übernommen würde er genau den Fehler wiederholen, der dieses Vorhaben
  // ausgelöst hat.
  function waehlen(id: string) {
    setGewaehlteId(id);
    const treffer = offenePositionen.find((p) => p.id === id);
    if (treffer) setEingabe(treffer.vorschlagsbetrag.toFixed(2).replace(".", ","));
  }

  const fehlerListe = pruefePositionsbetrag(eingabe);
  const zuHoch = fehlerListe.includes("betrag_zu_hoch");

  async function bestaetigen() {
    if (!gewaehlt) return;
    setFehler(null);
    setLaeuft(true);
    try {
      const ergebnis = await onBestaetigen(gewaehlt, betragAusEingabe(eingabe));
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      onOffenChange(false);
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Dialog open={offen} onOpenChange={onOffenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Position hinzufügen</DialogTitle>
          <DialogDescription>
            Aktive Abos und SEPA-Tickets mit gültigem Mandat, die in diesem Lauf noch fehlen.
          </DialogDescription>
        </DialogHeader>

        {fehler && (
          <Alert variant="destructive">
            <AlertDescription>{fehler}</AlertDescription>
          </Alert>
        )}

        {offenePositionen.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Dieser Lauf hat nichts übersehen — alle abbuchbaren Abos und Tickets stehen bereits
            darin.
          </p>
        ) : (
          <>
            <RadioGroup value={gewaehlteId} onValueChange={waehlen} className="gap-0">
              {offenePositionen.map((position) => (
                <Label
                  key={position.id}
                  htmlFor={`offen-${position.id}`}
                  className="flex cursor-pointer items-center gap-3 rounded-md border-b px-1 py-3 font-normal last:border-b-0 hover:bg-muted/50"
                >
                  <RadioGroupItem value={position.id} id={`offen-${position.id}`} />
                  <span className="flex-1">
                    <span className="block font-medium">{position.kundenname}</span>
                    <span className="block text-sm text-muted-foreground">
                      {position.bezeichnung}
                    </span>
                  </span>
                  <span className="tabular-nums text-sm text-muted-foreground">
                    {euro(position.vorschlagsbetrag)}
                  </span>
                </Label>
              ))}
            </RadioGroup>

            {gewaehlt && (
              <div className="space-y-2">
                <Label htmlFor="neue-position-betrag">Betrag</Label>
                <Input
                  id="neue-position-betrag"
                  inputMode="decimal"
                  value={eingabe}
                  onChange={(e) => setEingabe(e.target.value)}
                  placeholder="0,00"
                />
                {zuHoch && (
                  <p className="text-sm text-destructive">
                    Höchstens {euro(POSITION_BETRAG_MAX)}.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOffenChange(false)} disabled={laeuft}>
            Abbrechen
          </Button>
          <Button onClick={bestaetigen} disabled={laeuft || !gewaehlt || fehlerListe.length > 0}>
            {laeuft ? "Wird hinzugefügt…" : "Hinzufügen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
