"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Ein Passwortfeld mit Auge zum Nachsehen.
 *
 * Ein Feld, dessen Inhalt man nicht prüfen kann, ist die häufigste Ursache für
 * „Passwort falsch" — besonders am Handy, wo Autokorrektur und kleine Tasten
 * mithelfen. Der Knopf schaltet nur die Anzeige um; getippt und abgeschickt
 * wird unverändert.
 *
 * Bewusst als eigener Baustein: Anmelden, Registrieren und Zurücksetzen sollen
 * sich gleich verhalten, und drei Kopien laufen früher oder später auseinander.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<typeof Input>, "type">
>(function PasswordInput({ className, ...props }, ref) {
  const t = useTranslations("auth");
  const [sichtbar, setSichtbar] = React.useState(false);

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={sichtbar ? "text" : "password"}
        // Platz für den Knopf, damit lange Passwörter nicht darunter laufen.
        className={cn("pr-10", className)}
        {...props}
      />
      <button
        type="button"
        // Ohne type="button" schickt der Knopf in einem Formular ab — der
        // Klick aufs Auge würde den Anmeldeversuch auslösen.
        onClick={() => setSichtbar((v) => !v)}
        // Höhe des Feldes, nicht kleiner: Ein Tippziel am Rand eines
        // Eingabefeldes wird sonst regelmäßig verfehlt.
        className="absolute inset-y-0 right-0 flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-pressed={sichtbar}
      >
        {/* Der Name steht als verborgener Text im Knopf, nicht als aria-label.
            Beides ergibt denselben barrierefreien Namen — aber ein aria-label
            mit dem Wort „Passwort" macht das Feld daneben nicht mehr eindeutig
            auffindbar, und daran sind auf einen Schlag vierzehn Tests
            gescheitert, die schlicht das Passwortfeld ausfüllen wollten. */}
        <span className="sr-only">{sichtbar ? t("hidePassword") : t("showPassword")}</span>
        {sichtbar ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
});
