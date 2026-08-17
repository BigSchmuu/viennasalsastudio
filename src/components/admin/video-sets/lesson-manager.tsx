"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { lessonSchema, type LessonInput } from "@/lib/validations/admin";
import {
  createLesson,
  updateLesson,
  deleteLesson,
  moveLessonUp,
  moveLessonDown,
} from "@/lib/actions/admin/lessons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export type LessonRow = {
  id: string;
  title: string;
  videoUrls: string[];
  customerVideoUrl: string | null;
};

export function LessonManager({ videoSetId, lessons }: { videoSetId: string; lessons: LessonRow[] }) {
  const [editing, setEditing] = useState<LessonRow | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<LessonRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteLesson(deleteTarget.id, videoSetId);
    if ("error" in result) {
      setDeleteError(result.error);
      return;
    }
    setDeleteTarget(null);
    setDeleteError(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>Neue Lektion</Button>
      </div>

      {lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Noch keine Lektionen in diesem Videosatz.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titel</TableHead>
              <TableHead>Videos</TableHead>
              <TableHead>Kunden-Video</TableHead>
              <TableHead>Reihenfolge</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lessons.map((lesson, index) => (
              <TableRow key={lesson.id}>
                <TableCell className="font-medium">{lesson.title}</TableCell>
                <TableCell>{lesson.videoUrls.length}</TableCell>
                <TableCell>{lesson.customerVideoUrl ? "✓" : "—"}</TableCell>
                <TableCell className="space-x-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={index === 0}
                    onClick={() => moveLessonUp(lesson.id, videoSetId)}
                    aria-label="Nach oben"
                  >
                    ↑
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={index === lessons.length - 1}
                    onClick={() => moveLessonDown(lesson.id, videoSetId)}
                    aria-label="Nach unten"
                  >
                    ↓
                  </Button>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(lesson)}>
                    Bearbeiten
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDeleteTarget(lesson);
                      setDeleteError(null);
                    }}
                  >
                    Löschen
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {editing !== null && (
        <LessonFormDialog
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          lesson={editing === "new" ? null : editing}
          videoSetId={videoSetId}
        />
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lektion löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteTarget?.title}" wird unwiderruflich gelöscht, inklusive aller zugehörigen
              Video-Links.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LessonFormDialog({
  open,
  onOpenChange,
  lesson,
  videoSetId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: LessonRow | null;
  videoSetId: string;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<LessonInput>({
    resolver: zodResolver(lessonSchema),
    values: {
      title: lesson?.title ?? "",
      video_set_id: videoSetId,
      video_urls: lesson?.videoUrls && lesson.videoUrls.length > 0 ? lesson.videoUrls : [""],
      customer_video_url: lesson?.customerVideoUrl ?? "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "video_urls" as never,
  });

  async function onSubmit(values: LessonInput) {
    setLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.set("title", values.title);
      formData.set("video_set_id", values.video_set_id);
      formData.set("customer_video_url", values.customer_video_url ?? "");
      values.video_urls.filter((url) => url.trim() !== "").forEach((url) => formData.append("video_urls", url));

      const result = lesson
        ? await updateLesson(lesson.id, formData)
        : await createLesson(formData);

      if ("error" in result) {
        setFormError(result.error);
        return;
      }

      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lesson ? "Lektion bearbeiten" : "Neue Lektion"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label>Video-Links</Label>
              {fields.map((item, index) => (
                <div key={item.id} className="flex gap-2">
                  <FormField
                    control={form.control}
                    name={`video_urls.${index}`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input type="url" placeholder="https://youtube.com/…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    Entfernen
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => append("")}>
                Video hinzufügen
              </Button>
            </div>

            <FormField
              control={form.control}
              name="customer_video_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kunden-Video (PROJ-11)</FormLabel>
                  <FormControl>
                    <Input type="url" placeholder="https://youtube.com/… (optional)" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Einfaches Demo-Video für angemeldete Kunden (Counts + Musik) — separat von den
                    Lehrer-Videos oben.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "Wird gespeichert…" : "Speichern"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
