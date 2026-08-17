"use client";

import { useState } from "react";
import { removeWaitlistEntry } from "@/lib/actions/admin/waitlist";
import { desiredPlanLabel } from "@/lib/constants/booking";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type WaitlistEntryRow = {
  id: string;
  customerName: string;
  desiredPlan: string;
  chosenDate: string;
  createdAt: string;
};

export function CourseWaitlistDialog({
  open,
  onOpenChange,
  courseName,
  entries: initialEntries,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseName: string;
  entries: WaitlistEntryRow[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleRemove(id: string) {
    setLoadingId(id);
    setError(null);
    try {
      const result = await removeWaitlistEntry(id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setEntries(initialEntries);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Warteliste — {courseName}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Warteliste ist leer.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pos.</TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Abo-Art</TableHead>
                <TableHead>Termin</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, index) => (
                <TableRow key={entry.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{entry.customerName}</TableCell>
                  <TableCell>{desiredPlanLabel(entry.desiredPlan)}</TableCell>
                  <TableCell>{new Date(entry.chosenDate).toLocaleDateString("de-AT")}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={loadingId === entry.id}
                      onClick={() => handleRemove(entry.id)}
                    >
                      Entfernen
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
