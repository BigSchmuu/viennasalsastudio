import { CalendarDays, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { EventAktion } from "@/components/events/event-aktion";
import { EventPreis } from "@/components/events/event-angaben";
import { SerienRhythmus } from "@/components/events/serien-rhythmus";
import { EventTitelbild } from "@/components/events/event-titelbild";
import { EventGalerie } from "@/components/events/event-galerie";
import { EventVideos } from "@/components/events/event-videos";
import type { EventBild, EventVideo } from "@/lib/events/medien";
import { einfacherKauf } from "@/lib/events/kauf-laden";
import { formatDate, formatDateTime } from "@/lib/formatting";
import type { EventZustand } from "@/lib/events/event-zustand";

export type SerienTermin = {
  id: string;
  slug: string;
  startsAt: string;
  endsAt: string | null;
  abgesagt: boolean;
  verlegt: boolean;
  zustand: EventZustand;
  freiePlaetze: number | null;
  stornierbar: boolean;
};

export type SerienAnsicht = {
  id: string;
  name: string;
  slug: string;
  typeName: string | null;
  description: string | null;
  location: string | null;
  weekday: number;
  startTime: string;
  endTime: string | null;
  priceNormal: number | null;
  priceStudent: number | null;
  ferienpauseBis: string | null;
  titelbild: EventBild | null;
  galerie: EventBild[];
  videos: EventVideo[];
};

/**
 * Die Seite einer regelmäßigen Veranstaltung (PROJ-54).
 *
 * Kern ist die Terminliste: Ein Kunde kauft nicht „die Party", sondern einen
 * Abend. Jeder Termin ist ein eigenes Event mit eigener Kapazität — deshalb
 * steht der Kaufknopf an der Zeile, nicht oben an der Seite.
 */
export function SerienSeite({
  serie,
  termine,
  isLoggedIn,
  hasMandate,
}: {
  serie: SerienAnsicht;
  termine: SerienTermin[];
  isLoggedIn: boolean;
  hasMandate: boolean;
}) {
  const t = useTranslations("events");
  const locale = useLocale();

  return (
    <article className="mt-4 rounded-card border border-border/60 bg-card/80 p-5 shadow-soft backdrop-blur sm:p-8">
      {serie.titelbild ? (
        <div className="mb-6">
          <EventTitelbild
            bild={serie.titelbild}
            eventName={serie.name}
            typeName={serie.typeName}
            variante="seite"
            prioritaet
          />
        </div>
      ) : null}
      {serie.typeName ? <Badge variant="secondary">{serie.typeName}</Badge> : null}
      <h1 className="mt-3 font-heading text-2xl font-bold tracking-[-0.5px] sm:text-3xl">{serie.name}</h1>

      <dl className="mt-5 space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <dt className="sr-only">{t("when")}</dt>
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <dd>
            <SerienRhythmus weekday={serie.weekday} startTime={serie.startTime} endTime={serie.endTime} />
          </dd>
        </div>
        {serie.location ? (
          <div className="flex items-start gap-2">
            <dt className="sr-only">{t("where")}</dt>
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <dd>{serie.location}</dd>
          </div>
        ) : null}
      </dl>

      {serie.description ? <p className="mt-6 whitespace-pre-line leading-relaxed">{serie.description}</p> : null}

      <div className="mt-6">
        <EventPreis priceNormal={serie.priceNormal} priceStudent={serie.priceStudent} />
      </div>

      <section className="mt-8 border-t border-border/60 pt-6">
        <h2 className="font-heading text-lg font-bold tracking-[-0.5px]">{t("upcomingDates")}</h2>

        {serie.ferienpauseBis ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("holidayBreak", { date: formatDate(serie.ferienpauseBis, locale) })}
          </p>
        ) : null}

        {termine.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("noUpcomingDates")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {termine.map((termin) => (
              <li key={termin.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className={termin.abgesagt ? "text-sm line-through text-muted-foreground" : "text-sm font-medium"}>
                    {formatDateTime(termin.startsAt, locale)}
                  </p>
                  {termin.abgesagt ? (
                    <Badge variant="destructive" className="mt-1">
                      {t("dateCancelled")}
                    </Badge>
                  ) : termin.verlegt ? (
                    <Badge variant="secondary" className="mt-1">
                      {t("dateMoved")}
                    </Badge>
                  ) : termin.zustand === "kaufen" && termin.freiePlaetze !== null ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("spotsLeft", { count: termin.freiePlaetze })}
                    </p>
                  ) : null}
                </div>

                {termin.abgesagt ? null : (
                  <EventAktion
                    event={{
                      ...einfacherKauf({
                        id: termin.id,
                        name: serie.name,
                        priceNormal: serie.priceNormal,
                        priceStudent: serie.priceStudent,
                      }),
                      slug: termin.slug,
                    }}
                    zustand={termin.zustand}
                    isLoggedIn={isLoggedIn}
                    hasMandate={hasMandate}
                    stornierbar={termin.stornierbar}
                    className="shrink-0"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <EventGalerie bilder={serie.galerie} eventName={serie.name} />
      <EventVideos videos={serie.videos} eventName={serie.name} />
    </article>
  );
}
