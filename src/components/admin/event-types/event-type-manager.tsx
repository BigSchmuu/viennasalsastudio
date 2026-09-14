"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { eventTypeSchema, type EventTypeInput } from "@/lib/validations/events";
import { createEventType, updateEventType, deleteEventType } from "@/lib/actions/admin/event-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export type EventTypeRow = { id: string; name: string; eventCount: number };

/**
 * Eventarten verwalten (PROJ-53) — aufgebaut wie die Tanzstile.
 *
 * Eine Art, der noch Events zugeordnet sind, bietet gar nicht erst „Löschen"
 * an, sondern sagt, wie viele Events sie nutzen. Die Datenbank sperrt das
 * Löschen zusätzlich, falls zwischen Anzeige und Klick ein Event dazukommt.
 */
export function EventTypeManager({ eventTypes }: { eventTypes: EventTypeRow[] }) {
  const [editing, setEditing] = useState<EventTypeRow | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<EventTypeRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteEventType(deleteTarget.id);
    if ("error" in result) {
      setDeleteError(result.error);
      return;
    }
    setDeleteTarget(null);
    setDeleteError(null);
  }

  const inBenutzung = (deleteTarget?.eventCount ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>Neue Eventart</Button>
      </div>

      {eventTypes.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Noch keine Eventarten vorhanden. Lege zuerst eine an, z. B. „Party&quot; oder „Workshop&quot;.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Events</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventTypes.map((art) => (
              <TableRow key={art.id}>
                <TableCell className="font-medium">{art.name}</TableCell>
                <TableCell>{art.eventCount}</TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button variant="outline" size="sm" onClick={() => setEditing(art)}>
                    Umbenennen
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDeleteTarget(art);
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

      <EventTypeFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        eventType={editing === "new" ? null : editing}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {inBenutzung ? "Eventart wird noch verwendet" : "Eventart löschen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {inBenutzung
                ? `„${deleteTarget?.name}" ist noch ${deleteTarget?.eventCount === 1 ? "einem Event" : `${deleteTarget?.eventCount} Events`} zugeordnet. Ordne ${deleteTarget?.eventCount === 1 ? "ihm" : "ihnen"} zuerst eine andere Art zu.`
                : `„${deleteTarget?.name}" wird unwiderruflich gelöscht.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <Alert variant="destructive">
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{inBenutzung ? "Schließen" : "Abbrechen"}</AlertDialogCancel>
            {inBenutzung ? null : (
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
              >
                Löschen
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EventTypeFormDialog({
  open,
  onOpenChange,
  eventType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventType: EventTypeRow | null;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<EventTypeInput>({
    resolver: zodResolver(eventTypeSchema),
    values: { name: eventType?.name ?? "" },
  });

  async function onSubmit(values: EventTypeInput) {
    setLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.set("name", values.name);

      const result = eventType
        ? await updateEventType(eventType.id, formData)
        : await createEventType(formData);

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
          <DialogTitle>{eventType ? "Eventart umbenennen" : "Neue Eventart"}</DialogTitle>
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
                    <Input {...field} placeholder="z. B. Party" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {eventType ? (
              <p className="text-sm text-muted-foreground">
                Der neue Name erscheint sofort bei allen zugeordneten Events und im Filter.
              </p>
            ) : null}

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
