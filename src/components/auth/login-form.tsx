"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { signIn, resendConfirmationEmail } from "@/lib/actions/auth";
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

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setLoading(true);
    setFormError(null);
    setNeedsConfirmation(false);
    try {
      const formData = new FormData();
      formData.set("email", values.email);
      formData.set("password", values.password);

      const result = await signIn(formData);

      if ("error" in result) {
        if (result.error === "email_not_confirmed") {
          setNeedsConfirmation(true);
        } else {
          setFormError(result.error);
        }
        return;
      }

      window.location.href = redirectTo || "/profil";
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendState("sending");
    await resendConfirmationEmail(form.getValues("email"));
    setResendState("sent");
  }

  return (
    <Form {...form}>
      {/* `action={signIn}` is a progressive-enhancement fallback: if a click
          reaches the browser before React has hydrated, the form still POSTs
          to the real Server Action instead of falling back to a native GET
          (which would leak the password into the URL/history/server logs).
          Once hydrated, onSubmit's preventDefault takes over as usual. */}
      <form
        action={async (formData) => {
          await signIn(formData);
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

        {needsConfirmation && (
          <Alert>
            <AlertDescription className="space-y-2">
              <p>Bitte bestätige zuerst deine E-Mail-Adresse, bevor du dich einloggst.</p>
              {resendState === "sent" ? (
                <p className="font-medium">Bestätigungs-E-Mail erneut gesendet.</p>
              ) : (
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0"
                  onClick={handleResend}
                  disabled={resendState === "sending"}
                >
                  {resendState === "sending" ? "Wird gesendet…" : "Bestätigungs-E-Mail erneut senden"}
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
              <FormLabel>E-Mail</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" placeholder="du@beispiel.at" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Passwort</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="text-sm">
          <Link href="/passwort-vergessen" className="text-primary hover:underline">
            Passwort vergessen?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Wird eingeloggt…" : "Einloggen"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Noch kein Konto?{" "}
          <Link href="/registrieren" className="text-primary hover:underline">
            Jetzt registrieren
          </Link>
        </p>
      </form>
    </Form>
  );
}
