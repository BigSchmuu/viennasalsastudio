"use client";

import { useState } from "react";
import { cancelBooking, rebookBooking } from "@/lib/actions/booking";
import { bookingTypeLabel, bookingStatusLabel, bookingStatusColor, desiredPlanLabel } from "@/lib/constants/booking";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TermsConsent } from "@/components/booking/terms-consent";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}

export type MyBookingRow = {
  id: string;
  courseName: string;
  type: string;
  status: string;
  chosenDate: string;
  desiredPlan: string | null;
  price: number | null;
  canCancel: boolean;
  canRebook: boolean;
  availableDates: string[];
};

function formatPrice(price: number): string {
  return price.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

export function MyBookingsSection({ bookings: initialBookings }: { bookings: MyBookingRow[] }) {
  const [bookings, setBookings] = useState(initialBookings);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [rebookTarget, setRebookTarget] = useState<MyBookingRow | null>(null);
  const [newDate, setNewDate] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  async function handleCancel(bookingId: string) {
    setLoadingId(bookingId);
    setError(null);
    try {
      const result = await cancelBooking(bookingId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: "cancelled", canCancel: false, canRebook: false } : b)));
    } finally {
      setLoadingId(null);
    }
  }

  async function handleRebook() {
    if (!rebookTarget || !newDate) return;
    setLoadingId(rebookTarget.id);
    setError(null);
    try {
      const result = await rebookBooking(rebookTarget.id, newDate, termsAccepted);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setBookings((prev) => [
        ...prev.map((b) => (b.id === rebookTarget.id ? { ...b, status: "cancelled", canCancel: false, canRebook: false } : b)),
        {
          id: result.booking.id,
          courseName: rebookTarget.courseName,
          type: result.booking.type,
          status: result.booking.status,
          chosenDate: result.booking.chosenDate,
          desiredPlan: result.booking.desiredPlan,
          price: result.booking.price,
          canCancel: true,
          canRebook: true,
          availableDates: rebookTarget.availableDates,
        },
      ]);
      setRebookTarget(null);
      setNewDate("");
    } finally {
      setLoadingId(null);
    }
  }

  if (bookings.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Noch keine Buchungen vorhanden.</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ul className="space-y-2">
        {bookings.map((booking) => (
          <li key={booking.id} className="rounded-md border p-3 text-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{booking.courseName}</span>
              <Badge style={{ backgroundColor: bookingStatusColor(booking.status), color: "white" }}>
                {bookingStatusLabel(booking.status)}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {bookingTypeLabel[booking.type as keyof typeof bookingTypeLabel] ?? booking.type} ·{" "}
              {formatDate(booking.chosenDate)}
              {booking.desiredPlan && ` · ${desiredPlanLabel(booking.desiredPlan)}`}
              {booking.price !== null && ` · ${formatPrice(booking.price)}`}
            </p>
            {(booking.canCancel || booking.canRebook) && (
              <div className="flex gap-2 pt-1">
                {booking.canCancel && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingId === booking.id}
                    onClick={() => handleCancel(booking.id)}
                  >
                    Stornieren
                  </Button>
                )}
                {booking.canRebook && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingId === booking.id}
                    onClick={() => {
                      setRebookTarget(booking);
                      setNewDate("");
                      // Dieser Dialog bleibt gemountet — ohne Zuruecksetzen
                      // waere das Haekchen beim naechsten Umbuchen noch gesetzt.
                      setTermsAccepted(false);
                      setError(null);
                    }}
                  >
                    Umbuchen
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={rebookTarget !== null} onOpenChange={(open) => !open && setRebookTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Umbuchen</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Select value={newDate} onValueChange={setNewDate}>
              <SelectTrigger>
                <SelectValue placeholder="Neuer Termin" />
              </SelectTrigger>
              <SelectContent>
                {(rebookTarget?.availableDates ?? []).map((date) => (
                  <SelectItem key={date} value={date}>
                    {formatDate(date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* PROJ-42: Auch das Umbuchen legt eine neue Buchung an — sie trägt
              ihre eigene Zustimmung, ohne Sonderweg. */}
          <TermsConsent checked={termsAccepted} onCheckedChange={setTermsAccepted} id="terms-accepted-rebook" />
          <DialogFooter>
            <Button disabled={!newDate || !termsAccepted || loadingId === rebookTarget?.id} onClick={handleRebook}>
              Umbuchen bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
