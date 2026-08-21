"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createCollectionRun } from "@/lib/actions/admin/sepa-collections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { SortableHeader } from "@/components/admin/sortable-header";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export type CollectionRunStatus = "complete" | "bounced";

export const collectionRunStatusOptions: { value: CollectionRunStatus; label: string; color: string }[] = [
  { value: "complete", label: "Vollständig eingezogen", color: "#2a9d8f" },
  { value: "bounced", label: "Mit Rückbuchungen", color: "#e63946" },
];

function collectionRunStatusLabel(status: CollectionRunStatus): string {
  return collectionRunStatusOptions.find((o) => o.value === status)?.label ?? "—";
}

function collectionRunStatusColor(status: CollectionRunStatus): string {
  return collectionRunStatusOptions.find((o) => o.value === status)?.color ?? "#94a3b8";
}

export type CollectionRunRow = {
  id: string;
  dueDate: string;
  createdAt: string;
  itemCount: number;
  total: number;
  status: CollectionRunStatus;
};

const ALL_STATUS = "__all__";

function formatPrice(price: number): string {
  return price.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

export function CollectionRunList({ runs, initialStatus }: { runs: CollectionRunRow[]; initialStatus: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<number | null>(null);

  function applyStatusFilter(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (status) params.set("status", status);
    else params.delete("status");
    router.push(`/admin/lastschriften${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const filtersActive = initialStatus !== "";

  async function submit(confirmDuplicate: boolean) {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("due_date", dueDate);
      formData.set("confirm_duplicate", confirmDuplicate ? "true" : "false");

      const result = await createCollectionRun(formData);

      if ("error" in result) {
        setError(result.error);
        return;
      }
      if ("duplicate" in result) {
        setDuplicateWarning(result.existingCount);
        return;
      }
      setDuplicateWarning(null);
      router.push(`/admin/lastschriften/${result.runId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border p-4 space-y-3">
        <p className="text-sm font-medium">Neuen Lastschriftlauf erstellen</p>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="due-date">Fälligkeitsdatum</Label>
            <Input id="due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <Button type="button" disabled={loading || !dueDate} onClick={() => submit(false)}>
            {loading ? "Wird erstellt…" : "Lauf erstellen"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="run-status-filter">Status</Label>
          <Select
            value={initialStatus || ALL_STATUS}
            onValueChange={(value) => applyStatusFilter(value === ALL_STATUS ? "" : value)}
          >
            <SelectTrigger id="run-status-filter" className="w-56">
              <SelectValue placeholder="Alle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS}>Alle</SelectItem>
              {collectionRunStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {filtersActive && (
          <Button type="button" variant="outline" size="sm" onClick={() => applyStatusFilter("")}>
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {filtersActive ? "Keine Lastschriftläufe gefunden." : "Noch keine Lastschriftläufe vorhanden."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader label="Fälligkeitsdatum" sortKey="due_date" />
              <TableHead>Kunden</TableHead>
              <SortableHeader label="Gesamtbetrag" sortKey="total" />
              <TableHead>Status</TableHead>
              <SortableHeader label="Erstellt am" sortKey="created_at" />
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="font-medium">
                  {new Date(run.dueDate).toLocaleDateString("de-AT")}
                </TableCell>
                <TableCell>{run.itemCount}</TableCell>
                <TableCell>{formatPrice(run.total)}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    style={{ borderColor: collectionRunStatusColor(run.status), color: collectionRunStatusColor(run.status) }}
                  >
                    {collectionRunStatusLabel(run.status)}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(run.createdAt).toLocaleDateString("de-AT")}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/lastschriften/${run.id}`}>Ansehen</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={duplicateWarning !== null} onOpenChange={(open) => !open && setDuplicateWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bereits ein Lauf für dieses Datum vorhanden</AlertDialogTitle>
            <AlertDialogDescription>
              Für den {dueDate ? new Date(dueDate).toLocaleDateString("de-AT") : ""} existiert bereits{" "}
              {duplicateWarning === 1 ? "ein Lauf" : `${duplicateWarning} Läufe`}. Ein weiterer Lauf für dasselbe
              Datum kann zu doppeltem Einzug führen. Trotzdem fortfahren?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                setDuplicateWarning(null);
                submit(true);
              }}
            >
              Trotzdem erstellen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
