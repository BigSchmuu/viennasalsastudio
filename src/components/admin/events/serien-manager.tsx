"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  eventSeriesSchema,
  terminVerlegenSchema,
  type EventSeriesInput,
  type TerminVerlegenInput,
} from "@/lib/validations/events";
import {
  createEventSeries,
  updateEventSeries,
  endEventSeries,
  getSeriesOccurrences,
  countTicketsOnFutureOccurrences,
  cancelSeriesOccurrence,
  restoreSeriesOccurrence,
  moveSeriesOccurrence,
  type SerienTerminZeile,
} from "@/lib/actions/admin/event-series";
import type { EventTypeOption } from "@/components/admin/events/event-manager";
import { weekdayLabel, weekdayOptions } from "@/lib/constants/weekdays";
import { toDatetimeLocal } from "@/lib/events/formular";
import { MedienDialog } from "@/components/admin/events/medien-dialog";
import { uhrzeitKurz, SERIE_BEENDET } from "@/lib/events/serie";
import type { SalesMode } from "@/lib/events/event-zustand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export type SerieRow = {
  id: string;
  name: string;
  slug: string;
  eventTypeId: string;
  eventTypeName: string;
  description: string | null;
  location: string | null;
  weekday: number;
  startTime: string;
  endTime: string | null;
  startsOn: string;
  endsOn: string | null;
  pauseInHolidays: boolean;
  salesMode: SalesMode;
  capacity: number | null;
  priceNormal: number | null;
  priceStudent: number | null;
  status: string;
};

