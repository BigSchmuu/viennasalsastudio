"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { adminProfileSchema, genderOptions, type AdminProfileInput } from "@/lib/validations/auth";
import { updateCustomerProfile } from "@/lib/actions/admin/customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BirthdateField } from "@/components/form/birthdate-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export function CustomerProfileForm({
  customerId,
  defaultValues,
}: {
  customerId: string;
  defaultValues: AdminProfileInput;
}) {
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useForm<AdminProfileInput>({
    resolver: zodResolver(adminProfileSchema),
    defaultValues,
  });

  async function onSubmit(values: AdminProfileInput) {
    setLoading(true);
    setFormError(null);
    setSaved(false);
    try {
      const formData = new FormData();
      formData.set("first_name", values.first_name);
      formData.set("last_name", values.last_name ?? "");
      formData.set("phone", values.phone ?? "");
      formData.set("birthdate", values.birthdate ?? "");
      formData.set("gender", values.gender ?? "");

      const result = await updateCustomerProfile(customerId, formData);

      if ("error" in result) {
        setFormError(result.error);
        return;
      }

      setSaved(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form
        action={async (formData) => {
          await updateCustomerProfile(customerId, formData);
        }}
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        {saved && (
          <Alert>
            <AlertDescription>Profil gespeichert.</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vorname</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                {/* PROJ-94: Freiwillig — an der Tür kennt man manchmal nur
                    einen Namen. */}
                <FormLabel>Nachname</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefon</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="birthdate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Geburtsdatum</FormLabel>
              <FormControl>
                <BirthdateField value={field.value ?? ""} onChange={field.onChange} idPrefix="admin-birthdate" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Geschlecht</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ""}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Bitte wählen" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {genderOptions.map((option) => (
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

        <Button type="submit" disabled={loading}>
          {loading ? "Wird gespeichert…" : "Speichern"}
        </Button>
      </form>
    </Form>
  );
}
