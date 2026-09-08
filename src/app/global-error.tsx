"use client";

import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    // Nachgeladen, nicht fest importiert: Ein fester Import zöge den 61 kB
    // schweren Browser-Teil von Sentry in das Bündel jeder Seite — für einen
    // Fall, der im Regelbetrieb nie eintritt. Hat SentryInit ihn bereits
    // geholt, kommt er hier aus dem Zwischenspeicher.
    void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error));
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
