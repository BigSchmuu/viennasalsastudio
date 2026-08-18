"use client";

import { useState, useTransition } from "react";
import { checkinTicket, searchEventTickets, type CheckinEventRow, type TicketSearchRow } from "@/lib/actions/checkin";
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

export function CheckinClient({ events }: { events: CheckinEventRow[] }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [scannerOn, setScannerOn] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TicketSearchRow[]>([]);
  const [, startSearch] = useTransition();

  async function handleCheckin(ticketId: string) {
    const outcome = await checkinTicket(ticketId);
    if ("error" in outcome) {
      setResult({ type: "error", message: outcome.error });
    } else if ("alreadyCheckedIn" in outcome) {
      setResult({ type: "already", checkedInAt: outcome.checkedInAt });
    } else {
      setResult({ type: "success", customerName: outcome.ticket.customerName, paymentMethod: outcome.ticket.paymentMethod });
    }
    if (eventId) {
      setResults(await searchEventTickets(eventId, query));
    }
  }

  function handleSearch(value: string) {
    setQuery(value);
    startSearch(async () => {
      if (eventId) setResults(await searchEventTickets(eventId, value));
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
              {e.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
                <p className="font-medium">{r.customerName}</p>
                <p className="text-xs text-muted-foreground">
                  {ticketPaymentMethodLabel[r.paymentMethod as "sepa" | "onsite"] ?? r.paymentMethod} ·{" "}
                  {ticketStatusLabel(r.status)}
                </p>
              </div>
              <Button size="sm" disabled={r.status === "checked_in"} onClick={() => handleCheckin(r.id)}>
                {r.status === "checked_in" ? `Eingecheckt ${formatTime(r.checkedInAt!)}` : "Einchecken"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
