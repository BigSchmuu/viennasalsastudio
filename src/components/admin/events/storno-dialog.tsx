"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getStornoLage, ticketStornieren, type StornoLage } from "@/lib/actions/admin/ticket-storno";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const euro = (betrag: number) => betrag.toLocaleString("de-AT", { style: "currency", currency: "EUR" });

/**
 * Ein Ticket stornieren (PROJ-59).
 *
 * Der Dialog sagt in einem Satz, wo das Geld steht. Das ist sein eigentlicher
 * Zweck: Ohne diese Auskunft müsste der Betreiber in den Lastschriftläufen
 * nachsehen, und genau das bleibt im Alltag liegen.
 */
export function StornoDialog({
  ticketId,
  onOpenChange,
  onErledigt,
}: {
  ticketId: string | null;
  onOpenChange: (offen: boolean) => void;
  onErledigt: () => void;
}) {
  // Die geladene Lage trägt die Kennung mit, zu der sie gehört. Damit lässt
  // sich ableiten, ob sie zum gerade offenen Ticket passt — ohne beim Wechsel
  // erst den alten Stand wegzuräumen. Ein `setState` im Effekt zeigte sonst für
  // einen Wimpernschlag die Zahlen des vorigen Tickets, und der Linter des
  // Projekts verbietet es ohnehin.
  const [geladen, setGeladen] = useState<{ id: string; lage: StornoLage | null } | null>(null);
  const [grund, setGrund] = useState("");
  const [guthaben, setGuthaben] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const lage = geladen?.id === ticketId ? geladen.lage : null;
  const laedt = !!ticketId && lage === null;

  useEffect(() => {
    if (!ticketId) return;
    let aktuell = true;
    getStornoLage(ticketId).then((ergebnis) => {
      if (!aktuell) return;
      setGeladen({ id: ticketId, lage: ergebnis });
      // Vorausgewählt, aber nur wenn es etwas gutzuschreiben gibt: Eine
      // vergessene Rückerstattung ist der teurere Fehler.
      setGuthaben(!!ergebnis?.abgebuchtAm);
      setGrund("");
      setFehler(null);
    });
    return () => {
      aktuell = false;
    };
  }, [ticketId]);

  async function stornieren() {
    if (!ticketId) return;
    setLaeuft(true);
    setFehler(null);
    const ergebnis = await ticketStornieren(ticketId, { grund: grund.trim(), guthabenGutschreiben: guthaben });
    setLaeuft(false);
    if ("error" in ergebnis) {
      setFehler(ergebnis.error);
      return;
    }
    // Der Hinweis erscheint, wenn der Kunde in derselben Sekunde selbst
    // storniert hat — dann ist nichts geschehen, und das gehört gesagt.
    toast.success(ergebnis.hinweis ?? "Ticket storniert.");
    onErledigt();
    onOpenChange(false);
  }

  const gratis = (lage?.preis ?? 0) === 0;

  return (
    <Dialog open={!!ticketId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ticket stornieren</DialogTitle>
          <DialogDescription>
            Der Platz wird sofort wieder frei, und der Kunde bekommt eine Nachricht darüber.
          </DialogDescription>
        </DialogHeader>

        {laedt || !lage ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-4">
            <dl className="rounded-card border border-border/60 p-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Kunde</dt>
                <dd className="font-medium">{lage.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Ticket</dt>
                <dd>
                  {lage.ticketart ?? "Ticket"}
                  {lage.einheit ? ` · ${lage.einheit}` : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Preis</dt>
                <dd className="tabular-nums">{euro(lage.preis)}</dd>
              </div>
            </dl>

            {/* Die drei Lagen aus dem Entwurf — jede wird ausdrücklich benannt,
                statt zu schweigen und den Betreiber raten zu lassen. */}
            {gratis ? (
              <p className="text-sm text-muted-foreground">Freikarte — es ist kein Geld im Spiel.</p>
            ) : lage.zahlungsart === "onsite" ? (
              <p className="text-sm text-muted-foreground">
                Zahlung vor Ort — durch die App ist nie Geld geflossen, es gibt nichts zurückzugeben.
              </p>
            ) : lage.abgebuchtAm ? (
              <div className="space-y-2 rounded-card border border-border/60 bg-muted/40 p-3">
                <p className="text-sm">
                  <span className="font-medium">Bereits abgebucht</span> — der Lastschriftlauf wurde am{" "}
                  {new Date(lage.abgebuchtAm).toLocaleDateString("de-AT", { timeZone: "Europe/Vienna" })}{" "}
                  freigegeben.
                </p>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="guthaben"
                    checked={guthaben}
                    onCheckedChange={(wert) => setGuthaben(wert === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="guthaben" className="text-sm font-normal leading-snug">
                    {euro(lage.preis)} als Guthaben gutschreiben
                    <span className="block text-muted-foreground">
                      Wird bei der nächsten Buchung verrechnet.
                    </span>
                  </Label>
                </div>
              </div>
            ) : lage.imOffenenLauf ? (
              <p className="text-sm text-muted-foreground">
                Das Ticket steht in einem Lastschriftlauf, der noch <span className="font-medium">nicht
                freigegeben</span> ist — abgebucht wurde also nichts. Nimm die Zeile aus dem Lauf, bevor du
                ihn freigibst.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch nichts abgebucht. Das Ticket fällt aus künftigen Lastschriftläufen heraus.
              </p>
            )}

            {lage.eingecheckt || lage.eventVorbei ? (
              <Alert>
                <AlertDescription>
                  {lage.eingecheckt ? "Diese Person war am Einlass. " : ""}
                  {lage.eventVorbei ? "Das Event ist vorbei. " : ""}
                  Stornieren geht trotzdem — es ist deine Entscheidung.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-1">
              <Label htmlFor="storno-grund">Grund (optional)</Label>
              <Input
                id="storno-grund"
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                placeholder="Steht so in der Nachricht an den Kunden"
                maxLength={200}
              />
            </div>

            {fehler ? (
              <Alert variant="destructive">
                <AlertDescription>{fehler}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={laeuft}>
            Abbrechen
          </Button>
          <Button onClick={stornieren} disabled={laeuft || laedt || !lage}>
            {laeuft ? "Wird storniert …" : "Stornieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
