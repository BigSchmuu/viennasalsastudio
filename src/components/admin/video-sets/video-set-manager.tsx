"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { videoSetSchema, type VideoSetInput } from "@/lib/validations/admin";
import { createVideoSet, updateVideoSet, deleteVideoSet } from "@/lib/actions/admin/video-sets";
import { levelOptions, levelLabel, levelColor } from "@/lib/constants/levels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export type VideoSetRow = {
  id: string;
  name: string;
  level: string | null;
  lessonCount: number;
};

export function VideoSetManager({ videoSets }: { videoSets: VideoSetRow[] }) {
  const [editing, setEditing] = useState<VideoSetRow | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<VideoSetRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteVideoSet(deleteTarget.id);
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
        <Button onClick={() => setEditing("new")}>Neuer Videosatz</Button>
      </div>

      {videoSets.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Noch keine Videosätze vorhanden. Lege zuerst einen Videosatz an.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Lektionen</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {videoSets.map((videoSet) => (
              <TableRow key={videoSet.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/videosaetze/${videoSet.id}`} className="hover:underline">
                    {videoSet.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {videoSet.level ? (
                    <Badge style={{ backgroundColor: levelColor(videoSet.level), color: "white" }}>
                      {levelLabel(videoSet.level)}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>{videoSet.lessonCount}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/videosaetze/${videoSet.id}`}>Lektionen verwalten</Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(videoSet)}>
                    Bearbeiten
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDeleteTarget(videoSet);
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

      <VideoSetFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        videoSet={editing === "new" ? null : editing}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Videosatz löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteTarget?.name}" wird unwiderruflich gelöscht, inklusive aller Lektionen und
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

function VideoSetFormDialog({
  open,
  onOpenChange,
  videoSet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoSet: VideoSetRow | null;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<VideoSetInput>({
    resolver: zodResolver(videoSetSchema),
    values: {
      name: videoSet?.name ?? "",
      level: (videoSet?.level as VideoSetInput["level"]) ?? "",
    },
  });

  async function onSubmit(values: VideoSetInput) {
    setLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.set("name", values.name);
      formData.set("level", values.level ?? "");

      const result = videoSet
        ? await updateVideoSet(videoSet.id, formData)
        : await createVideoSet(formData);

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{videoSet ? "Videosatz bearbeiten" : "Neuer Videosatz"}</DialogTitle>
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Level (optional)</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Kein Level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {levelOptions.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
