"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";
import { signUp } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTranslations } from "next-intl";
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

export function RegisterForm() {
  const t = useTranslations("auth");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "" },
  });

  // Ein Weg für beide Auslöser, onSubmit und `action` — Begründung am Formular.
  async function absenden(formData: FormData) {
    setLoading(true);
    setFormError(null);
    try {
      const result = await signUp(formData);

      if ("error" in result) {
        // Auch das Mailversand-Limit hat jetzt eine eigene Meldung — vorher war
        // es nicht von „Registrierung fehlgeschlagen" zu unterscheiden.
        setFormError(fehlertext(t, result.error));
        return;
      }

      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(values: RegisterInput) {
    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("password", values.password);
    await absenden(formData);
  }

  if (submitted) {
    return (
      <Alert>
        <AlertDescription>
          {t("confirmEmailSent")}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      {/* `action` hat zwei Aufgaben, und für die Formulare Login, Passwort
          vergessen und Passwort zurücksetzen gilt dasselbe:

          1. Ohne sie fiele ein Klick vor der Hydration auf ein natives GET
             zurück, samt Passwort in der URL (PROJ-2 QA BUG-1).
          2. React spielt so einen Klick nach der Hydration über `action` nach,
             nicht über onSubmit. Bis 2026-09-13 verwarf `action` das Ergebnis:
             Der Kunde sah keine Bestätigung, schickte noch einmal ab — und die
             zweite Mail machte den Link der ersten ungültig. Deshalb laufen
             beide Auslöser durch `absenden`. */}
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

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("password")}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="new-password" {...field} />
              </FormControl>
              <FormDescription>{t("passwordHint")}</FormDescription>
              <AuthFormMessage />
            </FormItem>
          )}
        />

        <AuthSubmitButton loading={loading} loadingText={t("registering")} className="w-full">
          {t("register")}
        </AuthSubmitButton>

        <p className="text-center text-sm text-muted-foreground">
          {t("haveAccount")}{" "}
          <Link href="/login" className="text-primary hover:underline">
            {t("loginNow")}
          </Link>
        </p>
      </form>
    </Form>
  );
}
