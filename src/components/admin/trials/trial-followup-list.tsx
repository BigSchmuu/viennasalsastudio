"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { setTrialContacted } from "@/lib/actions/admin/trial-followups";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

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

function FollowupRowActions({ row }: { row: TrialFollowupRow }) {
  const [contacted, setContacted] = useState(row.status !== "offen");
  const [note, setNote] = useState(row.note);
  const [saving, setSaving] = useState(false);

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
    <div className="space-y-2 min-w-[220px]">
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
      <Textarea
        placeholder="Notiz…"
        value={note}
        disabled={saving}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => save(contacted, note)}
        rows={2}
        className="text-sm"
      />
    </div>
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
                <TableHead>Kunde</TableHead>
                <TableHead>Kurs</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Nachverfolgung</TableHead>
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
                  <TableCell>
                    {row.status === "konvertiert" ? (
                      <span className="text-sm text-muted-foreground">—</span>
                    ) : (
                      <FollowupRowActions row={row} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
