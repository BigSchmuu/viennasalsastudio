"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { eventSchema, createEventSchema, type EventInput } from "@/lib/validations/events";
import { createEvent, updateEvent, cancelEvent, getEventGuestList, type EventGuestRow } from "@/lib/actions/admin/events";
import { ticketPaymentMethodLabel, ticketStatusLabel, ticketStatusColor } from "@/lib/constants/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export type EventRow = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  capacity: number;
  priceNormal: number;
  priceStudent: number;
  status: string;
  ticketCount: number;
};

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function EventManager({ events }: { events: EventRow[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<EventRow | null>(null);
  const [guestListEvent, setGuestListEvent] = useState<EventRow | null>(null);
  const [guests, setGuests] = useState<EventGuestRow[] | null>(null);
  const [guestsLoading, setGuestsLoading] = useState(false);

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
      <div className="flex justify-end">
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
            <TableHead>Termin</TableHead>
            <TableHead>Kapazität</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell className="font-medium">{event.name}</TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDateTime(event.startsAt)}
              </TableCell>
              <TableCell>
                {event.ticketCount} / {event.capacity}
              </TableCell>
              <TableCell>
                <Badge variant={event.status === "abgesagt" ? "destructive" : "secondary"}>
                  {event.status === "abgesagt" ? "Abgesagt" : "Geplant"}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => openGuestList(event)}>
                  Gästeliste
                </Button>
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
          {events.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Noch keine Events angelegt.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editing}
        onSaved={() => router.refresh()}
      />

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Event absagen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{cancelTarget?.name}&rdquo; wird als abgesagt markiert und verschwindet von der öffentlichen Seite.
              Bereits gekaufte Tickets bleiben als Datensatz erhalten.
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
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventRow | null;
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
      starts_at: event ? toDatetimeLocal(event.startsAt) : "",
      ends_at: event?.endsAt ? toDatetimeLocal(event.endsAt) : "",
      capacity: event ? String(event.capacity) : "",
      price_normal: event ? String(event.priceNormal) : "",
      price_student: event ? String(event.priceStudent) : "",
    },
  });

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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung (optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
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
                    <FormLabel>Ende (optional, mehrtägig)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kapazität</FormLabel>
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
                    <FormLabel>Preis normal (€)</FormLabel>
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
                    <FormLabel>Preis Studierende (€)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "Wird gespeichert…" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function GuestListDialog({
  event,
  guests,
  loading,
  onOpenChange,
}: {
  event: EventRow | null;
  guests: EventGuestRow[] | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!event} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gästeliste — {event?.name}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Wird geladen…</p>
        ) : !guests || guests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Tickets verkauft.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Zahlungsart</TableHead>
                <TableHead>Status</TableHead>
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
                  <TableCell>{ticketPaymentMethodLabel[g.paymentMethod as "sepa" | "onsite"] ?? g.paymentMethod}</TableCell>
                  <TableCell>
                    <Badge style={{ backgroundColor: ticketStatusColor(g.status) }} className="text-white">
                      {ticketStatusLabel(g.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
