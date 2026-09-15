"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  checkinGast,
  checkinTicket,
  listCheckinEinheiten,
  searchEventTickets,
  type CheckinEinheit,
  type CheckinEventRow,
  type TicketSearchRow,
} from "@/lib/actions/checkin";
import { danceRoleOptions } from "@/lib/constants/booking";
import { vorgeschlageneEinheit } from "@/lib/events/tickets";
import { ticketPaymentMethodLabel, ticketStatusLabel } from "@/lib/constants/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrScanner } from "@/components/checkin/qr-scanner";

type ScanResult =
  | { type: "success"; customerName: string; paymentMethod: string }
  | { type: "already"; checkedInAt: string }
  | { type: "error"; message: string };

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" });
}

/** PROJ-54: Bei einer Serie heißen alle Termine gleich — das Datum unterscheidet sie. */
function eventLabel(name: string, startsAt: string): string {
  const wann = new Date(startsAt).toLocaleString("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${name} · ${wann}`;
}

export function CheckinClient({ events, isAdmin }: { events: CheckinEventRow[]; isAdmin: boolean }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [einheiten, setEinheiten] = useState<CheckinEinheit[]>([]);
  const [einheitId, setEinheitId] = useState<string>("");
  const [scannerOn, setScannerOn] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TicketSearchRow[]>([]);
  const [, startSearch] = useTransition();

  // PROJ-56: Das Programm des gewählten Termins. Vorgeschlagen ist die
  // laufende Einheit, sonst die nächste — an der Tür steht jemand mit dem
  // Telefon in der Hand, während Leute hereinkommen.
  useEffect(() => {
    const event = events.find((e) => e.id === eventId);
    let aktuell = true;
    // Erst holen, dann setzen — auch im Fall ohne Programm. Ein Zustandswechsel
    // mitten im Effekt laesst React im selben Durchgang neu rendern.
    (async () => {
      const geladen = await (event?.hatEinheiten
        ? listCheckinEinheiten(eventId)
        : Promise.resolve<CheckinEinheit[]>([]));
      if (!aktuell) return;
      setEinheiten(geladen);
      setEinheitId(vorgeschlageneEinheit(geladen, new Date())?.id ?? "");
    })();
    return () => {
      aktuell = false;
    };
  }, [eventId, events]);

  async function handleCheckin(ticketId: string, art: "ticket" | "gast" = "ticket") {
    if (!eventId) {
      setResult({ type: "error", message: "Bitte zuerst den Termin wählen." });
      return;
    }
    if (einheiten.length > 0 && !einheitId) {
      setResult({ type: "error", message: "Bitte zuerst die Einheit wählen." });
      return;
    }
    const einheit = einheiten.length > 0 ? einheitId : null;
    const outcome = art === "gast"
      ? await checkinGast(ticketId, eventId, einheit)
      : await checkinTicket(ticketId, eventId, einheit);
    if ("error" in outcome) {
      setResult({ type: "error", message: outcome.error });
    } else if ("alreadyCheckedIn" in outcome) {
      setResult({ type: "already", checkedInAt: outcome.checkedInAt });
    } else {
      setResult({ type: "success", customerName: outcome.ticket.customerName, paymentMethod: outcome.ticket.paymentMethod });
    }
    if (eventId) {
      setResults(await searchEventTickets(eventId, query, einheitId || null));
    }
  }

  function handleSearch(value: string) {
    setQuery(value);
    startSearch(async () => {
      if (eventId) setResults(await searchEventTickets(eventId, value, einheitId || null));
    });
  }

  if (events.length === 0) {
    return <p className="text-muted-foreground">Keine anstehenden Events zum Einchecken.</p>;
  }

  return (
    <div className="space-y-4">
      <Select
        value={eventId}
        onValueChange={(value) => {
          setEventId(value);
          setResult(null);
          setResults([]);
          setQuery("");
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Event wählen" />
        </SelectTrigger>
        <SelectContent>
          {events.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {eventLabel(e.name, e.startsAt)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {einheiten.length > 0 ? (
        <Select
          value={einheitId}
          onValueChange={(value) => {
            setEinheitId(value);
            setResult(null);
            setResults([]);
            setQuery("");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Einheit wählen" />
          </SelectTrigger>
          <SelectContent>
            {einheiten.map((einheit) => (
              <SelectItem key={einheit.id} value={einheit.id}>
                {einheit.titel} · {formatTime(einheit.startsAt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {result && (
        <Alert variant={result.type === "error" ? "destructive" : "default"}>
          <AlertDescription>
            {result.type === "success" &&
              `✅ ${result.customerName} eingecheckt (${ticketPaymentMethodLabel[result.paymentMethod as "sepa" | "onsite"] ?? result.paymentMethod})`}
            {result.type === "already" && `⚠️ Bereits eingecheckt um ${formatTime(result.checkedInAt)}`}
            {result.type === "error" && `❌ ${result.message}`}
          </AlertDescription>
        </Alert>
      )}

      <Button variant="outline" onClick={() => setScannerOn((v) => !v)}>
        {scannerOn ? "Kamera stoppen" : "Kamera-Scan starten"}
      </Button>

      {scannerOn && <QrScanner onScan={handleCheckin} />}

      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium">Manuelle Suche (Fallback)</p>
        <Input placeholder="Name suchen…" value={query} onChange={(e) => handleSearch(e.target.value)} />
        <div className="space-y-1">
          {results.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <div>
                <p className="font-medium">
                  {isAdmin ? (
                    <Link href={`/admin/kunden/${r.customerId}`} className="hover:underline">
                      {r.customerName}
                    </Link>
                  ) : (
                    r.customerName
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.art === "gast"
                    ? ["Gast", r.ticketart].filter(Boolean).join(" · ")
                    : [
                        ticketPaymentMethodLabel[r.paymentMethod as "sepa" | "onsite"] ?? r.paymentMethod,
                        ticketStatusLabel(r.status),
                        r.ticketart,
                        r.einheit,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                  {r.rolle ? ` · ${danceRoleOptions.find((w) => w.value === r.rolle)?.label ?? r.rolle}` : ""}
                </p>
              </div>
              <Button
                size="sm"
                disabled={!!r.checkedInAt}
                onClick={() => handleCheckin(r.id, r.art)}
              >
                {r.checkedInAt ? `Eingecheckt ${formatTime(r.checkedInAt)}` : "Einchecken"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
