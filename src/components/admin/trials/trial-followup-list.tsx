"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { setTrialContacted } from "@/lib/actions/admin/trial-followups";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { SortableHeader } from "@/components/admin/sortable-header";

export type TrialFollowupStatus = "offen" | "kontaktiert" | "konvertiert";

export const trialFollowupStatusOptions: { value: TrialFollowupStatus; label: string; color: string }[] = [
  { value: "offen", label: "Offen", color: "#e9c46a" },
  { value: "konvertiert", label: "Konvertiert", color: "#2a9d8f" },
  { value: "kontaktiert", label: "Kontaktiert", color: "#457b9d" },
];

function statusLabel(status: TrialFollowupStatus): string {
  return trialFollowupStatusOptions.find((o) => o.value === status)?.label ?? status;
}

function statusColor(status: TrialFollowupStatus): string {
  return trialFollowupStatusOptions.find((o) => o.value === status)?.color ?? "#94a3b8";
}

export type TrialFollowupRow = {
  bookingId: string;
  customerId: string;
  customerName: string;
  courseName: string;
  chosenDate: string;
  status: TrialFollowupStatus;
  overdue: boolean;
  note: string;
};

function formatDate(dateString: string): string {
  return new Date(dateString + "T00:00:00").toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const ALL_STATUS = "__all__";

/**
 * Haken und Notiz als **zwei** Zellen (2026-10-05, Wunsch des Betreibers).
 *
 * Eine Komponente, die zwei Zellen zurückgibt: Beide Felder gehen in einem Zug
 * zur Datenbank (`setTrialContacted` schreibt Haken *und* Notiz), und zwei
 * getrennte Komponenten müssten den Wert der anderen kennen. Zwei Zustände über
 * dieselbe Zeile wären der sichere Weg zu „Notiz gespeichert, Haken wieder weg".
 *
 * Die Notiz steht zusammengeklappt hinter einem schmalen Knopf. Ein leeres
 * Textfeld in jeder Zeile machte die Liste doppelt so hoch wie nötig — und bei
 * den meisten Probestunden steht nie eine Notiz.
 */
function FollowupRowCells({ row }: { row: TrialFollowupRow }) {
  const [contacted, setContacted] = useState(row.status !== "offen");
  const [note, setNote] = useState(row.note);
  const [saving, setSaving] = useState(false);
  // Offen, wenn schon etwas drinsteht — eine vorhandene Notiz muss man sehen,
  // ohne zu klicken.
  const [offen, setOffen] = useState(row.note.trim().length > 0);

  async function save(nextContacted: boolean, nextNote: string) {
    setSaving(true);
    const result = await setTrialContacted(row.bookingId, nextContacted, nextNote);
    setSaving(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Gespeichert.");
  }

  return (
    <>
      <TableCell>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`contacted-${row.bookingId}`}
            checked={contacted}
            disabled={saving}
            onCheckedChange={(checked) => {
              const next = checked === true;
              setContacted(next);
              save(next, note);
            }}
          />
          <Label htmlFor={`contacted-${row.bookingId}`} className="text-sm font-normal">
            Kontaktiert
          </Label>
        </div>
      </TableCell>
      <TableCell>
        {offen ? (
          <Textarea
            placeholder="Notiz…"
            value={note}
            disabled={saving}
            autoFocus={row.note.trim().length === 0}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              save(contacted, note);
              // Leer geräumt? Dann wieder zuklappen, sonst bliebe genau das
              // Feld stehen, das wir loswerden wollten.
              if (note.trim().length === 0) setOffen(false);
            }}
            rows={2}
            className="min-w-[220px] text-sm"
          />
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => setOffen(true)}
            aria-label={`Notiz für ${row.customerName} hinzufügen`}
          >
            <Plus className="mr-1 h-3 w-3" />
            Notiz
          </Button>
        )}
      </TableCell>
    </>
  );
}

export function TrialFollowupList({ rows, initialStatus }: { rows: TrialFollowupRow[]; initialStatus: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function applyStatusFilter(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (status) params.set("status", status);
    else params.delete("status");
    router.push(`/admin/probestunden${params.toString() ? `?${params.toString()}` : ""}`);
  }

  const filtersActive = initialStatus !== "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="trial-status-filter">Status</Label>
          <Select
            value={initialStatus || ALL_STATUS}
            onValueChange={(value) => applyStatusFilter(value === ALL_STATUS ? "" : value)}
          >
            <SelectTrigger id="trial-status-filter" className="w-48">
              <SelectValue placeholder="Alle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUS}>Alle</SelectItem>
              {trialFollowupStatusOptions.map((option) => (
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

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {filtersActive ? "Keine Probestunden gefunden." : "Noch keine Probestunden vorhanden."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {/* PROJ-33, Nachtrag 2026-10-05: Kurs zuerst gewünscht, Kunde
                    und Datum am selben Tag nachgezogen — eine Liste, in der nur
                    eine von drei Überschriften klickbar ist, sieht nach einem
                    Fehler aus. */}
                <SortableHeader label="Kunde" sortKey="customer_name" />
                <SortableHeader label="Kurs" sortKey="course_name" />
                <SortableHeader label="Datum" sortKey="chosen_date" />
                <TableHead>Status</TableHead>
                <TableHead>Nachverfolgung</TableHead>
                <TableHead>Notiz</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.bookingId} className={row.overdue ? "bg-destructive/5" : undefined}>
                  <TableCell className="font-medium">
                    <Link href={`/admin/kunden/${row.customerId}`} className="hover:underline">
                      {row.customerName}
                    </Link>
                  </TableCell>
                  <TableCell>{row.courseName}</TableCell>
                  <TableCell>{formatDate(row.chosenDate)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant="outline"
                        style={{ borderColor: statusColor(row.status), color: statusColor(row.status) }}
                      >
                        {statusLabel(row.status)}
                      </Badge>
                      {row.overdue && (
                        <Badge style={{ backgroundColor: "#e63946", color: "white" }}>Follow-up überfällig</Badge>
                      )}
                    </div>
                  </TableCell>
                  {row.status === "konvertiert" ? (
                    <>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">—</span>
                      </TableCell>
                      {/* Eine Notiz, die vor der Umwandlung geschrieben wurde,
                          bleibt lesbar — vorher verschwand sie mit der
                          Nachverfolgung. */}
                      <TableCell className="max-w-[260px] text-sm text-muted-foreground">
                        {row.note.trim().length > 0 ? row.note : "—"}
                      </TableCell>
                    </>
                  ) : (
                    <FollowupRowCells row={row} />
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
