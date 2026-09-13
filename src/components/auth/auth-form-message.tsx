"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useFormField } from "@/components/ui/form";
import { fehlertext } from "@/lib/auth/fehler";
import { cn } from "@/lib/utils";

/**
 * `FormMessage` für die Auth-Formulare — mit Übersetzung.
 *
 * Das gewöhnliche `FormMessage` zeigt die Meldung aus dem Schema unverändert
 * an. Die Auth-Schemata liefern seit 2026-09-13 Schlüssel statt deutscher
 * Sätze; ohne diesen Baustein stünde „valEmailRequired" unter dem Feld.
 *
 * Bewusst ein eigener Baustein statt einer Änderung am gemeinsamen
 * `FormMessage`: Der Admin-Bereich ist einsprachig deutsch, seine Schemata
 * liefern weiterhin fertige Sätze, und die sollen unangetastet bleiben.
 */
export const AuthFormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function AuthFormMessage({ className, children, ...props }, ref) {
  const t = useTranslations("auth");
  const { error, formMessageId } = useFormField();
  const body = error?.message ? fehlertext(t, String(error.message)) : children;

  if (!body) return null;

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  );
});
