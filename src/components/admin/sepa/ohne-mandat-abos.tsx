"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { legeEintragAn } from "@/lib/actions/teacher/barzahlung";
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

export type OhneMandatAbo = {
  aboId: string;
  kundeId: string;
  kundenname: string;
  bezeichnung: string;
  preis: number | null;
  text: string;
  /** Für dieses Abo steht schon ein Eintrag auf der Barzahlungsliste. */
  schonAufListe: boolean;
};

function euro(betrag: number): string {
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(betrag);
}

/**
 * Abos mit widerrufenem Mandat und offenem Beitrag (PROJ-105).
 *
 * Die dritte Liste im Entwurf. Bis hierher verschwand ein solches Abo aus
 * **beiden** anderen: keine Zeile, kein Grund, keine Zahl — und der Beitrag
 * eines ganzen Zyklus hing daran. Am 2026-11-17 ist das im Betrieb aufgefallen,
 * und nur, weil der Betreiber nachgefragt hat.
 *
 * Einziehen ist hier nicht möglich und soll es nicht sein: Gegen einen Widerruf
 * darf nicht abgebucht werden. Angeboten wird deshalb der Weg, den das Projekt
 * für genau diesen Fall schon hat — die Barzahlungsliste (PROJ-84), auf der
 * Beträge ohne Mandat liegen.
 */
export function OhneMandatAbos({ abos }: { abos: OhneMandatAbo[] }) {
  const router = useRouter();
  const [aufListe, setAufListe] = useState<OhneMandatAbo | null>(null);
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  if (abos.length === 0) return null;

  function oeffne(abo: OhneMandatAbo) {
    setAufListe(abo);
    // Der Preis als Vorschlag, nicht als Festlegung: Wie viel offen ist, weiß
    // der Betreiber — bei einem halben Zyklus ist es nicht der ganze Beitrag.
    setEingabe(abo.preis === null ? "" : abo.preis.toFixed(2).replace(".", ","));
    setFehler(null);
  }

  async function bestaetigen() {
    if (!aufListe) return;
    setFehler(null);
    setLaeuft(true);
    try {
      // Ohne Kurskennung: Die Aktion erneuert die Barzahlungsseite in jedem
      // Fall und die Lehreransicht nur, wenn ein Kurs genannt ist.
      const ergebnis = await legeEintragAn(aufListe.aboId, eingabe, "");
      if ("error" in ergebnis) {
        setFehler(ergebnis.error);
        return;
      }
      toast.success("Auf die Barzahlungsliste gesetzt");
      setAufListe(null);
      router.refresh();
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div
      className="space-y-3 rounded-card border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
      data-testid="ohne-mandat-abos"
    >
      <div>
        <p className="font-medium">Mandat widerrufen, Beitrag offen</p>
        <p className="text-muted-foreground">
          {abos.length === 1 ? "Dieses Abo wäre" : "Diese Abos wären"} in diesen Lauf gekommen,{" "}
          {abos.length === 1 ? "hätte es" : "hätten sie"} noch ein gültiges SEPA-Mandat. Einziehen
          ist nicht möglich — gegen einen Widerruf darf nicht abgebucht werden. Der Beitrag gehört
          auf die Barzahlungsliste.
        </p>
      </div>

      <ul className="divide-y divide-border">
        {abos.map((abo) => (
          <li key={abo.aboId} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2 first:pt-0 last:pb-0">
            <span className="min-w-[14rem] flex-1">
              <span className="block font-medium">
                <KundenLink kundeId={abo.kundeId}>{abo.kundenname}</KundenLink>
              </span>
              <span className="block text-muted-foreground">{abo.bezeichnung}</span>
              <span className="block text-destructive">{abo.text}</span>
              {/* Ohne Mandat **und** ohne Preis stünde das Abo sonst in gar
                  keiner Liste. Dass es hier steht, genügt aber nicht — der
                  fehlende Preis muss benannt sein, sonst sieht der Betreiber
                  nur einen Strich und rät. */}
              {abo.preis === null && (
                <span className="block font-medium text-destructive">
                  Kein Preis am Abo hinterlegt — den Betrag musst du selbst eintragen.
                </span>
              )}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {abo.preis === null ? "—" : euro(abo.preis)}
            </span>
            {abo.schonAufListe ? (
              <span className="text-muted-foreground">Steht auf der Barzahlungsliste</span>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => oeffne(abo)}>
                Auf die Barzahlungsliste
              </Button>
            )}
          </li>
        ))}
      </ul>

      <Dialog
        open={aufListe !== null}
        onOpenChange={(offen) => {
          if (!offen && !laeuft) setAufListe(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Auf die Barzahlungsliste setzen?</DialogTitle>
            <DialogDescription>
              {aufListe?.kundenname} — {aufListe?.bezeichnung}. Der Betrag wird dort kassiert oder
              überwiesen, nicht abgebucht.
            </DialogDescription>
          </DialogHeader>

          {fehler && (
            <Alert variant="destructive">
              <AlertDescription>{fehler}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1">
            <Label htmlFor="barzahlung-betrag">Betrag</Label>
            <Input
              id="barzahlung-betrag"
              value={eingabe}
              onChange={(e) => setEingabe(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
            <p className="text-sm text-muted-foreground">
              Vorgeschlagen ist der Beitrag des Abos. Wie viel offen ist, weißt du besser.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" onClick={bestaetigen} disabled={laeuft || eingabe.trim() === ""}>
              {laeuft ? "Wird gesetzt…" : "Auf die Liste setzen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
