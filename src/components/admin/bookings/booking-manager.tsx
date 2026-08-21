"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { confirmRegularBooking, confirmDropinBooking, rejectBooking } from "@/lib/actions/admin/bookings";
import {
  bookingTypeValues,
  bookingTypeLabel,
  bookingStatusLabel,
  bookingStatusColor,
  desiredPlanLabel,
} from "@/lib/constants/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { SortableHeader } from "@/components/admin/sortable-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const ALL_TYPES = "__all__";

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("de-AT");
}

function formatPrice(price: number): string {
  return price.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

export type AdminBookingRow = {
  id: string;
  customerId: string;
  customerName: string;
  courseName: string;
  type: string;
  status: string;
  chosenDate: string;
  desiredPlan: string | null;
  note: string | null;
  price: number | null;
  coursePrice: number | null;
};

export function BookingManager({
  bookings: initialBookings,
  initialType,
}: {
  bookings: AdminBookingRow[];
  initialType: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bookings, setBookings] = useState(initialBookings);

  // initialBookings only seeds state on first mount — without this, a
  // server-driven change (filter/sort navigation) would be silently
  // ignored because the component stays mounted across the URL change.
  useEffect(() => {
    setBookings(initialBookings);
  }, [initialBookings]);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AdminBookingRow | null>(null);
  const [subName, setSubName] = useState("");
  const [subPrice, setSubPrice] = useState("");

  function applyTypeFilter(type: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (type) params.set("type", type);
    else params.delete("type");
    router.push(`/admin/buchungen${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function updateStatus(id: string, status: string) {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }

  async function handleReject(id: string) {
    setLoadingId(id);
    setError(null);
    try {
      const result = await rejectBooking(id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      updateStatus(id, "rejected");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleConfirmDropin(id: string) {
    setLoadingId(id);
    setError(null);
    try {
      const result = await confirmDropinBooking(id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      updateStatus(id, "confirmed");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleConfirmRegular() {
    if (!confirmTarget) return;
    setLoadingId(confirmTarget.id);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("name", subName);
      formData.set("price", subPrice);
      const result = await confirmRegularBooking(confirmTarget.id, formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      updateStatus(confirmTarget.id, "confirmed");
      setConfirmTarget(null);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="booking-type-filter">Art</Label>
          <Select
            value={initialType || ALL_TYPES}
            onValueChange={(value) => applyTypeFilter(value === ALL_TYPES ? "" : value)}
          >
            <SelectTrigger id="booking-type-filter" className="w-48">
              <SelectValue placeholder="Alle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TYPES}>Alle</SelectItem>
              {bookingTypeValues.map((type) => (
                <SelectItem key={type} value={type}>
                  {bookingTypeLabel[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {initialType && (
          <Button type="button" variant="outline" size="sm" onClick={() => applyTypeFilter("")}>
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {initialType ? "Keine Buchungen gefunden." : "Noch keine Buchungen vorhanden."}
        </p>
      ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader label="Kunde" sortKey="customer_name" />
            <SortableHeader label="Kurs" sortKey="course_name" />
            <TableHead>Art</TableHead>
            <SortableHeader label="Termin" sortKey="chosen_date" />
            <TableHead>Details</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => (
            <TableRow key={booking.id}>
              <TableCell className="font-medium">
                <Link href={`/admin/kunden/${booking.customerId}`} className="hover:underline">
                  {booking.customerName}
                </Link>
              </TableCell>
              <TableCell>{booking.courseName}</TableCell>
              <TableCell>{bookingTypeLabel[booking.type as keyof typeof bookingTypeLabel] ?? booking.type}</TableCell>
              <TableCell>{formatDate(booking.chosenDate)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {booking.desiredPlan && desiredPlanLabel(booking.desiredPlan)}
                {booking.price !== null && ` ${formatPrice(booking.price)}`}
                {booking.note && ` — ${booking.note}`}
              </TableCell>
              <TableCell>
                <Badge style={{ backgroundColor: bookingStatusColor(booking.status), color: "white" }}>
                  {bookingStatusLabel(booking.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-right space-x-2">
                {booking.status === "open" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loadingId === booking.id}
                      onClick={() => {
                        if (booking.type === "regular") {
                          setConfirmTarget(booking);
                          setSubName(booking.courseName);
                          setSubPrice(booking.coursePrice != null ? String(booking.coursePrice) : "");
                          setError(null);
                        } else {
                          handleConfirmDropin(booking.id);
                        }
                      }}
                    >
                      Bestätigen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loadingId === booking.id}
                      onClick={() => handleReject(booking.id)}
                    >
                      Ablehnen
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      )}

      <Dialog open={confirmTarget !== null} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abo anlegen und Buchung bestätigen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="sub-name">Abo-Name</Label>
              <Input id="sub-name" value={subName} onChange={(e) => setSubName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sub-price">Preis (€)</Label>
              <Input
                id="sub-price"
                type="number"
                step="0.01"
                min="0"
                value={subPrice}
                onChange={(e) => setSubPrice(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={!subName || !subPrice || loadingId === confirmTarget?.id} onClick={handleConfirmRegular}>
              Bestätigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
