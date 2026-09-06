"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  bestaetigeBuchungenStapel,
  confirmDropinBooking,
  confirmRegularBooking,
  lehneBuchungenAbStapel,
  rejectBooking,
} from "@/lib/actions/admin/bookings";
import {
  bookingTypeValues,
  bookingTypeLabel,
  bookingStatusLabel,
  bookingStatusColor,
  bookingStatusOptions,
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
import { formatPrice } from "@/lib/pricing";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  STAPEL_MAX,
  istAuswaehlbar,
  rabattierterPreis,
  stapelBericht,
  stapelHindernis,
  vorschlagFuer,
} from "@/lib/bookings/stapel";
import { toast } from "sonner";

const ALL_TYPES = "__all__";
const ALLE_STATUS = "__alle__";

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("de-AT");
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
  /** PROJ-41: erklärt dem Betreiber, warum der Preis der ermäßigte ist. */
  wantsStudentPrice: boolean;
  /** PROJ-42: `null` bei Buchungen von vor der Einführung der Zustimmung. */
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  coupon: { code: string; discountType: "percent" | "fixed"; discountAmount: number } | null;
};

function formatDiscount(coupon: NonNullable<AdminBookingRow["coupon"]>): string {
  return coupon.discountType === "percent" ? `${coupon.discountAmount}%` : formatPrice(coupon.discountAmount);
}

