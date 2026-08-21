"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { SortableHeader } from "@/components/admin/sortable-header";
import { subscriptionStatusColor } from "@/lib/constants/subscription-status";

export type CustomerStatus = "active" | "paused" | "cancelled" | "none";

export const customerStatusOptions: { value: CustomerStatus; label: string }[] = [
  { value: "active", label: "Aktiv" },
  { value: "paused", label: "Pausiert" },
  { value: "cancelled", label: "Gekündigt" },
  { value: "none", label: "Kein Abo" },
];

function customerStatusLabel(status: CustomerStatus): string {
  return customerStatusOptions.find((o) => o.value === status)?.label ?? "—";
}

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  subscriptionCount: number;
  status: CustomerStatus;
  createdAt: string;
};

const ALL_STATUS = "__all__";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function CustomerList({
  customers,
  initialSearch,
  initialStatus,
}: {
  customers: CustomerRow[];
  initialSearch: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);

  function pushParams(next: { q?: string; status?: string }) {
    const params = new URLSearchParams();
    const q = next.q ?? initialSearch;
    const status = next.status ?? initialStatus;
    if (q.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    router.push(`/admin/kunden${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function resetFilters() {
    setSearch("");
    router.push("/admin/kunden");
  }

  const filtersActive = initialSearch !== "" || initialStatus !== "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="customer-search">Suche</Label>
          <Input
            id="customer-search"
            placeholder="Name oder E-Mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="customer-status">Status</Label>
          <Select
            value={initialStatus || ALL_STATUS}
            onValueChange={(value) => pushParams({ status: value === ALL_STATUS ? "" : value })}
          >
            <SelectTrigger id="customer-status" className="w-40">
              <SelectValue placeholder="Alle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS}>Alle</SelectItem>
              {customerStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm" onClick={() => pushParams({ q: search })}>
          Filtern
        </Button>
        {filtersActive && (
          <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {customers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {filtersActive ? "Keine Kunden gefunden." : "Noch keine Kunden registriert."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader label="Name" sortKey="name" />
              <TableHead>E-Mail</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Abos</TableHead>
              <SortableHeader label="Erstellt am" sortKey="created_at" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/kunden/${customer.id}`} className="hover:underline">
                    {customer.name}
                  </Link>
                </TableCell>
                <TableCell>{customer.email}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    style={
                      customer.status === "none"
                        ? undefined
                        : { borderColor: subscriptionStatusColor(customer.status), color: subscriptionStatusColor(customer.status) }
                    }
                  >
                    {customerStatusLabel(customer.status)}
                  </Badge>
                </TableCell>
                <TableCell>{customer.subscriptionCount}</TableCell>
                <TableCell>{formatDate(customer.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
