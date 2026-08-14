"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createCollectionRun } from "@/lib/actions/admin/sepa-collections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
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

export type CollectionRunRow = {
  id: string;
  dueDate: string;
  createdAt: string;
  itemCount: number;
  total: number;
};

function formatPrice(price: number): string {
  return price.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

export function CollectionRunList({ runs }: { runs: CollectionRunRow[] }) {
  const router = useRouter();
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<number | null>(null);

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

      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Noch keine Lastschriftläufe vorhanden.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fälligkeitsdatum</TableHead>
              <TableHead>Kunden</TableHead>
              <TableHead>Gesamtbetrag</TableHead>
              <TableHead>Erstellt am</TableHead>
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
