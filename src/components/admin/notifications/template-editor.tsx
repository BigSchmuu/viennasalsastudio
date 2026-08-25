"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { buildPreviewContent } from "@/lib/notifications/templates";
import { findInvalidPlaceholders, type TemplateFields } from "@/lib/notifications/template-registry";
import { saveTemplate, resetTemplate, sendTestNotification } from "@/lib/actions/admin/notification-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

type Props = {
  templateKey: string;
  placeholders: string[];
  samples: Record<string, string>;
  initialFields: TemplateFields;
  isOverridden: boolean;
  /** PROJ-43: Welche Sprachfassung bearbeitet wird. */
  language: string;
};

export function TemplateEditor({
  templateKey,
  placeholders,
  samples,
  initialFields,
  isOverridden,
  language,
}: Props) {
  const router = useRouter();
  const [fields, setFields] = useState<TemplateFields>(initialFields);

  // useState(initialFields) only seeds state on mount — after save/reset call
  // router.refresh(), the server passes new initialFields but this component
  // instance doesn't remount, so it must be explicitly resynced here.
  useEffect(() => {
    setFields(initialFields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFields.emailSubject, initialFields.emailBody, initialFields.pushTitle, initialFields.pushBody]);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const invalidPlaceholders = useMemo(() => {
    const invalid = new Set<string>();
    for (const text of [fields.emailSubject, fields.emailBody, fields.pushTitle, fields.pushBody]) {
      for (const name of findInvalidPlaceholders(text, placeholders)) invalid.add(name);
    }
    return [...invalid];
  }, [fields, placeholders]);

  const isEmpty =
    !fields.emailSubject.trim() || !fields.emailBody.trim() || !fields.pushTitle.trim() || !fields.pushBody.trim();
  const hasError = isEmpty || invalidPlaceholders.length > 0;

  const preview = useMemo(() => {
    if (hasError) return null;
    try {
      return buildPreviewContent(templateKey as Parameters<typeof buildPreviewContent>[0], fields);
    } catch {
      return null;
    }
  }, [templateKey, fields, hasError]);

  function updateField(field: keyof TemplateFields, value: string) {
    setFields((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await saveTemplate(templateKey, fields, language);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Vorlage gespeichert.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    setSendingTest(true);
    try {
      const result = await sendTestNotification(templateKey, fields);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Test-Mail wurde verschickt.");
    } finally {
      setSendingTest(false);
    }
  }

  async function handleReset() {
    setResetDialogOpen(false);
    setResetting(true);
    try {
      const result = await resetTemplate(templateKey, language);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Auf Standard zurückgesetzt.");
      router.refresh();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-md border p-4 space-y-4">
        <div className="rounded-md bg-muted/40 p-3 text-sm">
          <p className="font-medium mb-1">Verfügbare Platzhalter</p>
          <p className="text-muted-foreground">
            {placeholders.map((p) => (
              <span key={p} className="mr-3">
                <code className="rounded bg-background px-1 py-0.5">{`{${p}}`}</code>
                {samples[p] && <span className="ml-1">→ {samples[p]}</span>}
              </span>
            ))}
          </p>
        </div>

        {invalidPlaceholders.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              Unbekannte Platzhalter: {invalidPlaceholders.map((p) => `{${p}}`).join(", ")}. Erlaubt sind:{" "}
              {placeholders.map((p) => `{${p}}`).join(", ")}.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-1">
          <Label htmlFor="tpl-email-subject">E-Mail-Betreff</Label>
          <Input
            id="tpl-email-subject"
            value={fields.emailSubject}
            onChange={(e) => updateField("emailSubject", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="tpl-email-body">E-Mail-Text</Label>
          <Textarea
            id="tpl-email-body"
            rows={4}
            value={fields.emailBody}
            onChange={(e) => updateField("emailBody", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="tpl-push-title">Push-Titel</Label>
          <Input
            id="tpl-push-title"
            value={fields.pushTitle}
            onChange={(e) => updateField("pushTitle", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="tpl-push-body">Push-Text</Label>
          <Input
            id="tpl-push-body"
            value={fields.pushBody}
            onChange={(e) => updateField("pushBody", e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="button" disabled={hasError || saving} onClick={handleSave}>
            {saving ? "Wird gespeichert…" : "Speichern"}
          </Button>
          <Button type="button" variant="outline" disabled={hasError || sendingTest} onClick={handleSendTest}>
            {sendingTest ? "Wird gesendet…" : "Test-Mail an mich senden"}
          </Button>
          {isOverridden && (
            <Button
              type="button"
              variant="ghost"
              disabled={resetting}
              onClick={() => setResetDialogOpen(true)}
            >
              Auf Standard zurücksetzen
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border p-4">
        <p className="text-sm font-medium mb-3">Vorschau (mit Beispieldaten)</p>
        {preview ? (
          <div className="rounded-md border bg-white overflow-x-auto">
            <div dangerouslySetInnerHTML={{ __html: preview.emailHtml }} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Vorschau nicht verfügbar — bitte zuerst die Fehler oben beheben.
          </p>
        )}
        {preview && (
          <div className="mt-4 space-y-1 text-sm">
            <p className="font-medium">Push-Benachrichtigung</p>
            <p className="text-muted-foreground">
              {preview.pushTitle} — {preview.pushBody}
            </p>
          </div>
        )}
      </div>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auf Standard zurücksetzen?</AlertDialogTitle>
            <AlertDialogDescription>
              Deine Anpassung wird gelöscht und der ursprüngliche Standardtext wieder aktiv. Das kann nicht rückgängig
              gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>Zurücksetzen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
