"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adjustCustomerCredit } from "@/lib/actions/admin/credits";
import { formatPrice } from "@/lib/pricing";
import { formatDate } from "@/lib/formatting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

export type CreditEntry = {
  id: string;
  amount: number;
  origin: "referral" | "manual" | "redeemed";
  reason: string | null;
  createdAt: string;
};

const originLabel: Record<CreditEntry["origin"], string> = {
  referral: "Empfehlung",
  manual: "von Hand",
  redeemed: "verrechnet",
};

/**
 * Guthaben eines Kunden: Kontostand, Verlauf und die Pflege von Hand (PROJ-44).
 *
 * Der Verlauf steht bewusst neben dem Kontostand. Eine Zahl allein beantwortet
 * nicht, warum jemand 45 € hat — und genau das muss der Betreiber Monate später
 * nachvollziehen können.
 */
export function CreditManager({
  customerId,
  balance,
  entries,
}: {
  customerId: string;
  balance: number;
  entries: CreditEntry[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"grant" | "deduct" | null>(null);

  async function absenden(direction: "grant" | "deduct") {
    setLoading(direction);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("customer_id", customerId);
      formData.set("direction", direction);
      formData.set("amount", amount);
      formData.set("reason", reason);
      const result = await adjustCustomerCredit(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast.success(direction === "grant" ? "Guthaben gutgeschrieben." : "Guthaben abgezogen.");
      setAmount("");
      setReason("");
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  const eingabeFehlt = !amount.trim() || !reason.trim();

  return (
    <div className="rounded-md border p-4 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">Guthaben</p>
        <p className="text-lg font-semibold tabular-nums">{formatPrice(balance)}</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="credit-amount">Betrag (€)</Label>
          <Input
            id="credit-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-28"
          />
        </div>
        <div className="space-y-1 flex-1 min-w-48">
          <Label htmlFor="credit-reason">Grund</Label>
          <Input
            id="credit-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="z.B. Ausgleich für den Kursausfall am 12.03."
          />
        </div>
        <Button type="button" size="sm" disabled={!!loading || eingabeFehlt} onClick={() => absenden("grant")}>
          {loading === "grant" ? "Wird gebucht…" : "Gutschreiben"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!!loading || eingabeFehlt}
          onClick={() => absenden("deduct")}
        >
          {loading === "deduct" ? "Wird gebucht…" : "Abziehen"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Der Grund ist Pflicht — ein Kontostand ohne Erklärung ist in drei Monaten nicht mehr nachvollziehbar.
      </p>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch kein Guthaben-Verlauf.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Woher</TableHead>
                <TableHead>Grund</TableHead>
                <TableHead className="text-right">Betrag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(entry.createdAt)}</TableCell>
                  <TableCell>{originLabel[entry.origin]}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{entry.reason ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {entry.amount > 0 ? "+" : ""}
                    {formatPrice(entry.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
