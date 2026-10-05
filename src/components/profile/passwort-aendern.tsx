"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validations/auth";
import { passwortAendern } from "@/lib/actions/passwort-aendern";
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

const LEER = { currentPassword: "", password: "", confirmPassword: "" };

/**
 * Passwort ändern im Profil (PROJ-73).
 *
 * Für jedes Konto, nicht nur für die Verwaltung: Der Umweg „abmelden → Passwort
 * vergessen → Mail abwarten" ist auch für Kunden unnötig, solange sie
 * angemeldet sind. Für Verwaltungskonten ist er sogar aussichtslos, solange die
 * zweite Stufe dazwischensteht (PROJ-58).
 */
export function PasswortAendern() {
  const t = useTranslations("auth");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState(false);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: LEER,
  });

  // Ein Weg für beide Auslöser, onSubmit und `action` — warum, steht in
  // register-form.tsx.
  async function absenden(formData: FormData) {
    setLoading(true);
    setFormError(null);
    setErfolg(false);
    try {
      const result = await passwortAendern(formData);

      if ("error" in result) {
        setFormError(fehlertext(t, result.error));
        return;
      }

      // Die Felder leeren: Das alte Passwort steht sonst noch im Formular, und
      // genau das ist jetzt wertlos.
      form.reset(LEER);
      setErfolg(true);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(values: ChangePasswordInput) {
    const formData = new FormData();
    formData.set("currentPassword", values.currentPassword);
    formData.set("password", values.password);
    formData.set("confirmPassword", values.confirmPassword);
    await absenden(formData);
  }

  return (
    <Form {...form}>
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

        {erfolg && (
          <Alert>
            <AlertDescription>{t("passwordChanged")}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("currentPassword")}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
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

        <AuthSubmitButton loading={loading} loadingText={t("savingPassword")}>
          {t("savePassword")}
        </AuthSubmitButton>
      </form>
    </Form>
  );
}
