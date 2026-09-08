"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { YoutubeEmbed } from "@/components/video/youtube-embed";
import { getYoutubeEmbedUrl } from "@/lib/youtube";
import { cn } from "@/lib/utils";

export type Lektion = {
  id: string;
  titel: string;
  videoUrls: string[];
};

/** „2 Videos", „1 Video", „keine Videos" — Zahlwort statt nackter Ziffer. */
function videoAnzahl(anzahl: number): string {
  if (anzahl === 0) return "keine Videos";
  return anzahl === 1 ? "1 Video" : `${anzahl} Videos`;
}

/**
 * Eine Lektion. Der Player lädt erst beim Aufklappen.
 *
 * Ein Videosatz mit acht Lektionen à zwei Videos wären sechzehn
 * YouTube-Player, die alle beim Öffnen der Seite anfangen zu laden — jeder
 * davon zieht rund ein Megabyte fremden Code nach. Aufgeklappt wird deshalb
 * einzeln, und `offen` steuert, ob das Einbetten überhaupt gerendert wird.
 */
function LektionsZeile({ lektion }: { lektion: Lektion }) {
  const [offen, setOffen] = useState(false);

  return (
    <Collapsible open={offen} onOpenChange={setOffen} className="border-b last:border-b-0">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 py-3 text-left">
        <span className="text-sm font-medium">{lektion.titel}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">{videoAnzahl(lektion.videoUrls.length)}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn("h-4 w-4 text-muted-foreground transition-transform", offen && "rotate-180")}
          />
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3 pb-4">
        {lektion.videoUrls.length === 0 ? (
          <p className="text-sm text-muted-foreground">Für diese Lektion ist noch kein Video hinterlegt.</p>
        ) : (
          lektion.videoUrls.map((url, i) =>
            // In der Datenbank darf jede Adresse stehen. Der Player zeigt bei
            // allem, was nicht YouTube ist, gar nichts an — dann lieber ein
            // Link als eine leere Fläche, bei der niemand weiß, ob etwas fehlt.
            getYoutubeEmbedUrl(url) ? (
              <YoutubeEmbed key={url} url={url} title={`${lektion.titel} — Video ${i + 1}`} />
            ) : (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-4"
              >
                Video {i + 1} öffnen
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            )
          )
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Das interne Lehrmaterial zum Kurs (PROJ-23).
 *
 * Die Nutzergeschichte stand seit August in der Spezifikation, die Ansicht
 * fehlte: PROJ-23 hatte sie an die Lehrer-Ansicht weitergereicht, PROJ-13 hat
 * sie nicht aufgegriffen. Die Leseberechtigung für zugeordnete Lehrer liegt
 * seit damals in der Datenbank.
 */
export function Lehrmaterial({ satzName, lektionen }: { satzName: string; lektionen: Lektion[] }) {
  const [offen, setOffen] = useState(false);

  return (
    <Collapsible open={offen} onOpenChange={setOffen} className="rounded-md border p-4">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block text-sm font-medium">Lehrmaterial</span>
          <span className="block text-xs text-muted-foreground">
            {satzName} · {lektionen.length === 1 ? "1 Lektion" : `${lektionen.length} Lektionen`}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", offen && "rotate-180")}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="pt-2">
        {lektionen.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            Dieser Videosatz hat noch keine Lektionen.
          </p>
        ) : (
          lektionen.map((l) => <LektionsZeile key={l.id} lektion={l} />)
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