function rhythmus(serie: SerieRow): string {
  const zeit = serie.endTime ? `${uhrzeitKurz(serie.startTime)}–${uhrzeitKurz(serie.endTime)}` : uhrzeitKurz(serie.startTime);
  return `${weekdayLabel(serie.weekday)}, ${zeit}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function zahlAlsText(zahl: number | null): string {
  return zahl === null ? "" : String(zahl);
}

/**
 * Regelmäßige Veranstaltungen verwalten (PROJ-54).
 *
 * Eine Serie beschreibt nur die Regel. Ihre Termine sind gewöhnliche Events —
 * deshalb hat jede Serie eine Terminliste, in der sich ein einzelner Abend
 * absagen oder verlegen lässt, ohne die Serie anzufassen.
 */
export function SerienManager({ serien, eventTypes }: { serien: SerieRow[]; eventTypes: EventTypeOption[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SerieRow | null>(null);
  const [termineSerie, setTermineSerie] = useState<SerieRow | null>(null);
  const [endTarget, setEndTarget] = useState<SerieRow | null>(null);
  const [endTickets, setEndTickets] = useState<number | null>(null);
  const [medienSerie, setMedienSerie] = useState<SerieRow | null>(null);

  // Vor dem Bestätigen die Zahl der betroffenen Tickets — eine Absage mit
  // Folgen für zahlende Gäste soll niemand blind auslösen. Geladen wird beim
  // Öffnen, nicht in einem Effekt: Das spart einen zusätzlichen Renderlauf.
  function beendenOeffnen(serie: SerieRow) {
    setEndTarget(serie);
    setEndTickets(null);
    countTicketsOnFutureOccurrences(serie.id).then(setEndTickets);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          Serie anlegen
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Eventart</TableHead>
            <TableHead>Rhythmus</TableHead>
            <TableHead>Verkauf</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {serien.map((serie) => (
            <TableRow key={serie.id}>
              <TableCell className="font-medium">{serie.name}</TableCell>
              <TableCell className="text-muted-foreground">{serie.eventTypeName}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{rhythmus(serie)}</TableCell>
              <TableCell>
                {serie.salesMode === "display" ? (
                  <span className="text-muted-foreground">Nur anzeigen</span>
                ) : (
                  `Tickets, ${serie.capacity ?? "–"} Plätze`
                )}
              </TableCell>
              <TableCell>
                <Badge variant={serie.status === SERIE_BEENDET ? "destructive" : "secondary"}>
                  {serie.status === SERIE_BEENDET ? "Beendet" : "Läuft"}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/events/${serie.slug}`} target="_blank" rel="noopener noreferrer">
                    Seite ansehen
                  </Link>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setMedienSerie(serie)}>
                  Bilder &amp; Videos
                </Button>
                <Button variant="outline" size="sm" onClick={() => setTermineSerie(serie)}>
                  Termine
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(serie);
                    setDialogOpen(true);
                  }}
                >
                  Bearbeiten
                </Button>
                {serie.status !== SERIE_BEENDET && (
                  <Button variant="outline" size="sm" onClick={() => beendenOeffnen(serie)}>
                    Beenden
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {serien.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Noch keine Serien angelegt.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <SerieFormDialog
        key={editing?.id ?? "neue-serie"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        serie={editing}
        eventTypes={eventTypes}
        onSaved={() => router.refresh()}
      />

      <MedienDialog
        key={medienSerie?.id ?? "keine-medien"}
        ziel={medienSerie ? { serieId: medienSerie.id } : null}
        name={medienSerie?.name ?? ""}
        onOpenChange={(open) => !open && setMedienSerie(null)}
      />

      <TermineDialog
        key={termineSerie?.id ?? "keine-serie"}
        serie={termineSerie}
        onOpenChange={(open) => !open && setTermineSerie(null)}
      />

      <AlertDialog open={!!endTarget} onOpenChange={(open) => !open && setEndTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Serie beenden?</AlertDialogTitle>
            <AlertDialogDescription>
              „{endTarget?.name}&rdquo; legt keine neuen Termine mehr an. Künftige Termine ohne Tickets verschwinden;
              Termine mit Tickets werden abgesagt, und die Inhaber werden benachrichtigt.
              {endTickets === null
                ? " Betroffene Tickets werden noch gezählt …"
                : endTickets === 0
                  ? " Aktuell hängt kein Ticket an künftigen Terminen."
                  : ` Betroffen sind aktuell ${endTickets} Tickets.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!endTarget) return;
                const result = await endEventSeries(endTarget.id);
                if ("error" in result) {
                  toast.error(result.error);
                } else {
                  toast.success("Serie beendet.");
                  router.refresh();
                }
                setEndTarget(null);
              }}
            >
              Beenden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SerieFormDialog({
  open,
  onOpenChange,
  serie,
  eventTypes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serie: SerieRow | null;
  eventTypes: EventTypeOption[];
  onSaved: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<number | null>(null);

  const form = useForm<EventSeriesInput>({
    resolver: zodResolver(eventSeriesSchema),
    values: {
      name: serie?.name ?? "",
      description: serie?.description ?? "",
      location: serie?.location ?? "",
      event_type_id: serie?.eventTypeId ?? "",
      sales_mode: serie?.salesMode ?? "tickets",
      weekday: String(serie?.weekday ?? 4) as EventSeriesInput["weekday"],
      start_time: serie ? uhrzeitKurz(serie.startTime) : "21:00",
      end_time: serie?.endTime ? uhrzeitKurz(serie.endTime) : "",
      starts_on: serie?.startsOn ?? new Date().toISOString().slice(0, 10),
      ends_on: serie?.endsOn ?? "",
      pause_in_holidays: serie?.pauseInHolidays === false ? "false" : "true",
      capacity: zahlAlsText(serie?.capacity ?? null),
      price_normal: zahlAlsText(serie?.priceNormal ?? null),
      price_student: zahlAlsText(serie?.priceStudent ?? null),
    },
  });

  useEffect(() => {
    if (!open || !serie) return;
    let aktuell = true;
    countTicketsOnFutureOccurrences(serie.id).then((anzahl) => {
      if (aktuell) setTickets(anzahl);
    });
    return () => {
      aktuell = false;
    };
  }, [open, serie]);

  const nurAnzeigen = form.watch("sales_mode") === "display";
  const optional = nurAnzeigen ? " (optional)" : "";
  const keineArten = eventTypes.length === 0;

  async function onSubmit(values: EventSeriesInput) {
    setLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => formData.set(key, value ?? ""));

      const result = serie ? await updateEventSeries(serie.id, formData) : await createEventSeries(formData);
      if ("error" in result) {
        setFormError(result.error);
        return;
      }
      toast.success(serie ? "Serie gespeichert." : "Serie angelegt.");
      onOpenChange(false);
      onSaved();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{serie ? "Serie bearbeiten" : "Serie anlegen"}</DialogTitle>
        </DialogHeader>

        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {keineArten ? (
          <Alert>
            <AlertDescription>
              Es gibt noch keine Eventarten, und jede Serie braucht eine.{" "}
              <Link href="/admin/eventarten" className="underline">
                Zuerst eine Eventart anlegen
              </Link>
            </AlertDescription>
          </Alert>
        ) : null}

        {tickets !== null && tickets > 0 ? (
          <Alert>
            <AlertDescription>
              Auf künftigen Terminen hängen {tickets} Tickets. Änderst du Uhrzeit oder Ort, werden die Inhaber
              benachrichtigt. Einzeln verlegte und abgesagte Termine bleiben unberührt.
            </AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="z. B. Salsa-Party" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="event_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Eventart</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Eventart wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {eventTypes.map((art) => (
                        <SelectItem key={art.id} value={art.id}>
                          {art.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="weekday"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wochentag</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {weekdayOptions.map((tag) => (
                          <SelectItem key={tag.value} value={String(tag.value)}>
                            {tag.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beginn</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ende (optional)</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Ein Ende vor dem Beginn zählt als Folgetag — für Partys über Mitternacht.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="starts_on"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Erster Termin ab</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ends_on"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serie endet (optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="pause_in_holidays"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        id="serie-ferienpause"
                        checked={field.value === "true"}
                        onCheckedChange={(checked) => field.onChange(checked === true ? "true" : "false")}
                      />
                    </FormControl>
                    <Label htmlFor="serie-ferienpause" className="font-normal">
                      In Studioferien pausieren
                    </Label>
                  </div>
                  <FormDescription>
                    Termine in den Studioferien werden dann gar nicht erst angelegt. Bereits angelegte Termine bleiben
                    stehen — auch wenn die Ferien erst später dazukommen; absagen kannst du sie unter &bdquo;Termine&ldquo;.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ort (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="z.B. Studio Saal 1" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={4} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sales_mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verkauf</FormLabel>
                  <FormControl>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-3">
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="tickets" id="serie-sales-tickets" className="mt-0.5" />
                        <Label htmlFor="serie-sales-tickets" className="font-normal leading-snug">
                          Tickets in der App
                          <span className="block text-xs text-muted-foreground">Kapazität und QR-Code je Termin</span>
                        </Label>
                      </div>
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="display" id="serie-sales-display" className="mt-0.5" />
                        <Label htmlFor="serie-sales-display" className="font-normal leading-snug">
                          Nur anzeigen
                          <span className="block text-xs text-muted-foreground">Eintritt vor Ort</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kapazität je Termin{optional}</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="price_normal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preis normal (€){optional}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="price_student"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preis Studierende (€){optional}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={loading || keineArten}>
                {loading ? "Wird gespeichert…" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function TermineDialog({ serie, onOpenChange }: { serie: SerieRow | null; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [termine, setTermine] = useState<SerienTerminZeile[] | null>(null);
  const [verlegen, setVerlegen] = useState<SerienTerminZeile | null>(null);

  async function laden(seriesId: string) {
    setTermine(await getSeriesOccurrences(seriesId));
  }

  useEffect(() => {
    if (!serie) return;
    let aktuell = true;
    getSeriesOccurrences(serie.id).then((geladen) => {
      if (aktuell) setTermine(geladen);
    });
    return () => {
      aktuell = false;
    };
  }, [serie]);

  return (
    <Dialog open={!!serie} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Termine — {serie?.name}</DialogTitle>
        </DialogHeader>

        {termine?.some((termin) => termin.inFerien && !termin.abgesagt) ? (
          <Alert>
            <AlertDescription>
              Einzelne Termine liegen in den Studioferien — meist, weil die Ferien erst später eingetragen wurden. Sie
              bleiben bestehen, bis du sie hier absagst. Bei Terminen mit Tickets werden die Inhaber dann
              benachrichtigt.
            </AlertDescription>
          </Alert>
        ) : null}

        {termine === null ? (
          <p className="text-sm text-muted-foreground">Wird geladen…</p>
        ) : termine.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine kommenden Termine. Läuft die Serie noch, legt der nächtliche Lauf sie an.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {termine.map((termin) => (
              <li key={termin.id} className="flex flex-wrap items-center gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className={termin.abgesagt ? "text-sm line-through text-muted-foreground" : "text-sm font-medium"}>
                    {formatDateTime(termin.startsAt)}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {termin.abgesagt ? <Badge variant="destructive">Fällt aus</Badge> : null}
                    {termin.verlegt ? <Badge variant="secondary">Verlegt</Badge> : null}
                    {termin.inFerien && !termin.abgesagt ? <Badge variant="outline">In Studioferien</Badge> : null}
                    {termin.ticketCount > 0 ? `${termin.ticketCount} Tickets` : "keine Tickets"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => setVerlegen(termin)}>
                    Verlegen
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const result = termin.abgesagt
                        ? await restoreSeriesOccurrence(termin.id)
                        : await cancelSeriesOccurrence(termin.id);
                      if ("error" in result) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success(termin.abgesagt ? "Termin findet wieder statt." : "Termin abgesagt.");
                      if (serie) await laden(serie.id);
                      router.refresh();
                    }}
                  >
                    {termin.abgesagt ? "Absage zurücknehmen" : "Absagen"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <VerlegenDialog
          termin={verlegen}
          onOpenChange={(open) => !open && setVerlegen(null)}
          onSaved={async () => {
            setVerlegen(null);
            if (serie) await laden(serie.id);
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function VerlegenDialog({
  termin,
  onOpenChange,
  onSaved,
}: {
  termin: SerienTerminZeile | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<TerminVerlegenInput>({
    resolver: zodResolver(terminVerlegenSchema),
    values: {
      starts_at: termin ? toDatetimeLocal(termin.startsAt) : "",
      ends_at: termin?.endsAt ? toDatetimeLocal(termin.endsAt) : "",
      location: "",
    },
  });

  async function onSubmit(values: TerminVerlegenInput) {
    if (!termin) return;
    setLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => formData.set(key, value ?? ""));
      const result = await moveSeriesOccurrence(termin.id, formData);
      if ("error" in result) {
        setFormError(result.error);
        return;
      }
      toast.success("Termin verlegt. Ticket-Inhaber werden benachrichtigt.");
      onSaved();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={!!termin} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Termin verlegen</DialogTitle>
        </DialogHeader>

        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="starts_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Neuer Beginn</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ends_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Neues Ende (optional)</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anderer Ort (optional)</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="leer lassen: Ort der Serie" />
                  </FormControl>
                  <FormDescription>
                    Der Termin gilt danach als verlegt: Serienänderungen lassen ihn in Ruhe, und Ticket-Inhaber dürfen
                    ohne Frist stornieren.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "Wird gespeichert…" : "Verlegen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