export function BookingManager({
  bookings: initialBookings,
  initialType,
  initialStatus,
  gesamtzahl,
}: {
  bookings: AdminBookingRow[];
  initialType: string;
  /** Leerer String heißt „Alle" — die Vorgabe „Offen" setzt die Seite. */
  initialStatus: string;
  /** Alle Buchungen ohne Filter, für den Hinweis unter der Liste. */
  gesamtzahl: number;
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

  // PROJ-48: die Stapelauswahl.
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [vorschauOffen, setVorschauOffen] = useState(false);
  const [ablehnenOffen, setAblehnenOffen] = useState(false);
  const [stapelLaeuft, setStapelLaeuft] = useState(false);
  const [uebersprungen, setUebersprungen] = useState<
    { buchungId: string; kundenname: string; grund: string }[]
  >([]);

  // Eine Auswahl auf einer anderen Menge wäre unsichtbar und gefährlich.
  // Der Wechsel des Filters ist eine Navigation, aber darauf allein sollte
  // man sich nicht verlassen: Dieser Baustein bleibt dabei eingehängt.
  useEffect(() => {
    setGewaehlt(new Set());
    setUebersprungen([]);
  }, [initialType, initialStatus]);

  const auswaehlbare = bookings.filter(istAuswaehlbar);
  const gewaehlteBuchungen = auswaehlbare.filter((b) => gewaehlt.has(b.id));
  const vorschlaege = gewaehlteBuchungen.map((b) => ({
    buchung: b,
    vorschlag: vorschlagFuer(b),
  }));
  const ohnePreis = vorschlaege.filter(
    ({ buchung, vorschlag }) => buchung.type === "regular" && vorschlag.preis === null
  );
  const hindernis = stapelHindernis({
    anzahl: gewaehlteBuchungen.length,
    ohnePreis: ohnePreis.length,
  });

  function umschalten(id: string, an: boolean) {
    setGewaehlt((vorher) => {
      const naechste = new Set(vorher);
      if (an) naechste.add(id);
      else naechste.delete(id);
      return naechste;
    });
  }

  function alleUmschalten(an: boolean) {
    setGewaehlt(an ? new Set(auswaehlbare.map((b) => b.id)) : new Set());
  }

  function setzeFilter(name: "type" | "status", wert: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (wert) params.set(name, wert);
    else params.delete(name);
    router.push(`/admin/buchungen${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function applyTypeFilter(type: string) {
    setzeFilter("type", type);
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

  async function stapelBestaetigen() {
    setStapelLaeuft(true);
    setError(null);
    try {
      const ergebnis = await bestaetigeBuchungenStapel(
        vorschlaege.map(({ vorschlag }) => ({
          buchungId: vorschlag.buchungId,
          aboName: vorschlag.aboName,
          preis: vorschlag.preis ?? 0,
        }))
      );
      if ("error" in ergebnis) {
        setError(ergebnis.error);
        return;
      }
      setUebersprungen(ergebnis.uebersprungen);
      toast.success(stapelBericht(ergebnis, "bestätigt"));
      setVorschauOffen(false);
      setGewaehlt(new Set());
      router.refresh();
    } finally {
      setStapelLaeuft(false);
    }
  }

  async function stapelAblehnen() {
    setStapelLaeuft(true);
    setError(null);
    try {
      const ergebnis = await lehneBuchungenAbStapel(gewaehlteBuchungen.map((b) => b.id));
      if ("error" in ergebnis) {
        setError(ergebnis.error);
        return;
      }
      setUebersprungen(ergebnis.uebersprungen);
      toast.success(stapelBericht(ergebnis, "abgelehnt"));
      setAblehnenOffen(false);
      setGewaehlt(new Set());
      router.refresh();
    } finally {
      setStapelLaeuft(false);
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
        <div className="space-y-1">
          <Label htmlFor="booking-status-filter">Status</Label>
          <Select
            value={initialStatus || ALLE_STATUS}
            onValueChange={(wert) => setzeFilter("status", wert === ALLE_STATUS ? "alle" : wert)}
          >
            <SelectTrigger id="booking-status-filter" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALLE_STATUS}>Alle</SelectItem>
              {bookingStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(initialType || initialStatus !== "open") && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("type");
              params.delete("status");
              router.push(`/admin/buchungen${params.toString() ? `?${params.toString()}` : ""}`);
            }}
          >
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {gewaehlteBuchungen.length > 0 && (
        <div
          role="group"
          aria-label="Stapelaktionen"
          className="flex flex-wrap items-center gap-3 rounded-card bg-muted/60 px-4 py-3"
        >
          <p className="text-sm font-medium">
            {gewaehlteBuchungen.length}{" "}
            {gewaehlteBuchungen.length === 1 ? "Buchung" : "Buchungen"} gewählt
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setGewaehlt(new Set())}>
              Auswahl aufheben
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={stapelLaeuft}
              onClick={() => setAblehnenOffen(true)}
            >
              Ablehnen
            </Button>
            <Button
              size="sm"
              disabled={stapelLaeuft || hindernis !== null}
              onClick={() => setVorschauOffen(true)}
            >
              Bestätigen
            </Button>
          </div>
          {hindernis === "zu_gross" && (
            <p className="w-full text-sm text-destructive">
              Höchstens {STAPEL_MAX} Buchungen auf einmal.
            </p>
          )}
          {hindernis === "preis_fehlt" && (
            <p className="w-full text-sm text-destructive">
              {ohnePreis.length === 1 ? "Einer Buchung" : `${ohnePreis.length} Buchungen`} in der
              Auswahl fehlt ein Preis (
              {ohnePreis.map(({ buchung }) => buchung.customerName).join(", ")}). Diese einzeln
              bestätigen — ein Abo über 0 € fiele niemandem auf.
            </p>
          )}
        </div>
      )}

      {uebersprungen.length > 0 && (
        <Alert>
          <AlertDescription>
            <p className="font-medium">
              {uebersprungen.length}{" "}
              {uebersprungen.length === 1 ? "Buchung wurde" : "Buchungen wurden"} übersprungen:
            </p>
            <ul className="mt-1 list-inside list-disc text-sm">
              {uebersprungen.map((u) => (
                <li key={u.buchungId}>
                  {u.kundenname} — {u.grund}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {initialType ? "Keine Buchungen gefunden." : "Noch keine Buchungen vorhanden."}
        </p>
      ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              {auswaehlbare.length > 0 && (
                <Checkbox
                  aria-label="Alle angezeigten auswählen"
                  checked={
                    gewaehlteBuchungen.length > 0 &&
                    gewaehlteBuchungen.length === auswaehlbare.length
                  }
                  onCheckedChange={(an) => alleUmschalten(an === true)}
                />
              )}
            </TableHead>
            <SortableHeader label="Kunde" sortKey="customer_name" />
            <SortableHeader label="Kurs" sortKey="course_name" />
            <TableHead>Art</TableHead>
            <SortableHeader label="Termin" sortKey="chosen_date" />
            <TableHead>Details</TableHead>
            <TableHead>AGB</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.map((booking) => (
            <TableRow key={booking.id}>
              <TableCell>
                {/* Nur Offenes ist auswählbar — eine Auswahl, die nichts
                    bewirkt, wäre eine Falle. */}
                {istAuswaehlbar(booking) && (
                  <Checkbox
                    aria-label={`${booking.customerName} auswählen`}
                    checked={gewaehlt.has(booking.id)}
                    onCheckedChange={(an) => umschalten(booking.id, an === true)}
                  />
                )}
              </TableCell>
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
                {booking.wantsStudentPrice && " (Studierendenpreis)"}
                {booking.note && ` — ${booking.note}`}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                {/* PROJ-42: „—" statt eines erfundenen Zeitpunkts. Ein falscher
                    Nachweis wäre schlechter als gar keiner. */}
                {booking.termsAcceptedAt
                  ? `${formatDate(booking.termsAcceptedAt)} (Stand ${booking.termsVersion})`
                  : "—"}
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
                          // Prefill with the discounted price when a valid coupon
                          // is attached to a single-course plan; the admin can
                          // still overwrite it freely either way.
                          // PROJ-41: der Preis, der dem Kunden bei der Anfrage
                          // gezeigt wurde. Er steht seit der Anfrage fest — eine
                          // spaetere Preisaenderung darf den Vorschlag nicht
                          // verschieben. `coursePrice` bleibt als Rueckfall fuer
                          // Anfragen von vor dieser Aenderung.
                          const base = booking.price ?? booking.coursePrice;
                          const suggested =
                            base != null && booking.coupon ? rabattierterPreis(base, booking.coupon) : base;
                          setSubPrice(suggested != null ? String(suggested) : "");
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

      {/* Damit niemand glaubt, es gäbe nur diese. */}
      <p className="text-sm text-muted-foreground">
        {bookings.length} von {gesamtzahl} Buchungen
        {initialStatus && ` — Filter: ${bookingStatusLabel(initialStatus)}`}
        {initialType && ` · ${bookingTypeLabel[initialType as keyof typeof bookingTypeLabel]}`}
      </p>

      <Dialog open={vorschauOffen} onOpenChange={setVorschauOffen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {gewaehlteBuchungen.length}{" "}
              {gewaehlteBuchungen.length === 1 ? "Buchung" : "Buchungen"} bestätigen
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1">
            {vorschlaege.map(({ buchung, vorschlag }) => (
              <div
                key={buchung.id}
                className="flex items-baseline justify-between gap-3 border-b py-2 text-sm last:border-b-0"
              >
                <span>
                  <span className="block font-medium">{buchung.customerName}</span>
                  <span className="block text-muted-foreground">
                    {buchung.type === "regular" ? vorschlag.aboName : bookingTypeLabel.dropin}
                    {vorschlag.gutscheinCode && ` · Gutschein ${vorschlag.gutscheinCode}`}
                  </span>
                </span>
                <span className="tabular-nums whitespace-nowrap">
                  {buchung.type === "regular" && vorschlag.preis !== null
                    ? formatPrice(vorschlag.preis)
                    : "—"}
                </span>
              </div>
            ))}
          </div>

          {/* Was hier steht, bucht jeden Monat ab. Deshalb steht es hier. */}
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {vorschlaege.filter(({ buchung }) => buchung.type === "regular").length > 0 ? (
              <>
                Es entstehen{" "}
                {vorschlaege.filter(({ buchung }) => buchung.type === "regular").length} Abos mit
                diesen Namen und Preisen, die monatlich abgebucht werden. Für einen abweichenden
                Preis die Buchung einzeln bestätigen.
              </>
            ) : (
              <>Drop-ins werden nur bestätigt — es entsteht kein Abo.</>
            )}
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setVorschauOffen(false)} disabled={stapelLaeuft}>
              Abbrechen
            </Button>
            <Button onClick={stapelBestaetigen} disabled={stapelLaeuft || hindernis !== null}>
              {stapelLaeuft ? "Wird bestätigt…" : "Bestätigen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={ablehnenOffen} onOpenChange={setAblehnenOffen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">
              {gewaehlteBuchungen.length}{" "}
              {gewaehlteBuchungen.length === 1 ? "Buchung" : "Buchungen"} ablehnen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Jede betroffene Person bekommt eine Nachricht. Bei Buchungsanfragen rückt die
              Warteliste des Kurses nach.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={stapelLaeuft}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={stapelAblehnen} disabled={stapelLaeuft}>
              Ablehnen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={confirmTarget !== null} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abo anlegen und Buchung bestätigen</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {confirmTarget?.coupon && (
              <Alert>
                <AlertDescription>
                  Gutschein <strong>{confirmTarget.coupon.code}</strong>: {formatDiscount(confirmTarget.coupon)} Rabatt
                  {(confirmTarget.price ?? confirmTarget.coursePrice) != null
                    ? ` — Preis bereits rabattiert vorgeschlagen (regulär ${formatPrice((confirmTarget.price ?? confirmTarget.coursePrice)!)}).`
                    : " — bitte beim Preis berücksichtigen."}
                </AlertDescription>
              </Alert>
            )}
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
