"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toDatetimeLocal } from "@/lib/events/formular";
import { formatPrice } from "@/lib/pricing";
import { freiePlaetzeEinheit, GELTUNG_ALLE, GELTUNG_AUSWAHL, GELTUNG_KUNDENWAHL } from "@/lib/events/tickets";
import {
  createEinheit,
  createTicketart,
  deleteEinheit,
  deleteTicketart,
  getEventProgramm,
  updateEinheit,
  updateTicketart,
  type EinheitZeile,
  type EventProgramm,
  type TicketartZeile,
} from "@/lib/actions/admin/event-programm";

/**
 * Programm und Ticketarten eines Events verwalten (PROJ-56).
 *
 * Zwei Listen in einem Dialog, weil sie zusammengehören: Eine Ticketart gilt
 * für Einheiten, und wer eine Einheit anlegt, will sie gleich zuordnen. Ein
 * Event ohne Einheiten braucht nur den unteren Teil — dann gilt jede
 * Ticketart für das ganze Event.
 */
export function ProgrammDialog({
  event,
  onOpenChange,
}: {
  event: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [programm, setProgramm] = useState<EventProgramm | null>(null);
  const [einheitOffen, setEinheitOffen] = useState<EinheitZeile | "neu" | null>(null);
  const [artOffen, setArtOffen] = useState<TicketartZeile | "neu" | null>(null);

  const laden = useCallback(async (eventId: string) => {
    setProgramm(await getEventProgramm(eventId));
  }, []);

  useEffect(() => {
    if (!event) return;
    let aktuell = true;
    getEventProgramm(event.id).then((geladen) => {
      if (aktuell) setProgramm(geladen);
    });
    return () => {
      aktuell = false;
    };
  }, [event]);

  async function mitMeldung(arbeit: Promise<{ error: string } | { success: true }>, gelungen: string) {
    const ergebnis = await arbeit;
    if ("error" in ergebnis) {
      toast.error(ergebnis.error);
      return false;
    }
    toast.success(gelungen);
    if (event) await laden(event.id);
    return true;
  }

  const einheiten = programm?.einheiten ?? [];

  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Programm &amp; Tickets — {event?.name}</DialogTitle>
        </DialogHeader>

        {programm === null ? (
          <p className="text-sm text-muted-foreground">Wird geladen…</p>
        ) : (
          <div className="space-y-8">
            <section className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-heading font-bold">Einheiten</h3>
                  <p className="text-sm text-muted-foreground">
                    Das Programm eines Workshops. Ohne Einheiten ist das Event ein Termin, und Ticketarten gelten für
                    das Ganze.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEinheitOffen("neu")}>
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                  Einheit
                </Button>
              </div>

              {einheiten.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Einheiten.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {einheiten.map((einheit) => {
                    const frei = freiePlaetzeEinheit({ ...einheit });
                    return (
                      <li key={einheit.id} className="flex flex-wrap items-center gap-2 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{einheit.titel}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(einheit.startsAt).toLocaleString("de-AT", {
                              weekday: "short",
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {einheit.kapazitaet === null
                              ? " · ohne Kapazität"
                              : ` · ${einheit.belegt} von ${einheit.kapazitaet} belegt`}
                            {frei === 0 ? " · voll" : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button variant="outline" size="icon" aria-label="Einheit bearbeiten" onClick={() => setEinheitOffen(einheit)}>
                            <Pencil className="h-4 w-4" aria-hidden />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label="Einheit löschen"
                            onClick={() => mitMeldung(deleteEinheit(einheit.id), "Einheit gelöscht.")}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-heading font-bold">Ticketarten</h3>
                  <p className="text-sm text-muted-foreground">
                    Mit verkauften Tickets lassen sich Preis und Geltung nicht mehr ändern — Name und Verkaufsstatus
                    schon.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setArtOffen("neu")}>
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden />
                  Ticketart
                </Button>
              </div>

              {programm.ticketarten.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    Noch keine Ticketart. Solange keine besteht, gilt der Preis am Event selbst.
                  </AlertDescription>
                </Alert>
              ) : (
                <ul className="divide-y divide-border">
                  {programm.ticketarten.map((art) => (
                    <li key={art.id} className="flex flex-wrap items-center gap-2 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {art.name}
                          {art.imVerkauf ? null : <Badge variant="secondary">Nicht im Verkauf</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(art.preisNormal, "de")} · Studierende {formatPrice(art.preisStudierend, "de")}
                          {art.kontingent === null ? "" : ` · Kontingent ${art.verkauft}/${art.kontingent}`}
                          {art.verkauft > 0 ? ` · ${art.verkauft} verkauft` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">{geltungText(art, einheiten)}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="outline" size="icon" aria-label="Ticketart bearbeiten" onClick={() => setArtOffen(art)}>
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Ticketart löschen"
                          onClick={() => mitMeldung(deleteTicketart(art.id), "Ticketart gelöscht.")}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {event && einheitOffen ? (
          <EinheitDialog
            eventId={event.id}
            einheit={einheitOffen === "neu" ? null : einheitOffen}
            onClose={() => setEinheitOffen(null)}
            onSaved={async () => {
              setEinheitOffen(null);
              await laden(event.id);
            }}
          />
        ) : null}

        {event && artOffen ? (
          <TicketartDialog
            eventId={event.id}
            art={artOffen === "neu" ? null : artOffen}
            einheiten={einheiten}
            onClose={() => setArtOffen(null)}
            onSaved={async () => {
              setArtOffen(null);
              await laden(event.id);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function geltungText(art: TicketartZeile, einheiten: EinheitZeile[]): string {
  if (einheiten.length === 0) return "Gilt für das Event";
  if (art.geltung === GELTUNG_ALLE) return "Gilt für alle Einheiten";
  if (art.geltung === GELTUNG_KUNDENWAHL) return "Kunde wählt eine Einheit";
  const namen = einheiten.filter((einheit) => art.einheitIds.includes(einheit.id)).map((einheit) => einheit.titel);
  return namen.length > 0 ? `Gilt für: ${namen.join(", ")}` : "Gilt für: (keine Einheit gewählt)";
}

function EinheitDialog({
  eventId,
  einheit,
  onClose,
  onSaved,
}: {
  eventId: string;
  einheit: EinheitZeile | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  return (
    <Dialog open onOpenChange={(offen) => !offen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{einheit ? "Einheit bearbeiten" : "Einheit anlegen"}</DialogTitle>
        </DialogHeader>

        {fehler ? (
          <Alert variant="destructive">
            <AlertDescription>{fehler}</AlertDescription>
          </Alert>
        ) : null}

        <form
          className="space-y-4"
          onSubmit={async (ereignis) => {
            ereignis.preventDefault();
            setLaeuft(true);
            setFehler(null);
            try {
              const formData = new FormData(ereignis.currentTarget);
              const ergebnis = einheit
                ? await updateEinheit(einheit.id, formData)
                : await createEinheit(eventId, formData);
              if ("error" in ergebnis) {
                setFehler(ergebnis.error);
                return;
              }
              toast.success(einheit ? "Einheit gespeichert." : "Einheit angelegt.");
              onSaved();
            } finally {
              setLaeuft(false);
            }
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="einheit-titel">Titel</Label>
            <Input id="einheit-titel" name="title" defaultValue={einheit?.titel ?? ""} placeholder="z. B. Styling" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="einheit-beginn">Beginn</Label>
              <Input
                id="einheit-beginn"
                name="starts_at"
                type="datetime-local"
                defaultValue={einheit ? toDatetimeLocal(einheit.startsAt) : ""}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="einheit-ende">Ende (optional)</Label>
              <Input
                id="einheit-ende"
                name="ends_at"
                type="datetime-local"
                defaultValue={einheit?.endsAt ? toDatetimeLocal(einheit.endsAt) : ""}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="einheit-kapazitaet">Kapazität (optional)</Label>
            <Input
              id="einheit-kapazitaet"
              name="capacity"
              type="number"
              min={1}
              defaultValue={einheit?.kapazitaet ?? ""}
            />
            <p className="text-xs text-muted-foreground">
              Ein Ticket belegt einen Platz in jeder Einheit, für die es gilt.
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={laeuft}>
              {laeuft ? "Wird gespeichert…" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TicketartDialog({
  eventId,
  art,
  einheiten,
  onClose,
  onSaved,
}: {
  eventId: string;
  art: TicketartZeile | null;
  einheiten: EinheitZeile[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [geltung, setGeltung] = useState<string>(art?.geltung ?? GELTUNG_ALLE);

  return (
    <Dialog open onOpenChange={(offen) => !offen && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{art ? "Ticketart bearbeiten" : "Ticketart anlegen"}</DialogTitle>
        </DialogHeader>

        {fehler ? (
          <Alert variant="destructive">
            <AlertDescription>{fehler}</AlertDescription>
          </Alert>
        ) : null}

        {art && art.verkauft > 0 ? (
          <Alert>
            <AlertDescription>
              {art.verkauft === 1 ? "Ein Ticket ist" : `${art.verkauft} Tickets sind`} verkauft. Preis und Geltung
              lassen sich nicht mehr ändern.
            </AlertDescription>
          </Alert>
        ) : null}

        <form
          className="space-y-4"
          onSubmit={async (ereignis) => {
            ereignis.preventDefault();
            setLaeuft(true);
            setFehler(null);
            try {
              const formData = new FormData(ereignis.currentTarget);
              const ergebnis = art ? await updateTicketart(art.id, formData) : await createTicketart(eventId, formData);
              if ("error" in ergebnis) {
                setFehler(ergebnis.error);
                return;
              }
              toast.success(art ? "Ticketart gespeichert." : "Ticketart angelegt.");
              onSaved();
            } finally {
              setLaeuft(false);
            }
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="art-name">Name</Label>
            <Input id="art-name" name="name" defaultValue={art?.name ?? ""} placeholder="z. B. Full Pass" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="art-preis">Preis normal (€)</Label>
              <Input
                id="art-preis"
                name="price_normal"
                type="number"
                min={0}
                step="0.01"
                defaultValue={art?.preisNormal ?? ""}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="art-preis-studierend">Preis Studierende (€)</Label>
              <Input
                id="art-preis-studierend"
                name="price_student"
                type="number"
                min={0}
                step="0.01"
                defaultValue={art?.preisStudierend ?? ""}
                required
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">
            0 € heißt kostenlos: keine Zahlungsart, kein Mandat, sofort bestätigt.
          </p>

          <div className="space-y-1">
            <Label htmlFor="art-kontingent">Kontingent (optional)</Label>
            <Input id="art-kontingent" name="quota" type="number" min={1} defaultValue={art?.kontingent ?? ""} />
            <p className="text-xs text-muted-foreground">
              Wie viele Tickets dieser Art es überhaupt gibt. Leer heißt: so viele, wie in die Einheiten passen.
            </p>
          </div>

          {einheiten.length > 0 ? (
            <div className="space-y-2">
              <Label>Geltungsbereich</Label>
              <input type="hidden" name="scope" value={geltung} />
              <RadioGroup value={geltung} onValueChange={setGeltung} className="gap-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={GELTUNG_ALLE} id="geltung-alle" />
                  <Label htmlFor="geltung-alle" className="font-normal">
                    Alle Einheiten
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={GELTUNG_AUSWAHL} id="geltung-auswahl" />
                  <Label htmlFor="geltung-auswahl" className="font-normal">
                    Bestimmte Einheiten
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={GELTUNG_KUNDENWAHL} id="geltung-wahl" />
                  <Label htmlFor="geltung-wahl" className="font-normal">
                    Kunde wählt eine Einheit
                  </Label>
                </div>
              </RadioGroup>

              {geltung === GELTUNG_AUSWAHL ? (
                <div className="space-y-2 rounded-md border p-3">
                  {einheiten.map((einheit) => (
                    <div key={einheit.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`art-einheit-${einheit.id}`}
                        name="unit_ids"
                        value={einheit.id}
                        defaultChecked={art?.einheitIds.includes(einheit.id)}
                      />
                      <Label htmlFor={`art-einheit-${einheit.id}`} className="font-normal">
                        {einheit.titel}
                      </Label>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <input type="hidden" name="scope" value={GELTUNG_ALLE} />
          )}

          <div className="flex items-center gap-2">
            <Checkbox id="art-verkauf" name="on_sale" value="true" defaultChecked={art?.imVerkauf ?? true} />
            <Label htmlFor="art-verkauf" className="font-normal">
              Im Verkauf
            </Label>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={laeuft}>
              {laeuft ? "Wird gespeichert…" : "Speichern"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
