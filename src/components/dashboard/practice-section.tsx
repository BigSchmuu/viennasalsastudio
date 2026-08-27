"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { YoutubeEmbed } from "@/components/video/youtube-embed";

export type Lektion = {
  id: string;
  titel: string;
  videoUrl: string;
};

const SICHTBAR = 5;

/**
 * „Üben" — die Videolektionen des eigenen Kurses.
 *
 * Der Sinn des Abschnitts ist, dass der Kunde die App zwischen zwei Stunden
 * öffnet. Deshalb wird das Video hier abgespielt und nicht auf die Kursseite
 * verlinkt: ein Klick weniger, und er bleibt, wo er ist.
 *
 * Immer nur ein Video offen. Zwei gleichzeitig laufende Tonspuren sind auf
 * dem Telefon ein Ärgernis, und jeder eingebettete Player kostet Ladezeit.
 */
export function PracticeSection({
  kursId,
  kursName,
  lektionen,
}: {
  kursId: string;
  kursName: string;
  lektionen: Lektion[];
}) {
  const t = useTranslations("dashboard.practice");
  const [offen, setOffen] = useState<string | null>(null);

  if (lektionen.length === 0) return null;

  const gezeigt = lektionen.slice(0, SICHTBAR);

  return (
    <section>
      <h2 className="font-heading text-lg font-bold tracking-[-0.5px]">{t("heading")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("subheading", { course: kursName })}</p>

      <Card className="mt-3 border-border/60">
        <CardContent className="p-2">
          <ul className="divide-y divide-border/60">
            {gezeigt.map((lektion, i) => {
              const istOffen = offen === lektion.id;
              return (
                <li key={lektion.id}>
                  <button
                    type="button"
                    onClick={() => setOffen(istOffen ? null : lektion.id)}
                    aria-expanded={istOffen}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    >
                      {istOffen ? "▪" : "▶"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{lektion.titel}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                  </button>

                  {istOffen ? (
                    <div className="px-3 pb-3">
                      <YoutubeEmbed url={lektion.videoUrl} title={lektion.titel} />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => setOffen(null)}
                      >
                        {t("close")}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {lektionen.length > SICHTBAR ? (
        <p className="mt-2 text-sm">
          <Link href={`/kurse/${kursId}`} className="font-medium text-primary hover:underline">
            {t("showAll", { count: lektionen.length })}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
