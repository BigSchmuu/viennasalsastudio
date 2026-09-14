import { MapPin } from "lucide-react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { EventAktion } from "@/components/events/event-aktion";
import { EventPreis, EventVerfuegbarkeit } from "@/components/events/event-angaben";
import { eventTermin } from "@/lib/events/termin";
import type { EventZustand, SalesMode } from "@/lib/events/event-zustand";

export type PublicEventRow = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  priceNormal: number | null;
  priceStudent: number | null;
  salesMode: SalesMode;
  slug: string;
  typeName: string | null;
  zustand: EventZustand;
  freiePlaetze: number | null;
  stornierbar: boolean;
};

/**
 * Ein Event in der Übersicht (PROJ-53). Die ganze Karte führt zur Eventseite;
 * der Knopf liegt darüber und bleibt eigenständig bedienbar.
 */
export function EventCard({
  event,
  isLoggedIn,
  hasMandate,
}: {
  event: PublicEventRow;
  isLoggedIn: boolean;
  hasMandate: boolean;
}) {
  const locale = useLocale();

  return (
    <Card className="relative flex flex-col rounded-card shadow-soft transition-shadow focus-within:ring-2 focus-within:ring-ring hover:shadow-lg">
      <CardHeader className="space-y-2">
        {event.typeName ? (
          <Badge variant="secondary" className="w-fit">
            {event.typeName}
          </Badge>
        ) : null}
        <CardTitle className="font-heading leading-snug">
          {/* Der Link spannt sich über die ganze Karte. Ein Link um die ganze
              Karte ginge nicht: Der Kaufknopf darin wäre dann ein Knopf in
              einem Link — für Screenreader und Tastatur unbedienbar. */}
          <Link
            href={`/events/${event.slug}`}
            className="after:absolute after:inset-0 after:rounded-card focus-visible:outline-none"
          >
            {event.name}
          </Link>
        </CardTitle>
        <CardDescription>{eventTermin(event.startsAt, event.endsAt, locale)}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-2">
        {event.location ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {event.location}
          </p>
        ) : null}
        {event.description ? <p className="line-clamp-3 text-sm">{event.description}</p> : null}
        <EventPreis priceNormal={event.priceNormal} priceStudent={event.priceStudent} />
        <EventVerfuegbarkeit zustand={event.zustand} plaetze={event.freiePlaetze} />
      </CardContent>

      <CardFooter className="relative z-10 empty:hidden">
        <EventAktion
          event={{
            id: event.id,
            name: event.name,
            slug: event.slug,
            // Wer Tickets verkauft, hat Preise — das Formular verlangt sie.
            priceNormal: event.priceNormal ?? 0,
            priceStudent: event.priceStudent ?? 0,
          }}
          zustand={event.zustand}
          isLoggedIn={isLoggedIn}
          hasMandate={hasMandate}
          stornierbar={event.stornierbar}
          className="w-full"
        />
      </CardFooter>
    </Card>
  );
}
