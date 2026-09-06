"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { betragAusEingabe, pruefeGutschrift } from "@/lib/invoices";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function euro(betrag: number): string {
  return betrag.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

export type BelegErgebnis = { error: string } | { success: true };

/**
 * Eine Rechnung vollständig aufheben.
 *
 * Der Betrag ist bewusst **nicht** eingebbar: Ein Vollstorno über einen
 * anderen Betrag als die Rechnungssumme gibt es nicht, und ein Eingabefeld
 * dafür lädt nur zu Tippfehlern ein. Wer einen Teilbetrag erstatten will,
 * nimmt die Gutschrift.
 */
export function StornoDialog({
  offen,
  onOffenChange,
  rechnungsnummer,
  betrag,
  onBestaetigen,
}: {
  offen: boolean;
  onOffenChange: (offen: boolean) => void;
  rechnungsnummer: string;
  /** Der noch offene Betrag — nach einer Teilgutschrift weniger als die Rechnung. */
  betrag: number;
  onBestaetigen: (grund: string) => Promise<BelegErgebnis>;
}) {
  const [grund, setGrund] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const grundFehlt = grund.trim().length === 0;

  async function bestaetigen() {
    setFehler(null);
    setLaeuft(true);
    try {
      const ergebnis = await onBestaetigen(grund.trim());
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      setGrund("");
      onOffenChange(false);
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Dialog open={offen} onOpenChange={onOffenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Rechnung stornieren</DialogTitle>
          <DialogDescription>
            Von {rechnungsnummer} werden {euro(betrag)} durch einen eigenen Beleg aufgehoben — was
            von dieser Rechnung noch offen ist. Die Rechnung selbst bleibt unverändert bestehen; das
            verlangt die Buchhaltung.
          </DialogDescription>
        </DialogHeader>

        {fehler && (
          <Alert variant="destructive">
            <AlertDescription>{fehler}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="storno-grund">Grund</Label>
          <Textarea
            id="storno-grund"
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            placeholder="z. B. Kurs doppelt abgerechnet"
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Steht auf dem Beleg. Ein halbes Jahr später weiß sonst niemand mehr, warum.
          </p>
        </div>

        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {euro(betrag)} werden dem Kunden als Guthaben gutgeschrieben und mit der nächsten
          Abbuchung verrechnet.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOffenChange(false)} disabled={laeuft}>
            Abbrechen
          </Button>
          <Button onClick={bestaetigen} disabled={laeuft || grundFehlt}>
            {laeuft ? "Wird storniert…" : "Stornieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Einen Teilbetrag erstatten.
 *
 * `restbetrag` ist die Rechnungssumme abzüglich bereits erteilter
 * Gutschriften — mehrere Gutschriften zusammen dürfen die Rechnung nicht
 * übersteigen. Die Oberfläche verhindert das früh; die verbindliche Prüfung
 * sitzt auf dem Server, weil dieser Dialog nicht der einzige Weg hierher ist.
 */
export function GutschriftDialog({
  offen,
  onOffenChange,
  rechnungsnummer,
  restbetrag,
  onBestaetigen,
}: {
  offen: boolean;
  onOffenChange: (offen: boolean) => void;
  rechnungsnummer: string;
  restbetrag: number;
  onBestaetigen: (betrag: number, grund: string) => Promise<BelegErgebnis>;
}) {
  const [eingabe, setEingabe] = useState("");
  const [grund, setGrund] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  // Dieselbe Regel, die auch der Server anwendet — siehe pruefeGutschrift.
  const betrag = betragAusEingabe(eingabe);
  const fehlerListe = pruefeGutschrift(eingabe, restbetrag, grund);
  const zuHoch = fehlerListe.includes("betrag_zu_hoch");

  async function bestaetigen() {
    setFehler(null);
    setLaeuft(true);
    try {
      const ergebnis = await onBestaetigen(betrag, grund.trim());
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      setEingabe("");
      setGrund("");
      onOffenChange(false);
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Dialog open={offen} onOpenChange={onOffenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Gutschrift erstellen</DialogTitle>
          <DialogDescription>
            Zu {rechnungsnummer}. Höchstens {euro(restbetrag)} — so viel ist von dieser Rechnung
            noch nicht gutgeschrieben.
          </DialogDescription>
        </DialogHeader>

        {fehler && (
          <Alert variant="destructive">
            <AlertDescription>{fehler}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="gutschrift-betrag">Betrag</Label>
          <Input
            id="gutschrift-betrag"
            inputMode="decimal"
            value={eingabe}
            onChange={(e) => setEingabe(e.target.value)}
            placeholder="0,00"
          />
          {zuHoch && (
            <p className="text-sm text-destructive">
              Höchstens {euro(restbetrag)}. Für den vollen Betrag nimm den Storno.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="gutschrift-grund">Grund</Label>
          <Textarea
            id="gutschrift-grund"
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            placeholder="z. B. vier Wochen krank, anteilige Erstattung"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOffenChange(false)} disabled={laeuft}>
            Abbrechen
          </Button>
          <Button onClick={bestaetigen} disabled={laeuft || fehlerListe.length > 0}>
            {laeuft ? "Wird erstellt…" : "Gutschrift erstellen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
