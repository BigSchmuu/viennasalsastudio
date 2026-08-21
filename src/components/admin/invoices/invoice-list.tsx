"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

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
  const [query, setQuery] = useState(initialQuery);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  function applyFilters() {
    const params = new URLSearchParams();
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

  const filtersActive = initialQuery !== "" || initialFrom !== "" || initialTo !== "";

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
              <TableHead>Datum</TableHead>
              <TableHead>Kunde</TableHead>
              <TableHead>Betrag</TableHead>
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
