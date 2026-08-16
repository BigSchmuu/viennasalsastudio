"use client";

import { useState } from "react";
import { addCourseEntryDate, deleteCourseEntryDate } from "@/lib/actions/admin/course-entry-dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type EntryDateData = { id: string; entryDate: string };

export function CourseEntryDatesSection({
  courseId,
  entryDates: initialEntryDates,
}: {
  courseId: string;
  entryDates: EntryDateData[];
}) {
  const [entryDates, setEntryDates] = useState(initialEntryDates);
  const [newDate, setNewDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    if (!newDate) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("entry_date", newDate);
      const result = await addCourseEntryDate(courseId, formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setEntryDates((prev) =>
        [...prev, result.entryDate].sort((a, b) => a.entryDate.localeCompare(b.entryDate))
      );
      setNewDate("");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await deleteCourseEntryDate(id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setEntryDates((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-4">
      <p className="text-sm font-medium">Einstiegstermine</p>
      <p className="text-xs text-muted-foreground">
        Termine, zu denen sich Kunden regulär für diesen Kurs anmelden können (z. B. Saisonbeginn).
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {entryDates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Keine Einstiegstermine hinterlegt.</p>
      ) : (
        <ul className="space-y-1">
          {entryDates.map((entryDate) => (
            <li key={entryDate.id} className="flex items-center justify-between text-sm">
              <span>{new Date(entryDate.entryDate).toLocaleDateString("de-AT")}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => handleDelete(entryDate.id)}
              >
                Entfernen
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 items-end">
        <div className="space-y-1">
          <Label htmlFor="new-entry-date">Neuer Einstiegstermin</Label>
          <Input
            id="new-entry-date"
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
          />
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading || !newDate} onClick={handleAdd}>
          Hinzufügen
        </Button>
      </div>
    </div>
  );
}
