"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Wenn im Kundenbereich etwas abstürzt (2026-09-27).
 *
 * Vorher gab es nur `global-error.tsx` mit der nackten Fehlerseite von
 * Next.js — weiße Seite, englischer Text, kein Weg zurück. Anlass war ein
 * Sentry-Bericht von der Kursseite: „Failed to execute 'removeChild' on
 * 'Node'". Dieser Fehler entsteht fast immer durch eine Browsererweiterung,
 * die das HTML umbaut (Übersetzer, Passwortmanager). Reparieren können wir das
 * nicht — aber ein Neuladen hilft dabei fast immer, und genau das soll hier
 * stehen.
 *
 * Die Texte stehen bewusst in dieser Datei und nicht in den Sprachdateien: Eine
 * Fehlerseite darf nicht dieselbe Maschinerie brauchen, die vielleicht gerade
 * ausgefallen ist. Die Sprache kommt aus der Adresse.
 */

const TEXTE = {
  de: {
    titel: "Da ist etwas schiefgelaufen",
    text: "Die Seite konnte nicht richtig angezeigt werden. Ein Neuladen hilft meistens — vor allem, wenn eine Browsererweiterung wie ein Übersetzer mitgemischt hat.",
    neuLaden: "Seite neu laden",
    startseite: "Zur Startseite",
  },
  en: {
    titel: "Something went wrong",
    text: "This page could not be displayed properly. Reloading usually fixes it — especially if a browser extension such as a translator interfered.",
    neuLaden: "Reload page",
    startseite: "Go to homepage",
  },
} as const;

export default function SiteError({ error }: { error: Error & { digest?: string } }) {
  const params = useParams();
  const sprache = params?.locale === "en" ? "en" : "de";
  const t = TEXTE[sprache];

  useEffect(() => {
    // Nachgeladen wie in global-error.tsx: Der Browser-Teil von Sentry wiegt
    // 61 kB und wird erst gebraucht, wenn etwas kaputt ist.
    void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-20">
      <h1 className="font-heading text-3xl font-bold tracking-[-0.5px]">{t.titel}</h1>
      <p className="text-muted-foreground">{t.text}</p>
      <div className="flex flex-wrap gap-3">
        {/* Kein `reset()`: Bei einem umgebauten Baum setzt React auf denselben
            kaputten Knoten auf und fällt sofort wieder um. Ein echtes Neuladen
            holt die Seite von vorn. */}
        <Button onClick={() => window.location.reload()}>{t.neuLaden}</Button>
        <Button variant="outline" asChild>
          <a href={sprache === "en" ? "/en" : "/"}>{t.startseite}</a>
        </Button>
      </div>
    </div>
  );
}
