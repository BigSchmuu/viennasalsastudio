"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

export type OpenItemRow = {
  id: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  bouncedAt: string;
  grossAmount: number;
  bounceFee: number;
  remindedAt: string | null;
  settledAt: string | null;
  hasEmail: boolean;
};

function formatEUR(amount: number): string {
  return amount.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Days since the bounce — counted from the bounce, not the invoice date: that
 * is when the money actually failed to arrive. */
function daysOpen(bouncedAt: string): number {
  const diff = Date.now() - new Date(bouncedAt).getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

export function OpenItemsList({ items, showSettled }: { items: OpenItemRow[]; showSettled: boolean }) {
  const open = items.filter((i) => !i.settledAt);
  // The tile answers "how much is missing" — the fee was really paid to the
  // bank, so leaving it out would understate the gap.
  const totalOwed = open.reduce((sum, i) => sum + i.grossAmount + i.bounceFee, 0);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Offene Posten</p>
        <p className="text-3xl font-bold tabular-nums">{formatEUR(totalOwed)}</p>
        <p className="text-sm text-muted-foreground">
          {open.length === 1 ? "1 offener Posten" : `${open.length} offene Posten`}
          {open.length > 0 && " — Rechnungsbeträge inklusive Rücklastschrift-Gebühren"}
        </p>
      </div>

      <Button variant="outline" size="sm" asChild>
        <Link href={showSettled ? "/admin/offene-posten" : "/admin/offene-posten?erledigte=1"}>
          {showSettled ? "Nur offene anzeigen" : "Auch erledigte anzeigen"}
        </Link>
      </Button>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">
          Keine offenen Posten. Alle Lastschriften sind eingegangen.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kunde</TableHead>
              <TableHead>Rechnung</TableHead>
              <TableHead>Rückgebucht</TableHead>
              <TableHead className="text-right">Rechnungsbetrag</TableHead>
              <TableHead className="text-right">Gebühr</TableHead>
              <TableHead className="text-right">Gesamt</TableHead>
              <TableHead>Erinnert</TableHead>
              <TableHead className="text-right">Aktion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className={item.settledAt ? "opacity-60" : undefined}>
                <TableCell>
                  <Link href={`/admin/kunden/${item.customerId}`} className="hover:underline">
                    {item.customerName}
                  </Link>
                  {item.settledAt && (
                    <Badge variant="secondary" className="ml-2">
                      Erledigt
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/rechnungen/${item.id}`} className="hover:underline">
                    {item.invoiceNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  {formatDate(item.bouncedAt)}
                  <span className="block text-xs text-muted-foreground">
                    {daysOpen(item.bouncedAt) === 1 ? "seit 1 Tag" : `seit ${daysOpen(item.bouncedAt)} Tagen`}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatEUR(item.grossAmount)}</TableCell>
                <TableCell className="text-right">
                  <Input
                    aria-label={`Gebühr für Rechnung ${item.invoiceNumber}`}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={item.bounceFee.toFixed(2)}
                    disabled
                    className="w-24 text-right tabular-nums ml-auto"
                  />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatEUR(item.grossAmount + item.bounceFee)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {item.remindedAt ? formatDate(item.remindedAt) : "—"}
                </TableCell>
                <TableCell className="text-right space-x-2 whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    title={item.hasEmail ? undefined : "Kunde hat keine E-Mail-Adresse hinterlegt"}
                  >
                    Erinnerung senden
                  </Button>
                  <Button size="sm" variant="ghost" disabled>
                    {item.settledAt ? "Wieder öffnen" : "Erledigt"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
