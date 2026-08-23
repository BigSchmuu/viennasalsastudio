"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { SortableHeader } from "@/components/admin/sortable-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CUSTOM_RANGE, monthRange, monthFromRange, recentMonths } from "@/lib/invoices";

export type InvoiceRow = {
  id: string;
  customerId: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  description: string;
  grossAmount: number;
  bounced: boolean;
};

function formatEUR(amount: number): string {
  return amount.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function InvoiceList({
  invoices,
  initialQuery,
  initialFrom,
  initialTo,
}: {
  invoices: InvoiceRow[];
  initialQuery: string;
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  // Two years back covers "last year's figures" without turning the list into a
  // scroll marathon. Computed once per mount — the option list must not shift
  // under the user while the page is open.
  const [months] = useState(() => recentMonths(24));

  // Derived, not stored: editing Von/Bis by hand immediately falls back to
  // "Eigener Zeitraum" instead of leaving a month label that no longer matches.
  const selectedMonth = monthFromRange(from, to) ?? CUSTOM_RANGE;

  function pickMonth(value: string) {
    if (value === CUSTOM_RANGE) {
      setFrom("");
      setTo("");
      return;
    }
    const range = monthRange(value);
    if (!range) return;
    setFrom(range.from);
    setTo(range.to);
  }

  function applyFilters() {
    // Preserve any active sort — filtering shouldn't reset it.
    const params = new URLSearchParams();
    const sort = searchParams.get("sort");
    const dir = searchParams.get("dir");
    if (sort) params.set("sort", sort);
    if (dir) params.set("dir", dir);
    if (query.trim()) params.set("q", query.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    router.push(`/admin/rechnungen${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function resetFilters() {
    setQuery("");
    setFrom("");
    setTo("");
    router.push("/admin/rechnungen");
  }

  const exportParams = new URLSearchParams();
  if (initialQuery) exportParams.set("q", initialQuery);
  if (initialFrom) exportParams.set("from", initialFrom);
  if (initialTo) exportParams.set("to", initialTo);
  const exportHref = `/api/admin/rechnungen/export${exportParams.toString() ? `?${exportParams.toString()}` : ""}`;

  const filtersActive =
    initialQuery !== "" || initialFrom !== "" || initialTo !== "" || searchParams.has("sort");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="invoice-search">Kunde</Label>
          <Input
            id="invoice-search"
            placeholder="Name suchen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-48"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invoice-month">Monat</Label>
          <Select value={selectedMonth} onValueChange={pickMonth}>
            <SelectTrigger id="invoice-month" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CUSTOM_RANGE}>Eigener Zeitraum</SelectItem>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="invoice-from">Von</Label>
          <Input id="invoice-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invoice-to">Bis</Label>
          <Input id="invoice-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button type="button" size="sm" onClick={applyFilters}>
          Filtern
        </Button>
        {filtersActive && (
          <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
            Filter zurücksetzen
          </Button>
        )}
        <Button variant="outline" size="sm" className="ml-auto" asChild>
          <a href={exportHref}>CSV exportieren</a>
        </Button>
      </div>

      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground py-16 text-center">Keine Rechnungen gefunden.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nummer</TableHead>
              <SortableHeader label="Datum" sortKey="invoice_date" />
              <SortableHeader label="Kunde" sortKey="customer_name" />
              <SortableHeader label="Betrag" sortKey="gross_amount" />
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">
                  <Link href={`/rechnungen/${invoice.id}`} className="hover:underline">
                    {invoice.invoiceNumber}
                  </Link>
                </TableCell>
                <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                <TableCell>
                  <Link href={`/admin/kunden/${invoice.customerId}`} className="hover:underline">
                    {invoice.customerName}
                  </Link>
                </TableCell>
                <TableCell>{formatEUR(invoice.grossAmount)}</TableCell>
                <TableCell>
                  <Badge variant={invoice.bounced ? "destructive" : "default"}>
                    {invoice.bounced ? "Rücklastschrift" : "Bezahlt"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
