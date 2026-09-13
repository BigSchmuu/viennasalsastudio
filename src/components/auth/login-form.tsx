"use client";

import { useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { signIn, resendConfirmationEmail } from "@/lib/actions/auth";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
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

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const t = useTranslations("auth");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  // Die Adresse des Versuchs, der an der fehlenden Bestätigung scheiterte. Kam
  // er vor der Hydration, steht sie nicht im Formularzustand.
  const letzteAdresse = useRef("");

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Ein Weg für beide Auslöser, onSubmit und `action` — warum, steht in
  // register-form.tsx.
  async function absenden(formData: FormData) {
    setLoading(true);
    setFormError(null);
    setNeedsConfirmation(false);
    letzteAdresse.current = String(formData.get("email") ?? "");
    try {
      const result = await signIn(formData);

      if ("error" in result) {
        if (result.error === "email_not_confirmed") {
          setNeedsConfirmation(true);
        } else {
          // Ein Schlüssel, in der Sprache der Seite angezeigt — vorher stand
          // „E-Mail oder Passwort falsch" auch auf der englischen Seite.
          setFormError(fehlertext(t, result.error));
        }
        return;
      }

      // `redirectTo` comes straight from a query parameter, so it must be
      // constrained to our own origin — otherwise a link to the real site
      // could bounce the user to a phishing page right after a genuine login.
      const fallback = result.role === "admin" ? "/admin" : "/mein-bereich";
      window.location.href = safeRedirectPath(redirectTo, fallback, window.location.origin);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(values: LoginInput) {
    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("password", values.password);
    await absenden(formData);
  }

  async function handleResend() {
    setResendState("sending");
    await resendConfirmationEmail(letzteAdresse.current);
    setResendState("sent");
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

        {needsConfirmation && (
          <Alert>
            <AlertDescription className="space-y-2">
              <p>{t("confirmFirst")}</p>
              {resendState === "sent" ? (
                <p className="font-medium">{t("confirmationResent")}</p>
              ) : (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  onClick={handleResend}
                  disabled={resendState === "sending"}
                >
                  {resendState === "sending" ? t("sending") : t("resendConfirmation")}
                </Button>
              )}
            </AlertDescription>
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
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <AuthFormMessage />
            </FormItem>
          )}
        />

        <div className="text-sm">
          <Link href="/passwort-vergessen" className="text-primary hover:underline">
            {t("forgotPassword")}
          </Link>
        </div>

        <AuthSubmitButton loading={loading} loadingText={t("loggingIn")} className="w-full">
          {t("login")}
        </AuthSubmitButton>

        <p className="text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href="/registrieren" className="text-primary hover:underline">
            {t("registerNow")}
          </Link>
        </p>
      </form>
    </Form>
  );
}
