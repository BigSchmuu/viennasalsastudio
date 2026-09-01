"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useAutofillUebernehmen } from "@/hooks/use-autofill-uebernehmen";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { resetPassword } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const formularRef = useAutofillUebernehmen(form, ["password", "confirmPassword"]);

  async function onSubmit(values: ResetPasswordInput) {
    setLoading(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.set("password", values.password);
      formData.set("confirmPassword", values.confirmPassword);

      const result = await resetPassword(formData);

      if ("error" in result) {
        setFormError(result.error);
        return;
      }

      window.location.href = "/profil";
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      {/* action={resetPassword}: progressive-enhancement fallback so the new
          password can't leak into a native GET URL — see PROJ-2 QA BUG-1. */}
      <form
        ref={formularRef}
        action={async (formData) => {
          await resetPassword(formData);
        }}
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>
              {formError}{" "}
              <Link href="/passwort-vergessen" className="underline">
                Neuen Link anfordern
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("newPassword")}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("confirmPassword")}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t("savingPassword") : t("savePassword")}
        </Button>
      </form>
    </Form>
  );
}
