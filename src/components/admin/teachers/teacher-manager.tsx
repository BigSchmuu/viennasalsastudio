"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { teacherInviteSchema, type TeacherInviteInput } from "@/lib/validations/admin";
import { inviteTeacher, promoteToTeacher, demoteToCustomer } from "@/lib/actions/admin/teachers";
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

export type TeacherRow = {
  id: string;
  name: string;
  email: string;
  courseNames: string[];
};

export type CustomerOption = {
  id: string;
  name: string;
  email: string;
};

export function TeacherManager({
  teachers: initialTeachers,
  customers,
}: {
  teachers: TeacherRow[];
  customers: CustomerOption[];
}) {
  const [teachers, setTeachers] = useState(initialTeachers);
  useEffect(() => {
    setTeachers(initialTeachers);
  }, [initialTeachers]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [demoteTarget, setDemoteTarget] = useState<TeacherRow | null>(null);
  const [demoteError, setDemoteError] = useState<string | null>(null);
  const [demotingId, setDemotingId] = useState<string | null>(null);

  async function runDemote(teacherId: string) {
    setDemotingId(teacherId);
    setDemoteError(null);
    try {
      const result = await demoteToCustomer(teacherId);
      if ("error" in result) {
        setDemoteError(result.error);
        return;
      }
      setDemoteTarget(null);
    } finally {
      setDemotingId(null);
    }
  }

  function handleDemoteClick(teacher: TeacherRow) {
    setDemoteError(null);
    if (teacher.courseNames.length === 0) {
      // No course assignments to warn about — demote immediately, no dialog.
      runDemote(teacher.id);
      return;
    }
    setDemoteTarget(teacher);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setPromoteOpen(true)}>
          Bestehenden Kunden befördern
        </Button>
        <Button onClick={() => setInviteOpen(true)}>Lehrer einladen</Button>
      </div>

      {teachers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Noch keine Lehrer vorhanden.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachers.map((teacher) => (
              <TableRow key={teacher.id}>
                <TableCell className="font-medium">{teacher.name}</TableCell>
                <TableCell>{teacher.email}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={demotingId === teacher.id}
                    onClick={() => handleDemoteClick(teacher)}
                  >
                    Zum Kunden zurückstufen
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <InviteTeacherDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <PromoteCustomerDialog open={promoteOpen} onOpenChange={setPromoteOpen} customers={customers} />

      <AlertDialog open={demoteTarget !== null} onOpenChange={(open) => !open && setDemoteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>„{demoteTarget?.name}&quot; zum Kunden zurückstufen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Diese Person ist aktuell noch bei folgenden Kursen als Lehrer eingetragen:</p>
                <ul className="list-disc pl-5">
                  {demoteTarget?.courseNames.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
                <p>
                  Die Zuordnungen bleiben bestehen, die Person verschwindet aber aus der öffentlichen
                  Lehrer-Anzeige dieser Kurse.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {demoteError && (
            <Alert variant="destructive">
              <AlertDescription>{demoteError}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={demoteTarget !== null && demotingId === demoteTarget.id}
              onClick={(e) => {
                e.preventDefault();
                if (demoteTarget) runDemote(demoteTarget.id);
              }}
            >
              Zurückstufen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteTeacherDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<TeacherInviteInput>({
    resolver: zodResolver(teacherInviteSchema),
    defaultValues: { full_name: "", email: "" },
  });

  async function onSubmit(values: TeacherInviteInput) {
    setLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.set("full_name", values.full_name);
      formData.set("email", values.email);

      const result = await inviteTeacher(formData);
      if ("error" in result) {
        setFormError(result.error);
        return;
      }

      form.reset();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset();
          setFormError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lehrer einladen</DialogTitle>
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
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="z. B. Maria Musterlehrerin" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="lehrer@beispiel.at" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={loading}>
                {loading ? "Wird eingeladen…" : "Einladung senden"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PromoteCustomerDialog({
  open,
  onOpenChange,
  customers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerOption[];
}) {
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const filtered = customers.filter((c) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term);
  });

  async function handlePromote(customerId: string) {
    setPromotingId(customerId);
    setError(null);
    try {
      const result = await promoteToTeacher(customerId);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSearch("");
      onOpenChange(false);
    } finally {
      setPromotingId(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSearch("");
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bestehenden Kunden zum Lehrer befördern</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Input
            placeholder="Suche nach Name oder E-Mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-80 overflow-y-auto space-y-1">
            {customers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Noch keine Kunden registriert.</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Keine Kunden gefunden.</p>
            ) : (
              filtered.map((customer) => (
                <div
                  key={customer.id}
                  className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-muted-foreground">{customer.email}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={promotingId === customer.id}
                    onClick={() => handlePromote(customer.id)}
                  >
                    Befördern
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
