"use client";

import { useState } from "react";
import { markAttendance } from "@/lib/actions/teacher/attendance";
import { attendanceStatusLabel, attendanceSourceLabel } from "@/lib/constants/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type RosterEntry = {
  customerId: string;
  fullName: string;
  source: string;
  status: string | null;
};

export type EligibleCustomer = {
  id: string;
  name: string;
};

export function AttendanceRoster({
  courseId,
  occurrenceDate,
  entries: initialEntries,
  eligibleCustomers,
  isFuture,
}: {
  courseId: string;
  occurrenceDate: string;
  entries: RosterEntry[];
  eligibleCustomers: EligibleCustomer[];
  isFuture: boolean;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  async function handleMark(customerId: string, status: "present" | "absent") {
    setSavingId(customerId);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("course_id", courseId);
      formData.set("customer_id", customerId);
      formData.set("occurrence_date", occurrenceDate);
      formData.set("status", status);
      const result = await markAttendance(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setEntries((prev) => prev.map((e) => (e.customerId === customerId ? { ...e, status } : e)));
    } finally {
      setSavingId(null);
    }
  }

  async function handleAdd(customer: EligibleCustomer) {
    setAddOpen(false);
    setEntries((prev) => [...prev, { customerId: customer.id, fullName: customer.name, source: "manuell", status: null }]);
    await handleMark(customer.id, "present");
  }

  const listedIds = new Set(entries.map((e) => e.customerId));
  const addableCustomers = eligibleCustomers.filter((c) => !listedIds.has(c.id));

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isFuture && (
        <Alert>
          <AlertDescription>
            Dieser Termin liegt in der Zukunft — Anwesenheit kann erst nach dem Termin markiert werden.
          </AlertDescription>
        </Alert>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Für diesen Termin sind aktuell keine Teilnehmer erfasst.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.customerId} className="flex items-center justify-between gap-2 rounded-md border p-3">
              <div className="space-y-1">
                <p className="font-medium">{entry.fullName}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{attendanceSourceLabel[entry.source] ?? entry.source}</Badge>
                  <span className="text-sm text-muted-foreground">{attendanceStatusLabel(entry.status)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={entry.status === "present" ? "default" : "outline"}
                  disabled={isFuture || savingId === entry.customerId}
                  onClick={() => handleMark(entry.customerId, "present")}
                >
                  Anwesend
                </Button>
                <Button
                  size="sm"
                  variant={entry.status === "absent" ? "default" : "outline"}
                  disabled={isFuture || savingId === entry.customerId}
                  onClick={() => handleMark(entry.customerId, "absent")}
                >
                  Abwesend
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button variant="outline" onClick={() => setAddOpen(true)} disabled={isFuture}>
        Kunde hinzufügen
      </Button>

      <AddCustomerDialog open={addOpen} onOpenChange={setAddOpen} customers={addableCustomers} onAdd={handleAdd} />
    </div>
  );
}

function AddCustomerDialog({
  open,
  onOpenChange,
  customers,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: EligibleCustomer[];
  onAdd: (customer: EligibleCustomer) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = customers.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setSearch("");
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kunde hinzufügen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input placeholder="Suche nach Name…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-80 overflow-y-auto space-y-1">
            {customers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Keine weiteren Kunden mit aktivem Abo oder aktiver Buchung verfügbar.
              </p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Keine Kunden gefunden.</p>
            ) : (
              filtered.map((customer) => (
                <div key={customer.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <p className="font-medium">{customer.name}</p>
                  <Button size="sm" onClick={() => onAdd(customer)}>
                    Hinzufügen
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
