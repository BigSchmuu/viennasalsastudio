"use client";

import { useState } from "react";
import { toast } from "sonner";
import { saveSessionNote } from "@/lib/actions/teacher/notes";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function SessionNoteEditor({
  courseId,
  occurrenceDate,
  initialNote,
  onSaved,
}: {
  courseId: string;
  occurrenceDate: string;
  initialNote: string;
  onSaved?: (note: string) => void;
}) {
  const [note, setNote] = useState(initialNote);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("course_id", courseId);
      formData.set("occurrence_date", occurrenceDate);
      formData.set("note", note);
      const result = await saveSessionNote(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast.success("Notiz gespeichert.");
      onSaved?.(note);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Textarea
        placeholder="Notiz zu diesem Termin — sichtbar für alle diesem Kurs zugewiesenen Lehrer sowie Admin…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={4}
      />
      <Button size="sm" disabled={loading} onClick={handleSave}>
        {loading ? "Wird gespeichert…" : "Notiz speichern"}
      </Button>
    </div>
  );
}
