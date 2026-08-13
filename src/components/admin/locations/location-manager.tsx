"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { locationSchema, type LocationInput } from "@/lib/validations/admin";
import { createLocation, updateLocation, deleteLocation } from "@/lib/actions/admin/locations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export type LocationRow = {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  roomCount: number;
};

export function LocationManager({ locations }: { locations: LocationRow[] }) {
  const [editing, setEditing] = useState<LocationRow | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<LocationRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteLocation(deleteTarget.id);
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
        <Button onClick={() => setEditing("new")}>Neuer Standort</Button>
      </div>

      {locations.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Noch keine Standorte vorhanden. Lege zuerst einen Standort an.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead>Räume</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((location) => (
              <TableRow key={location.id}>
                <TableCell className="font-medium">
                  <Link href={`/admin/standorte/${location.id}`} className="hover:underline">
                    {location.name}
                  </Link>
                </TableCell>
                <TableCell>{location.address || "—"}</TableCell>
                <TableCell>{location.roomCount}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admin/standorte/${location.id}`}>Räume verwalten</Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(location)}>
                    Bearbeiten
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDeleteTarget(location);
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

      <LocationFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        location={editing === "new" ? null : editing}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Standort löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteTarget?.name}" wird unwiderruflich gelöscht.
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

function LocationFormDialog({
  open,
  onOpenChange,
  location,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: LocationRow | null;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<LocationInput>({
    resolver: zodResolver(locationSchema),
    values: {
      name: location?.name ?? "",
      address: location?.address ?? "",
      description: location?.description ?? "",
    },
  });

  async function onSubmit(values: LocationInput) {
    setLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.set("name", values.name);
      formData.set("address", values.address ?? "");
      formData.set("description", values.description ?? "");

      const result = location
        ? await updateLocation(location.id, formData)
        : await createLocation(formData);

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
          <DialogTitle>{location ? "Standort bearbeiten" : "Neuer Standort"}</DialogTitle>
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
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
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
