"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { eventSchema, createEventSchema, type EventInput } from "@/lib/validations/events";
import { createEvent, updateEvent, cancelEvent, getEventGuestList, type EventGuestRow } from "@/lib/actions/admin/events";
import { ticketPaymentMethodLabel, ticketStatusLabel, ticketStatusColor } from "@/lib/constants/events";
import type { SalesMode } from "@/lib/events/event-zustand";
import { toDatetimeLocal } from "@/lib/events/formular";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { MedienDialog } from "@/components/admin/events/medien-dialog";
import { ProgrammDialog } from "@/components/admin/events/programm-dialog";
import { createGast, deleteGast, getEventProgramm, type GastZeile } from "@/lib/actions/admin/event-programm";
import { danceRoleOptions } from "@/lib/constants/booking";
import { STANDARD_STORNOFRIST_TAGE, type Zahlungswahl } from "@/lib/events/tickets";
import { StornoDialog } from "@/components/admin/events/storno-dialog";
import { eventEnde } from "@/lib/events/event-zustand";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export type EventRow = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
  priceNormal: number | null;
  priceStudent: number | null;
  status: string;
  salesMode: SalesMode;
  slug: string;
  eventTypeId: string;
  eventTypeName: string;
  ticketCount: number;
  /** PROJ-56: Zahlungsarten, Stornofrist und Tanzrolle stehen am Event. */
  paymentMethods: Zahlungswahl;
  cancellationLeadDays: number;
  roleQueryEnabled: boolean;
  maxRoleDifference: number | null;
};

export type EventTypeOption = { id: string; name: string };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function zahlAlsText(zahl: number | null): string {
  return zahl === null ? "" : String(zahl);
}

