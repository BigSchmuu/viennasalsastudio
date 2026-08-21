"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { previewRecipientCount, sendNewsletter } from "@/lib/actions/admin/newsletter";
import { newsletterGroupValues, newsletterGroupLabel, type NewsletterGroup } from "@/lib/newsletter/recipients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export type CourseOption = { id: string; name: string };

export function NewsletterComposer({ courses }: { courses: CourseOption[] }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [group, setGroup] = useState<NewsletterGroup>("alle");
  const [courseId, setCourseId] = useState("");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (group === "kurs_teilnehmer" && !courseId) {
      setRecipientCount(null);
      return;
    }
    let cancelled = false;
    setCountLoading(true);
    previewRecipientCount(group, courseId || undefined).then((result) => {
      if (cancelled) return;
      setCountLoading(false);
      if ("error" in result) {
        setRecipientCount(null);
        return;
      }
      setRecipientCount(result.count);
    });
    return () => {
      cancelled = true;
    };
  }, [group, courseId]);

  const formValid = subject.trim().length > 0 && body.trim().length > 0 && (group !== "kurs_teilnehmer" || !!courseId);
  const canSend = formValid && recipientCount !== null && recipientCount > 0 && !countLoading;

  async function handleConfirmSend() {
    setConfirmOpen(false);
    setSending(true);
    setError(null);
    try {
      const result = await sendNewsletter(subject, body, group, courseId || undefined);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      toast.success(`Newsletter an ${result.recipientCount} Empfänger verschickt.`);
      setSubject("");
      setBody("");
      setGroup("alle");
      setCourseId("");
      setRecipientCount(null);
      startTransition(() => router.refresh());
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-md border p-4 space-y-4">
      <p className="text-sm font-medium">Neuen Newsletter verschicken</p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-1">
        <Label htmlFor="newsletter-subject">Betreff</Label>
        <Input id="newsletter-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="newsletter-body">Text</Label>
        <Textarea id="newsletter-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="newsletter-group">Empfängergruppe</Label>
          <Select
            value={group}
            onValueChange={(value) => {
              setGroup(value as NewsletterGroup);
              if (value !== "kurs_teilnehmer") setCourseId("");
            }}
          >
            <SelectTrigger id="newsletter-group" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {newsletterGroupValues.map((value) => (
                <SelectItem key={value} value={value}>
                  {newsletterGroupLabel[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {group === "kurs_teilnehmer" && (
          <div className="space-y-1">
            <Label htmlFor="newsletter-course">Kurs</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger id="newsletter-course" className="w-64">
                <SelectValue placeholder="Kurs wählen…" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {countLoading
          ? "Empfängerzahl wird ermittelt…"
          : recipientCount === null
            ? group === "kurs_teilnehmer"
              ? "Bitte einen Kurs auswählen."
              : ""
            : recipientCount === 0
              ? "Diese Gruppe hat aktuell keine Empfänger."
              : `${recipientCount} Empfänger in dieser Gruppe.`}
      </p>

      <Button type="button" disabled={!canSend || sending} onClick={() => setConfirmOpen(true)}>
        {sending ? "Wird gesendet…" : "Senden"}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Newsletter jetzt verschicken?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Newsletter „{subject}&rdquo; wird an {recipientCount} Empfänger ({newsletterGroupLabel[group]}) verschickt.
              Dieser Versand kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSend}>Jetzt senden</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
