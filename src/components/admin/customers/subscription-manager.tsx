"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { subscriptionSchema, type SubscriptionInput } from "@/lib/validations/admin";
import {
  createSubscription,
  updateSubscription,
  deleteSubscription,
  applyPendingChange,
} from "@/lib/actions/admin/subscriptions";
import {
  subscriptionStatusOptions,
  subscriptionStatusLabel,
  subscriptionStatusColor,
} from "@/lib/constants/subscription-status";
import { heuteInWien } from "@/lib/constants/zeitzone";
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

const NO_COURSE = "__none__";

export type SubscriptionCourseOption = { id: string; name: string };

export type SubscriptionRow = {
  id: string;
  name: string;
  price: number;
  status: string;
  courseId: string | null;
  cycleAnchorDate: string;
  pendingStatus: string | null;
  pendingEffectiveDate: string | null;
};

function formatPrice(price: number): string {
  return price.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

function formatDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function pendingChangeLabel(row: SubscriptionRow): string | null {
  if (!row.pendingStatus || !row.pendingEffectiveDate) return null;
  const kind = row.pendingStatus === "paused" ? "Pausierung" : "Kündigung";
  return `Geplante Änderung: ${kind} ab ${formatDate(row.pendingEffectiveDate)}`;
}

export function SubscriptionManager({
  customerId,
  subscriptions: initialSubscriptions,
  courses,
}: {
  customerId: string;
  subscriptions: SubscriptionRow[];
  courses: SubscriptionCourseOption[];
}) {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  // Create/update/delete go through Server Actions that call revalidatePath
  // rather than returning the mutated row, so the parent Server Component
  // re-renders with a fresh `subscriptions` prop after each mutation — sync
  // that back into local state (which otherwise only self-updates for the
  // optimistic "Jetzt übernehmen" flow below).
  useEffect(() => {
    setSubscriptions(initialSubscriptions);
  }, [initialSubscriptions]);
  const [editing, setEditing] = useState<SubscriptionRow | null | "new">(null);
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteSubscription(deleteTarget.id, customerId);
    if ("error" in result) {
      setDeleteError(result.error);
      return;
    }
    setDeleteTarget(null);
    setDeleteError(null);
  }

  async function handleApplyPendingChange(subscription: SubscriptionRow) {
    setApplyingId(subscription.id);
    setApplyError(null);
    try {
      const result = await applyPendingChange(subscription.id, customerId);
      if ("error" in result) {
        setApplyError(result.error);
        return;
      }
      setSubscriptions((prev) =>
        prev.map((s) =>
          s.id === subscription.id
            ? { ...s, status: subscription.pendingStatus as string, pendingStatus: null, pendingEffectiveDate: null }
            : s
        )
      );
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>Neues Abo</Button>
      </div>

      {applyError && (
        <Alert variant="destructive">
          <AlertDescription>{applyError}</AlertDescription>
        </Alert>
      )}

      {subscriptions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Noch keine Abos vorhanden.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Preis</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscriptions.map((subscription) => {
              const pendingLabel = pendingChangeLabel(subscription);
              const isDue = Boolean(
                subscription.pendingEffectiveDate && subscription.pendingEffectiveDate <= heuteInWien()
              );
              return (
                <TableRow key={subscription.id}>
                  <TableCell className="font-medium">
                    {subscription.name}
                    {pendingLabel && <p className="text-xs font-normal text-amber-600">{pendingLabel}</p>}
                  </TableCell>
                  <TableCell>{formatPrice(subscription.price)}</TableCell>
                  <TableCell>
                    <Badge
                      style={{ backgroundColor: subscriptionStatusColor(subscription.status), color: "white" }}
                    >
                      {subscriptionStatusLabel(subscription.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {isDue && (
                      <Button
                        size="sm"
                        disabled={applyingId === subscription.id}
                        onClick={() => handleApplyPendingChange(subscription)}
                      >
                        Jetzt übernehmen
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setEditing(subscription)}>
                      Bearbeiten
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDeleteTarget(subscription);
                        setDeleteError(null);
                      }}
                    >
                      Löschen
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {editing !== null && (
        <SubscriptionFormDialog
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          subscription={editing === "new" ? null : editing}
          customerId={customerId}
          courses={courses}
        />
      )}

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abo löschen?</AlertDialogTitle>
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

function SubscriptionFormDialog({
  open,
  onOpenChange,
  subscription,
  customerId,
  courses,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: SubscriptionRow | null;
  customerId: string;
  courses: SubscriptionCourseOption[];
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<SubscriptionInput>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      name: subscription?.name ?? "",
      price: subscription?.price ?? 0,
      status: (subscription?.status as SubscriptionInput["status"]) ?? "active",
      course_id: subscription?.courseId ?? "",
      cycle_anchor_date: subscription?.cycleAnchorDate ?? heuteInWien(),
    },
  });

  async function onSubmit(values: SubscriptionInput) {
    setLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.set("name", values.name);
      formData.set("price", String(values.price));
      formData.set("status", values.status);
      formData.set("course_id", values.course_id ?? "");
      formData.set("cycle_anchor_date", values.cycle_anchor_date);

      const result = subscription
        ? await updateSubscription(subscription.id, customerId, formData)
        : await createSubscription(customerId, formData);

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
          <DialogTitle>{subscription ? "Abo bearbeiten" : "Neues Abo"}</DialogTitle>
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
                    <Input placeholder="z. B. Flatrate Studierende" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preis (€)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={Number.isNaN(field.value) ? "" : field.value}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Bitte wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subscriptionStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="course_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kurs (optional, leer bei Flatrate)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === NO_COURSE ? "" : value)}
                    value={field.value || NO_COURSE}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Kein Kurs-Bezug" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_COURSE}>Kein Kurs-Bezug</SelectItem>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cycle_anchor_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zyklus-Ankerdatum</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
