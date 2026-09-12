"use client";

import { useState } from "react";
import { cancelBooking, rebookBooking } from "@/lib/actions/booking";
import { bookingStatusColor } from "@/lib/constants/booking";
import { istFrueher } from "@/lib/bookings/verlauf";
import { heuteInWien } from "@/lib/constants/zeitzone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TermsConsent } from "@/components/booking/terms-consent";
import { useTranslations } from "next-intl";
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
  /** PROJ-8: Status des Abos, das aus dieser Anfrage entstand — für „frühere". */
  aboStatus: string | null;
  price: number | null;
  canCancel: boolean;
  canRebook: boolean;
  availableDates: string[];
};

/**
 * Beschriftungen aus den Sprachdateien, nicht aus `constants/booking.ts`.
 *
 * Dort stehen sie fest auf Deutsch, und genau das sah der englische Kunde:
 * „My bookings" als Überschrift, darunter „Buchungsanfrage · Bestätigt · Nur
 * diesen Kurs". Gemeldet aus dem Betrieb am 2026-09-12 — dieselbe Klasse
 * Stelle wie „Wie hast du von uns erfahren" bei PROJ-43.
 *
 * Die Konstanten bleiben, wo sie sind: Der Admin-Bereich ist einsprachig
 * deutsch und liest sie weiter.
 */
const TYP_SCHLUESSEL: Record<string, string> = {
  regular: "bookingTypeRegular",
  trial: "bookingTypeTrial",
  dropin: "bookingTypeDropin",
};
const STATUS_SCHLUESSEL: Record<string, string> = {
  open: "bookingStatusOpen",
  confirmed: "bookingStatusConfirmed",
  rejected: "bookingStatusRejected",
  cancelled: "bookingStatusCancelled",
};
const TARIF_SCHLUESSEL: Record<string, string> = {
  single_course: "planSingleCourse",
  flatrate: "planFlatrate",
};

function formatPrice(price: number): string {
  return price.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

export function MyBookingsSection({ bookings: initialBookings }: { bookings: MyBookingRow[] }) {
  const t = useTranslations("profile");

  const [bookings, setBookings] = useState(initialBookings);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [rebookTarget, setRebookTarget] = useState<MyBookingRow | null>(null);
  const [newDate, setNewDate] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // PROJ-8: Aktuelles oben, Erledigtes eingeklappt. Gelöscht wird nichts — der
  // Kunde soll nachsehen können, wann er was gebucht hat, ohne dass fünf tote
  // Zeilen die Liste verstopfen.
  const heute = heuteInWien();
  const aktuell = bookings.filter((b) => !istFrueher(b, heute));
  const frueher = bookings.filter((b) => istFrueher(b, heute));

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
          // Umgebucht wird nur bei Probestunde und Drop-in — dort gibt es kein
          // Abo, an dem die Buchung hängt.
          aboStatus: null,
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
    return <p className="text-sm text-muted-foreground py-4 text-center">{t("noBookings")}</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {aktuell.length === 0 && frueher.length > 0 && (
        <p className="text-sm text-muted-foreground">{t("noCurrentBookings")}</p>
      )}
      <ul className="space-y-2">
        {aktuell.map((booking) => (
          <li key={booking.id} className="rounded-md border p-3 text-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{booking.courseName}</span>
              <Badge style={{ backgroundColor: bookingStatusColor(booking.status), color: "white" }}>
                {t(STATUS_SCHLUESSEL[booking.status] ?? "bookingStatusOpen")}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {TYP_SCHLUESSEL[booking.type] ? t(TYP_SCHLUESSEL[booking.type]) : booking.type} ·{" "}
              {formatDate(booking.chosenDate)}
              {booking.desiredPlan &&
                TARIF_SCHLUESSEL[booking.desiredPlan] &&
                ` · ${t(TARIF_SCHLUESSEL[booking.desiredPlan])}`}
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
                    {t("cancelBooking")}
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
                    {t("rebook")}
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {frueher.length > 0 && (
        <details className="rounded-md border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            {t("pastBookings")}{" "}
            <span className="font-normal text-muted-foreground">({frueher.length})</span>
          </summary>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("pastBookingsHint", { count: frueher.length })}
          </p>
          <ul className="mt-2 space-y-2">
            {frueher.map((booking) => (
              <li key={booking.id} className="rounded-md border p-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{booking.courseName}</span>
                  <Badge
                    style={{ backgroundColor: bookingStatusColor(booking.status), color: "white" }}
                  >
                    {t(STATUS_SCHLUESSEL[booking.status] ?? "bookingStatusOpen")}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  {TYP_SCHLUESSEL[booking.type] ? t(TYP_SCHLUESSEL[booking.type]) : booking.type} ·{" "}
                  {formatDate(booking.chosenDate)}
                  {booking.desiredPlan &&
                    TARIF_SCHLUESSEL[booking.desiredPlan] &&
                    ` · ${t(TARIF_SCHLUESSEL[booking.desiredPlan])}`}
                  {booking.price !== null && ` · ${formatPrice(booking.price)}`}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog open={rebookTarget !== null} onOpenChange={(open) => !open && setRebookTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Umbuchen</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Select value={newDate} onValueChange={setNewDate}>
              <SelectTrigger>
                <SelectValue placeholder={t("newDate")} />
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
              {t("confirmRebook")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
