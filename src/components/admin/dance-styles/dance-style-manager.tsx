"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { danceStyleSchema, type DanceStyleInput } from "@/lib/validations/admin";
import {
  createDanceStyle,
  updateDanceStyle,
  deleteDanceStyle,
} from "@/lib/actions/admin/dance-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export type DanceStyleRow = {
  id: string;
  name: string;
  courseCount: number;
  /**
   * PROJ-93: Der Passpreis dieser Stilrichtung. `null` heißt „es gibt keinen
   * Pass dafür" — dann fehlt die Kachel im Buchungsdialog ganz. Der Preis ist
   * also nicht nur ein Betrag, sondern der Schalter für das Angebot.
   */
  passPrice: number | null;
  passStudentPrice: number | null;
};

const EUR = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });

export function DanceStyleManager({ danceStyles }: { danceStyles: DanceStyleRow[] }) {
  const [editing, setEditing] = useState<DanceStyleRow | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<DanceStyleRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteDanceStyle(deleteTarget.id);
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
        <Button onClick={() => setEditing("new")}>Neuer Tanzstil</Button>
      </div>

      {danceStyles.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Noch keine Tanzstile vorhanden. Lege zuerst einen Tanzstil an.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kurse</TableHead>
              <TableHead>Pass</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {danceStyles.map((style) => (
              <TableRow key={style.id}>
                <TableCell className="font-medium">{style.name}</TableCell>
                <TableCell>{style.courseCount}</TableCell>
                <TableCell className="tabular-nums">
                  {style.passPrice === null ? (
                    <span className="text-muted-foreground">kein Pass</span>
                  ) : (
                    <>
                      {EUR.format(style.passPrice)}
                      {style.passStudentPrice !== null && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {EUR.format(style.passStudentPrice)} erm.
                        </span>
                      )}
                    </>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(style)}>
                    Bearbeiten
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDeleteTarget(style);
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

      <DanceStyleFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        danceStyle={editing === "new" ? null : editing}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tanzstil löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteTarget?.name}&quot; wird unwiderruflich gelöscht.
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

function DanceStyleFormDialog({
  open,
  onOpenChange,
  danceStyle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  danceStyle: DanceStyleRow | null;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<DanceStyleInput>({
    resolver: zodResolver(danceStyleSchema),
    values: {
      name: danceStyle?.name ?? "",
      pass_price: danceStyle?.passPrice?.toString() ?? "",
      pass_student_price: danceStyle?.passStudentPrice?.toString() ?? "",
    },
  });

  async function onSubmit(values: DanceStyleInput) {
    setLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.set("name", values.name);
      formData.set("pass_price", values.pass_price ?? "");
      formData.set("pass_student_price", values.pass_student_price ?? "");

      const result = danceStyle
        ? await updateDanceStyle(danceStyle.id, formData)
        : await createDanceStyle(formData);

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
          <DialogTitle>{danceStyle ? "Tanzstil bearbeiten" : "Neuer Tanzstil"}</DialogTitle>
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
                    <Input {...field} placeholder="z. B. Salsa" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* PROJ-93: Der Preis ist der Schalter. Deshalb steht der Satz
                darunter und nicht in einer Anleitung woanders. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="pass_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pass je Monat</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="decimal" placeholder="z. B. 85" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pass_student_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pass für Studierende</FormLabel>
                    <FormControl>
                      <Input {...field} inputMode="decimal" placeholder="z. B. 70" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Mit einem Preis gibt es einen Pass für diese Stilrichtung: Kunden sehen ihn beim Buchen
              ihrer Kurse als dritte Wahl neben Kursabo und Flatrate. Leer heißt, dass es keinen
              gibt. Bleibt der Studierendenpreis leer, gilt der normale.
            </p>

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
