import { MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SerienRhythmus } from "@/components/events/serien-rhythmus";
import { EventTitelbild } from "@/components/events/event-titelbild";
import type { EventBild } from "@/lib/events/medien";
import { formatShortDate, formatDate } from "@/lib/formatting";

export type PublicSerieRow = {
  id: string;
  name: string;
  slug: string;
  typeName: string | null;
  location: string | null;
  weekday: number;
  startTime: string;
  endTime: string | null;
  naechsterTermin: string | null;
  ferienpauseBis: string | null;
  titelbild: EventBild | null;
};

/**
 * Eine regelmäßige Veranstaltung in der Übersicht (PROJ-54).
 *
 * Anders als eine Event-Karte nennt sie keinen einzelnen Termin, sondern den
 * Rhythmus — und darunter, wann es das nächste Mal so weit ist. Fällt der
 * nächste reguläre Termin in die Studioferien, steht dort die Ferienpause:
 * Eine Serie ohne jede Angabe sähe aus, als fände sie nicht mehr statt.
 */
export function SerieKarte({ serie }: { serie: PublicSerieRow }) {
  const t = useTranslations("events");
  const locale = useLocale();

  return (
    <Card className="relative flex flex-col overflow-hidden rounded-card shadow-soft transition-shadow focus-within:ring-2 focus-within:ring-ring hover:shadow-lg">
      <EventTitelbild bild={serie.titelbild} eventName={serie.name} typeName={serie.typeName} variante="karte" />

      <CardHeader className="space-y-2">
        {serie.typeName ? (
          <Badge variant="secondary" className="w-fit">
            {serie.typeName}
          </Badge>
        ) : null}
        <CardTitle className="font-heading leading-snug">
          <Link
            href={`/events/${serie.slug}`}
            className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none"
          >
            {serie.name}
          </Link>
        </CardTitle>
        <CardDescription>
          <SerienRhythmus weekday={serie.weekday} startTime={serie.startTime} endTime={serie.endTime} />
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-2">
        {serie.location ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {serie.location}
          </p>
        ) : null}
        {serie.ferienpauseBis ? (
          <p className="text-sm text-muted-foreground">
            {t("holidayBreak", { date: formatDate(serie.ferienpauseBis, locale) })}
          </p>
        ) : serie.naechsterTermin ? (
          <p className="text-sm font-medium">
            {t("nextDate", { date: formatShortDate(serie.naechsterTermin, locale) })}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noUpcomingDates")}</p>
        )}
      </CardContent>
    </Card>
  );
}
