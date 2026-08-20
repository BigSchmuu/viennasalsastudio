"use client";

import { useState } from "react";
import { Check, X, FileText } from "lucide-react";
import { markAttendance } from "@/lib/actions/teacher/attendance";
import { loadMoreOccurrences } from "@/lib/actions/teacher/load-more-occurrences";
import { attendanceSourceLabel } from "@/lib/constants/attendance";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { SessionNoteEditor } from "@/components/teacher/session-note-editor";

export type MatrixCell = {
  status: "present" | "absent" | null;
  source: string;
  selfCheckedIn: boolean;
} | null;

export type MatrixColumn = {
  date: string;
  isToday: boolean;
  initialNote: string;
};

export type MatrixRow = {
  customerId: string;
  fullName: string;
  cells: Record<string, MatrixCell>;
};

export type EligibleCustomer = {
  id: string;
  name: string;
};

function formatColumnDate(date: string): string {
  return new Date(date).toLocaleDateString("de-AT", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function formatDialogDate(date: string): string {
  return new Date(date).toLocaleDateString("de-AT", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function AttendanceMatrix({
  courseId,
  columns: initialColumns,
  rows: initialRows,
  eligibleCustomers,
}: {
  courseId: string;
  columns: MatrixColumn[];
  rows: MatrixRow[];
  eligibleCustomers: EligibleCustomer[];
}) {
  const [columns, setColumns] = useState(initialColumns);
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [noteDate, setNoteDate] = useState<string | null>(null);
  const [noteFilled, setNoteFilled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(initialColumns.map((c) => [c.date, c.initialNote.trim().length > 0]))
  );
  const [unsavedIds, setUnsavedIds] = useState<Set<string>>(new Set());
  const [loadingMore, setLoadingMore] = useState(false);

  async function handleMark(customerId: string, date: string, status: "present" | "absent") {
    const key = `${customerId}:${date}`;
    setSavingKey(key);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("course_id", courseId);
      formData.set("customer_id", customerId);
      formData.set("occurrence_date", date);
      formData.set("status", status);
      const result = await markAttendance(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.customerId === customerId
            ? { ...r, cells: { ...r.cells, [date]: { status, source: r.cells[date]?.source ?? "manuell", selfCheckedIn: false } } }
            : r
        )
      );
      setUnsavedIds((prev) => {
        if (!prev.has(customerId)) return prev;
        const next = new Set(prev);
        next.delete(customerId);
        return next;
      });
    } finally {
      setSavingKey(null);
    }
  }

  function handleAddCustomer(customer: EligibleCustomer) {
    setAddOpen(false);
    setRows((prev) => [...prev, { customerId: customer.id, fullName: customer.name, cells: {} }]);
    setUnsavedIds((prev) => new Set(prev).add(customer.id));
  }

  async function handleLoadMore() {
    if (columns.length === 0) return;
    const oldestDate = columns[0].date;
    setLoadingMore(true);
    setError(null);
    try {
      const result = await loadMoreOccurrences(courseId, oldestDate);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      // result.dates comes back most-recent-first (like pastOccurrences());
      // reverse to chronological order before prepending, matching the
      // ascending oldest-first layout the rest of the matrix already uses.
      const newColumns: MatrixColumn[] = [...result.dates].reverse().map((d) => ({
        date: d.date,
        isToday: false,
        initialNote: d.note,
      }));
      setColumns((prev) => [...newColumns, ...prev]);
      setNoteFilled((prev) => ({
        ...Object.fromEntries(newColumns.map((c) => [c.date, c.initialNote.trim().length > 0])),
        ...prev,
      }));
      setRows((prev) => {
        const byId = new Map(prev.map((r) => [r.customerId, r]));
        for (const { date, roster } of result.dates) {
          for (const r of roster) {
            const existing = byId.get(r.customer_id) ?? {
              customerId: r.customer_id,
              fullName: r.full_name || "Unbenannter Kunde",
              cells: {},
            };
            byId.set(r.customer_id, {
              ...existing,
              cells: { ...existing.cells, [date]: { status: r.status, source: r.source, selfCheckedIn: r.self_checked_in } },
            });
          }
        }
        return Array.from(byId.values());
      });
    } finally {
      setLoadingMore(false);
    }
  }

  const listedIds = new Set(rows.map((r) => r.customerId));
  const addableCustomers = eligibleCustomers.filter((c) => !listedIds.has(c.id));
  const sortedRows = [...rows].sort((a, b) => a.fullName.localeCompare(b.fullName, "de"));
  const activeColumn = columns.find((c) => c.date === noteDate) ?? null;

  if (columns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Für diesen Kurs liegt noch kein stattgefundener Termin vor.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
        {loadingMore ? "Lädt…" : "Mehr laden (4 weitere)"}
      </Button>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-20 bg-background min-w-[160px]">Kursteilnehmer</TableHead>
              {columns.map((col) => (
                <TableHead
                  key={col.date}
                  className={cn("text-center min-w-[84px]", col.isToday && "bg-primary/5")}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold whitespace-nowrap">{formatColumnDate(col.date)}</span>
                    {col.isToday && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">
                        Heute
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setNoteDate(col.date)}
                      aria-label="Notiz zu diesem Termin"
                    >
                      <FileText
                        className={cn("h-3.5 w-3.5", noteFilled[col.date] ? "fill-current text-primary" : "text-muted-foreground")}
                      />
                    </Button>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center text-muted-foreground py-8">
                  Für diesen Kurs sind aktuell keine Kursteilnehmer erfasst.
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row) => (
                <TableRow key={row.customerId}>
                  <TableCell className="sticky left-0 z-10 bg-background font-medium whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {row.fullName}
                      {unsavedIds.has(row.customerId) && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-700 border-amber-300">
                          Nicht gespeichert
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {columns.map((col) => {
                    const cell = row.cells[col.date] ?? null;
                    const key = `${row.customerId}:${col.date}`;
                    return (
                      <TableCell key={col.date} className={cn("text-center", col.isToday && "bg-primary/5")}>
                        <AttendanceCell
                          cell={cell}
                          saving={savingKey === key}
                          onMark={(status) => handleMark(row.customerId, col.date, status)}
                          customerName={row.fullName}
                          dateLabel={formatColumnDate(col.date)}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Button variant="outline" onClick={() => setAddOpen(true)}>
        Kunde hinzufügen
      </Button>

      <AddCustomerDialog open={addOpen} onOpenChange={setAddOpen} customers={addableCustomers} onAdd={handleAddCustomer} />

      <Dialog open={noteDate !== null} onOpenChange={(open) => !open && setNoteDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notiz — {noteDate && formatDialogDate(noteDate)}</DialogTitle>
          </DialogHeader>
          {activeColumn && (
            <SessionNoteEditor
              courseId={courseId}
              occurrenceDate={activeColumn.date}
              initialNote={activeColumn.initialNote}
              onSaved={(note) => setNoteFilled((prev) => ({ ...prev, [activeColumn.date]: note.trim().length > 0 }))}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttendanceCell({
  cell,
  saving,
  onMark,
  customerName,
  dateLabel,
}: {
  cell: MatrixCell;
  saving: boolean;
  onMark: (status: "present" | "absent") => void;
  customerName: string;
  dateLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const status = cell?.status ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={saving}
          aria-label={`Anwesenheit für ${customerName} am ${dateLabel} markieren`}
          className={cn(
            "relative mx-auto flex h-8 w-8 items-center justify-center rounded-md border transition-colors hover:bg-muted disabled:opacity-50",
            status === "present" && "border-emerald-600 bg-emerald-50 text-emerald-700",
            status === "absent" && "border-red-600 bg-red-50 text-red-700"
          )}
        >
          {status === "present" && <Check className="h-4 w-4" />}
          {status === "absent" && <X className="h-4 w-4" />}
          {status === null && <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
          {cell?.selfCheckedIn && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500" title="Self-Check-In" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="center">
        <div className="space-y-2">
          {cell?.source && (
            <p className="text-xs text-muted-foreground">
              Quelle: {attendanceSourceLabel[cell.source] ?? cell.source}
              {cell.selfCheckedIn && " · Self-Check-In"}
            </p>
          )}
          <div className="flex gap-1">
            <Button
              size="sm"
              className="flex-1"
              variant={status === "present" ? "default" : "outline"}
              onClick={() => {
                onMark("present");
                setOpen(false);
              }}
            >
              Anwesend
            </Button>
            <Button
              size="sm"
              className="flex-1"
              variant={status === "absent" ? "default" : "outline"}
              onClick={() => {
                onMark("absent");
                setOpen(false);
              }}
            >
              Abwesend
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
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