export function EventManager({ events, eventTypes }: { events: EventRow[]; eventTypes: EventTypeOption[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<EventRow | null>(null);
  const [guestListEvent, setGuestListEvent] = useState<EventRow | null>(null);
  const [guests, setGuests] = useState<EventGuestRow[] | null>(null);
  const [guestsLoading, setGuestsLoading] = useState(false);
  const [medienEvent, setMedienEvent] = useState<EventRow | null>(null);
  const [programmEvent, setProgrammEvent] = useState<EventRow | null>(null);
  const [zeigeErledigte, setZeigeErledigte] = useState(false);

  // Abgesagt oder vorbei — beides braucht keine Aufmerksamkeit mehr. Anders als
  // bei den Gastplätzen gibt es hier keine Datumsgrenze in der Abfrage: Jede
  // jemals angelegte Party blieb in der Liste stehen, und das wuchs unbegrenzt.
  // Ausblenden, nicht wegwerfen: Wer im Februar nachsehen will, was im November
  // lief, findet es hinter dem Schalter.
  const istErledigt = (event: EventRow) =>
    event.status === "abgesagt" || eventEnde(event.startsAt, event.endsAt) <= new Date();
  const erledigte = events.filter(istErledigt);
  const sichtbareEvents = zeigeErledigte ? events : events.filter((e) => !istErledigt(e));

  async function openGuestList(event: EventRow) {
    setGuestListEvent(event);
    setGuestsLoading(true);
    try {
      setGuests(await getEventGuestList(event.id));
    } finally {
      setGuestsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {erledigte.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => setZeigeErledigte((z) => !z)}>
            {zeigeErledigte ? "Vergangene ausblenden" : `Vergangene anzeigen (${erledigte.length})`}
          </Button>
        ) : null}
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          Event anlegen
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Eventart</TableHead>
            <TableHead>Termin</TableHead>
            <TableHead>Plätze</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sichtbareEvents.map((event) => (
            <TableRow key={event.id}>
              <TableCell className="font-medium">{event.name}</TableCell>
              <TableCell className="text-muted-foreground">{event.eventTypeName}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(event.startsAt)}
              </TableCell>
              <TableCell>
                {event.salesMode === "display" ? (
                  <span className="text-muted-foreground">Nur anzeigen</span>
                ) : (
                  `${event.ticketCount} / ${event.capacity ?? "–"}`
                )}
              </TableCell>
              <TableCell>
                <Badge variant={event.status === "abgesagt" ? "destructive" : "secondary"}>
                  {event.status === "abgesagt" ? "Abgesagt" : "Geplant"}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/events/${event.slug}`} target="_blank" rel="noopener noreferrer">
                    Seite ansehen
                  </Link>
                </Button>
                {event.salesMode === "tickets" ? (
                  <Button variant="outline" size="sm" onClick={() => setProgrammEvent(event)}>
                    Programm &amp; Tickets
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => setMedienEvent(event)}>
                  Bilder &amp; Videos
                </Button>
                {event.salesMode === "tickets" || event.ticketCount > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => openGuestList(event)}>
                    Gästeliste
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(event);
                    setDialogOpen(true);
                  }}
                >
                  Bearbeiten
                </Button>
                {event.status !== "abgesagt" && (
                  <Button variant="outline" size="sm" onClick={() => setCancelTarget(event)}>
                    Absagen
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {sichtbareEvents.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Noch keine Events angelegt.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ProgrammDialog
        key={programmEvent?.id ?? "kein-programm"}
        event={programmEvent}
        onOpenChange={(open) => !open && setProgrammEvent(null)}
      />

      <MedienDialog
        key={medienEvent?.id ?? "keine-medien"}
        ziel={medienEvent ? { eventId: medienEvent.id } : null}
        name={medienEvent?.name ?? ""}
        onOpenChange={(open) => !open && setMedienEvent(null)}
      />

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editing}
        eventTypes={eventTypes}
        onSaved={() => router.refresh()}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Event absagen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{cancelTarget?.name}&rdquo; wird als abgesagt markiert und verschwindet aus dem Programm. Seine Seite
              bleibt erreichbar und zeigt die Absage. Bereits gekaufte Tickets bleiben als Datensatz erhalten.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!cancelTarget) return;
                const result = await cancelEvent(cancelTarget.id);
                if ("error" in result) {
                  toast.error(result.error);
                } else {
                  toast.success("Event abgesagt.");
                  router.refresh();
                }
                setCancelTarget(null);
              }}
            >
              Absagen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GuestListDialog
        event={guestListEvent}
        guests={guests}
        loading={guestsLoading}
        onReload={() => guestListEvent && openGuestList(guestListEvent)}
        onOpenChange={(open) => {
          if (!open) {
            setGuestListEvent(null);
            setGuests(null);
          }
        }}
      />
    </div>
  );
}

function EventFormDialog({
  open,
  onOpenChange,
  event,
  eventTypes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventRow | null;
  eventTypes: EventTypeOption[];
  onSaved: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<EventInput>({
    resolver: zodResolver(event ? eventSchema : createEventSchema),
    values: {
      name: event?.name ?? "",
      description: event?.description ?? "",
      location: event?.location ?? "",
      event_type_id: event?.eventTypeId ?? "",
      sales_mode: event?.salesMode ?? "tickets",
      starts_at: event ? toDatetimeLocal(event.startsAt) : "",
      ends_at: event?.endsAt ? toDatetimeLocal(event.endsAt) : "",
      capacity: zahlAlsText(event?.capacity ?? null),
      price_normal: zahlAlsText(event?.priceNormal ?? null),
      price_student: zahlAlsText(event?.priceStudent ?? null),
      payment_methods: event?.paymentMethods ?? "both",
      cancellation_lead_days: String(event?.cancellationLeadDays ?? STANDARD_STORNOFRIST_TAGE),
      role_query_enabled: event?.roleQueryEnabled ? "true" : "false",
      max_role_difference: zahlAlsText(event?.maxRoleDifference ?? null),
    },
  });

  const nurAnzeigen = form.watch("sales_mode") === "display";
  const optional = nurAnzeigen ? " (optional)" : "";
  const keineArten = eventTypes.length === 0;

  async function onSubmit(values: EventInput) {
    setLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => formData.set(key, value ?? ""));

      const result = event ? await updateEvent(event.id, formData) : await createEvent(formData);

      if ("error" in result) {
        setFormError(result.error);
        return;
      }
      toast.success(event ? "Event gespeichert." : "Event angelegt.");
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
          <DialogTitle>{event ? "Event bearbeiten" : "Event anlegen"}</DialogTitle>
        </DialogHeader>

        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {keineArten ? (
          <Alert>
            <AlertDescription>
              Es gibt noch keine Eventarten, und jedes Event braucht eine.{" "}
              <Link href="/admin/eventarten" className="underline">
                Zuerst eine Eventart anlegen
              </Link>
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
                    <Input {...field} />
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
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={5} {...field} />
                  </FormControl>
                  <FormDescription>Absätze bleiben auf der Eventseite erhalten.</FormDescription>
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
                    <Input {...field} placeholder="z.B. Studio Saal 1 oder externe Location" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="starts_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beginn</FormLabel>
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
                    <FormLabel>Ende (optional)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Ohne Ende gilt das Event bis Mitternacht. Für Partys über Mitternacht das Ende eintragen.
            </p>

            <FormField
              control={form.control}
              name="sales_mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verkauf</FormLabel>
                  <FormControl>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="gap-3">
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="tickets" id="sales-mode-tickets" className="mt-0.5" />
                        <Label htmlFor="sales-mode-tickets" className="font-normal leading-snug">
                          Tickets in der App
                          <span className="block text-xs text-muted-foreground">
                            Kunden kaufen Tickets mit QR-Code, die Kapazität wird gezählt
                          </span>
                        </Label>
                      </div>
                      <div className="flex items-start gap-2">
                        <RadioGroupItem value="display" id="sales-mode-display" className="mt-0.5" />
                        <Label htmlFor="sales-mode-display" className="font-normal leading-snug">
                          Nur anzeigen
                          <span className="block text-xs text-muted-foreground">
                            Eintritt vor Ort, ohne Ticketverkauf in der App
                          </span>
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
                  <FormLabel>Kapazität{optional}</FormLabel>
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
            {nurAnzeigen ? (
              <p className="-mt-2 text-xs text-muted-foreground">
                Ein eingetragener Preis erscheint als Eintrittspreis. 0 € wird als „Kostenlos&quot; angezeigt.
              </p>
            ) : null}

            {!nurAnzeigen ? (
              <div className="space-y-4 border-t border-border/60 pt-4">
                <FormField
                  control={form.control}
                  name="payment_methods"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zahlungsarten</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="both">SEPA-Lastschrift und bar vor Ort</SelectItem>
                          <SelectItem value="sepa">Nur SEPA-Lastschrift</SelectItem>
                          <SelectItem value="onsite">Nur bar vor Ort</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Verkaufte Tickets behalten ihre Zahlungsart, auch wenn du das später änderst.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cancellation_lead_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stornofrist in Tagen</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="1" {...field} />
                      </FormControl>
                      <FormDescription>
                        Bis so viele Tage vor Beginn können Kunden selbst stornieren. 0 heißt: bis zum Beginn.
                        Verkaufte Tickets behalten die Frist, die beim Kauf galt.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role_query_enabled"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            id="event-rolle"
                            checked={field.value === "true"}
                            onCheckedChange={(checked) => field.onChange(checked === true ? "true" : "false")}
                          />
                        </FormControl>
                        <Label htmlFor="event-rolle" className="font-normal">
                          Tanzrolle beim Kauf abfragen
                        </Label>
                      </div>
                      <FormDescription>
                        Wie bei Kursen. Die Rolle steht danach an der Gästeliste und am Einlass.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("role_query_enabled") === "true" ? (
                  <FormField
                    control={form.control}
                    name="max_role_difference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Größter Abstand zwischen Leadern und Followern (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step="1" {...field} />
                        </FormControl>
                        <FormDescription>
                          Leer lassen heißt: kein Ausgleich, jede Rolle kann kaufen, solange Plätze frei sind.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>
            ) : null}

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

/**
 * Die Gästeliste eines Events (PROJ-14, erweitert in PROJ-56).
 *
 * Sie zeigt jetzt zweierlei nebeneinander: verkaufte Tickets und von Hand
 * eingetragene Gäste — Lehrer, Freunde des Hauses. Beide sind als das
 * erkennbar, was sie sind; Gäste zahlen nichts und zählen nicht gegen die
 * verkäuflichen Plätze.
 */
function GuestListDialog({
  event,
  guests,
  loading,
  onOpenChange,
  onReload,
}: {
  event: EventRow | null;
  guests: EventGuestRow[] | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onReload: () => void;
}) {
  const [handgaeste, setHandgaeste] = useState<GastZeile[] | null>(null);
  const [einheiten, setEinheiten] = useState<{ id: string; titel: string }[]>([]);
  const [neuOffen, setNeuOffen] = useState(false);
  // PROJ-59: Welches Ticket gerade storniert werden soll.
  const [stornoTicket, setStornoTicket] = useState<string | null>(null);

  const ladenHandgaeste = useCallback(async (eventId: string) => {
    const programm = await getEventProgramm(eventId);
    setHandgaeste(programm.gaeste);
    setEinheiten(programm.einheiten.map((einheit) => ({ id: einheit.id, titel: einheit.titel })));
  }, []);

  useEffect(() => {
    if (!event) return;
    let aktuell = true;
    getEventProgramm(event.id).then((programm) => {
      if (!aktuell) return;
      setHandgaeste(programm.gaeste);
      setEinheiten(programm.einheiten.map((einheit) => ({ id: einheit.id, titel: einheit.titel })));
    });
    return () => {
      aktuell = false;
    };
  }, [event]);

  const rolleZeigen = event?.roleQueryEnabled ?? false;

  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gästeliste — {event?.name}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Wird geladen…</p>
        ) : (
          <div className="space-y-6">
            <section className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {guests?.length ?? 0} Tickets · {handgaeste?.length ?? 0} Gäste von Hand
              </p>

              {!guests || guests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Tickets verkauft.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Ticket</TableHead>
                      {rolleZeigen ? <TableHead>Rolle</TableHead> : null}
                      <TableHead>Zahlungsart</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {guests.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell>
                          <Link href={`/admin/kunden/${g.customerId}`} className="hover:underline">
                            {g.customerName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {g.ticketart ?? "Ticket"}
                          {g.einheit ? <span className="block text-xs">{g.einheit}</span> : null}
                        </TableCell>
                        {rolleZeigen ? (
                          <TableCell className="text-muted-foreground">{rolleLabel(g.rolle)}</TableCell>
                        ) : null}
                        <TableCell>
                          {ticketPaymentMethodLabel[g.paymentMethod as "sepa" | "onsite"] ?? g.paymentMethod}
                        </TableCell>
                        <TableCell>
                          <Badge style={{ backgroundColor: ticketStatusColor(g.status) }} className="text-white">
                            {ticketStatusLabel(g.status)}
                          </Badge>
                          {/* PROJ-59: Warum ein Platz frei wurde, gehört an die
                              Zeile — sonst ist es in drei Monaten nicht mehr
                              zu klären. */}
                          {g.storniertAm ? (
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {new Date(g.storniertAm).toLocaleDateString("de-AT", { timeZone: "Europe/Vienna" })}
                              {g.storniertVon ? ` · ${g.storniertVon}` : ""}
                              {g.stornoGrund ? ` · ${g.stornoGrund}` : ""}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          {/* PROJ-59: Ein storniertes Ticket bleibt in der Liste
                              stehen — es verschwinden zu lassen sähe aus, als
                              hätte es das Ticket nie gegeben. Nur zu stornieren
                              gibt es dort nichts mehr. */}
                          {g.status === "cancelled" ? null : (
                            <Button size="sm" variant="ghost" onClick={() => setStornoTicket(g.id)}>
                              Stornieren
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>

            <section className="space-y-3 border-t border-border/60 pt-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-heading font-bold">Gäste von Hand</h3>
                  <p className="text-sm text-muted-foreground">
                    Lehrer, Freunde des Hauses. Ohne Konto, ohne Zahlung — und ohne die verkäuflichen Plätze zu
                    verringern.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setNeuOffen(true)}>
                  Gast eintragen
                </Button>
              </div>

              {handgaeste === null ? (
                <p className="text-sm text-muted-foreground">Wird geladen…</p>
              ) : handgaeste.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Gäste von Hand.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {handgaeste.map((gast) => (
                    <li key={gast.id} className="flex flex-wrap items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {gast.name}
                          <Badge variant="secondary">Gast</Badge>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            gast.notiz,
                            rolleZeigen && gast.rolle ? rolleLabel(gast.rolle) : null,
                            gast.einheitIds.length === 0
                              ? einheiten.length > 0
                                ? "Alle Einheiten"
                                : null
                              : einheiten
                                  .filter((einheit) => gast.einheitIds.includes(einheit.id))
                                  .map((einheit) => einheit.titel)
                                  .join(", "),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const ergebnis = await deleteGast(gast.id);
                          if ("error" in ergebnis) {
                            toast.error(ergebnis.error);
                            return;
                          }
                          toast.success("Gast entfernt.");
                          if (event) await ladenHandgaeste(event.id);
                          onReload();
                        }}
                      >
                        Entfernen
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {/* PROJ-59: Liegt über der Gästeliste, damit sie nach dem Stornieren
            gleich den neuen Stand zeigt. */}
        <StornoDialog
          ticketId={stornoTicket}
          onOpenChange={(offen) => {
            if (!offen) setStornoTicket(null);
          }}
          onErledigt={onReload}
        />

        {event && neuOffen ? (
          <GastDialog
            eventId={event.id}
            einheiten={einheiten}
            rolleZeigen={rolleZeigen}
            onClose={() => setNeuOffen(false)}
            onSaved={async () => {
              setNeuOffen(false);
              await ladenHandgaeste(event.id);
              onReload();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function rolleLabel(rolle: string | null): string {
  return danceRoleOptions.find((wahl) => wahl.value === rolle)?.label ?? "—";
}

function GastDialog({
  eventId,
  einheiten,
  rolleZeigen,
  onClose,
  onSaved,
}: {
  eventId: string;
  einheiten: { id: string; titel: string }[];
  rolleZeigen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  return (
    <Dialog open onOpenChange={(offen) => !offen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gast eintragen</DialogTitle>
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
              const ergebnis = await createGast(eventId, new FormData(ereignis.currentTarget));
              if ("error" in ergebnis) {
                setFehler(ergebnis.error);
                return;
              }
              toast.success("Gast eingetragen.");
              onSaved();
            } finally {
              setLaeuft(false);
            }
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="gast-name">Name</Label>
            <Input id="gast-name" name="name" required placeholder="z. B. Maria (Lehrerin)" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="gast-notiz">Notiz (optional)</Label>
            <Input id="gast-notiz" name="note" placeholder="z. B. Gast von Lisa" />
          </div>

          {rolleZeigen ? (
            <div className="space-y-1">
              <Label htmlFor="gast-rolle">Tanzrolle (optional)</Label>
              <select
                id="gast-rolle"
                name="dance_role"
                defaultValue=""
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Keine Angabe</option>
                {danceRoleOptions.map((wahl) => (
                  <option key={wahl.value} value={wahl.value}>
                    {wahl.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {einheiten.length > 0 ? (
            <div className="space-y-2">
              <Label>Einheiten</Label>
              <p className="text-xs text-muted-foreground">Nichts angehakt heißt: gilt für alle.</p>
              <div className="space-y-2 rounded-md border p-3">
                {einheiten.map((einheit) => (
                  <div key={einheit.id} className="flex items-center gap-2">
                    <Checkbox id={`gast-einheit-${einheit.id}`} name="unit_ids" value={einheit.id} />
                    <Label htmlFor={`gast-einheit-${einheit.id}`} className="font-normal">
                      {einheit.titel}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={laeuft}>
              {laeuft ? "Wird gespeichert…" : "Eintragen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
