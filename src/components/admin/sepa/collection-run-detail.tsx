"use client";

import { useState } from "react";
import Link from "next/link";
import { generateRunXml, markItemBounced } from "@/lib/actions/admin/sepa-collections";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

export type CollectionItemRow = {
  id: string;
  customerId: string;
  customerName: string;
  subscriptionName: string;
  amount: number;
  bouncedAt: string | null;
};

function formatPrice(price: number): string {
  return price.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

function downloadXml(xml: string, filename: string) {
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function CollectionRunDetail({ runId, items: initialItems }: { runId: string; items: CollectionItemRow[] }) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      const result = await generateRunXml(runId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      downloadXml(result.xml, result.filename);
    } finally {
      setDownloading(false);
    }
  }

  async function handleToggleBounced(item: CollectionItemRow) {
    setTogglingId(item.id);
    setError(null);
    try {
      const result = await markItemBounced(item.id, item.bouncedAt === null);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, bouncedAt: i.bouncedAt === null ? new Date().toISOString() : null } : i))
      );
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button type="button" disabled={downloading} onClick={handleDownload}>
          {downloading ? "Wird erstellt…" : "SEPA-XML herunterladen"}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kunde</TableHead>
            <TableHead>Abo</TableHead>
            <TableHead>Betrag</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                <Link href={`/admin/kunden/${item.customerId}`} className="hover:underline">
                  {item.customerName}
                </Link>
              </TableCell>
              <TableCell>{item.subscriptionName}</TableCell>
              <TableCell>{formatPrice(item.amount)}</TableCell>
              <TableCell>
                {item.bouncedAt ? (
                  <Badge style={{ backgroundColor: "#e63946", color: "white" }}>Rückgebucht</Badge>
                ) : (
                  <Badge variant="secondary">Offen</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={togglingId === item.id}
                  onClick={() => handleToggleBounced(item)}
                >
                  {item.bouncedAt ? "Als offen markieren" : "Als rückgebucht markieren"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
