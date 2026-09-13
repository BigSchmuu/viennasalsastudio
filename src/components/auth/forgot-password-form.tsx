"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";
import { requestPasswordReset } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslations } from "next-intl";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { AuthFormMessage } from "@/components/auth/auth-form-message";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { fehlertext } from "@/lib/auth/fehler";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  // Ein Weg für beide Auslöser, onSubmit und `action` — warum, steht in
  // register-form.tsx. Hier wiegt es am schwersten: Jede zweite Anfrage macht
  // den Link der ersten Mail ungültig.
  async function absenden(formData: FormData) {
    setLoading(true);
    setFormError(null);
    try {
      const result = await requestPasswordReset(formData);

      if ("error" in result) {
        setFormError(fehlertext(t, result.error));
        return;
      }

      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(values: ForgotPasswordInput) {
    const formData = new FormData();
    formData.set("email", values.email);
    await absenden(formData);
  }

  if (submitted) {
    return (
      <Alert>
        <AlertDescription>
          {t("resetLinkSent")}
        </AlertDescription>
      </Alert>
    );
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
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("email")}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder={t("emailPlaceholder")} {...field} />
              </FormControl>
              <AuthFormMessage />
            </FormItem>
          )}
        />

        <AuthSubmitButton loading={loading} loadingText={t("sending")} className="w-full">
          {t("requestResetLink")}
        </AuthSubmitButton>

        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            {t("backToLogin")}
          </Link>
        </p>
      </form>
    </Form>
  );
}
