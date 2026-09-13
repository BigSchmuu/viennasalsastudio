"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { resetPassword } from "@/lib/actions/auth";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { fehlertext } from "@/lib/auth/fehler";
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

  // Ein Weg für beide Auslöser, onSubmit und `action` — warum, steht in
  // register-form.tsx.
  async function absenden(formData: FormData) {
    setLoading(true);
    setFormError(null);
    try {
      const result = await resetPassword(formData);

      if ("error" in result) {
        setFormError(fehlertext(t, result.error));
        return;
      }

      window.location.href = "/profil";
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(values: ResetPasswordInput) {
    const formData = new FormData();
    formData.set("password", values.password);
    formData.set("confirmPassword", values.confirmPassword);
    await absenden(formData);
  }

  return (
    <Form {...form}>
      {/* `action` ist mehr als ein Rückfall für Klicks vor der Hydration —
          siehe register-form.tsx. */}
      <form
        action={absenden}
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>
              {formError}{" "}
              {/* Stand fest auf Deutsch, obwohl der Schlüssel längst existierte. */}
              <Link href="/passwort-vergessen" className="underline">
                {t("requestNewLink")}
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
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormDescription>{t("passwordHint")}</FormDescription>
              <AuthFormMessage />
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
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <AuthFormMessage />
            </FormItem>
          )}
        />

        <AuthSubmitButton loading={loading} loadingText={t("savingPassword")} className="w-full">
          {t("savePassword")}
        </AuthSubmitButton>
      </form>
    </Form>
  );
}
