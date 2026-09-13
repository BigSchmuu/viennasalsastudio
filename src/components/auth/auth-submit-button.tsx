"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/**
 * Absende-Knopf der Auth-Formulare — gesperrt, solange abgeschickt wird, auf
 * beiden Wegen.
 *
 * `loading` kennt nur den Weg über onSubmit. Ein Klick vor der Hydration läuft
 * über die `action` des Formulars, und deren Zustand meldet nur
 * `useFormStatus`. Ohne ihn blieb der Knopf in dieser Zeit frei, und ein
 * zweiter Tipp schickte eine zweite Mail, die den Link der ersten ungültig
 * machte (siehe register-form.tsx).
 */
export function AuthSubmitButton({
  loading,
  loadingText,
  className,
  children,
}: {
  loading: boolean;
  loadingText: string;
  className?: string;
  children: ReactNode;
}) {
  const { pending } = useFormStatus();
  const beschaeftigt = loading || pending;

  return (
    <Button type="submit" className={className} disabled={beschaeftigt}>
      {beschaeftigt ? loadingText : children}
    </Button>
  );
}
