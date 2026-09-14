"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TicketPurchaseDialog, type TicketPurchaseEvent } from "@/components/events/ticket-purchase-dialog";
import type { EventZustand } from "@/lib/events/event-zustand";

export type WochenEvent = {
  event: TicketPurchaseEvent;
  slug: string;
  startsAt: string;
  location: string | null;
  zustand: EventZustand;
  stornierbar: boolean;
};

/**
 * „Diese Woche im Studio".
 *
 * Bewusst kompakte Zeilen statt der Eventkarten von /events: drei volle
 * Karten fressen am Telefon den halben Bildschirm, und dieser Abschnitt ist
 * Beiwerk, kein Hauptzweck der Seite. Gekauft wird trotzdem über denselben
 * Dialog wie auf der Eventseite — das Verhalten bleibt identisch.
 *
 * PROJ-53: Jede Zeile führt zur Eventseite. Ist die Woche leer, zeigt der
 * Abschnitt die nächsten Events unter „Demnächst im Studio" — sonst
 * verschwände das Programm genau in den ruhigen Wochen aus dem Blick.
 */
export function ThisWeekSection({
  events,
  hasMandate,
  demnaechst,
}: {
  events: WochenEvent[];
  hasMandate: boolean;
  demnaechst: boolean;
}) {
  const t = useTranslations("dashboard.thisWeek");
  const format = useFormatter();
  const [offenesEvent, setOffenesEvent] = useState<WochenEvent | null>(null);

  if (events.length === 0) return null;

  return (
    <section>
      <h2 className="font-heading text-lg font-bold tracking-[-0.5px]">
        {demnaechst ? t("comingUp") : t("heading")}
      </h2>

      <Card className="mt-3 border-border/60">
        <CardContent className="p-2">
          <ul className="divide-y divide-border/60">
            {events.map((wochenEvent) => {
              const { event, slug, startsAt, location, zustand } = wochenEvent;
              return (
                <li key={event.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <Link
                    href={`/events/${slug}`}
                    className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-md hover:underline"
                  >
                    <span className="text-sm font-medium">{event.name}</span>
                    <span className="mt-0.5 text-xs text-muted-foreground">
                      {format.dateTime(new Date(startsAt), {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "Europe/Vienna",
                      })}
                      {location ? ` · ${location}` : ""}
                    </span>
                  </Link>

                  {zustand === "ticketVorhanden" ? (
                    <Badge variant="secondary" className="shrink-0 text-[11px]">
                      {t("hasTicket")}
                    </Badge>
                  ) : zustand === "ausgebucht" ? (
                    <Badge variant="outline" className="shrink-0 text-[11px]">
                      {t("soldOut")}
                    </Badge>
                  ) : zustand === "nurAnzeigen" ? (
                    <span className="shrink-0 text-xs text-muted-foreground">{t("onSite")}</span>
                  ) : zustand === "kaufen" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setOffenesEvent(wochenEvent)}
                    >
                      {t("buy")}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <p className="mt-2 text-sm">
        {/* Über die sprachbewusste Navigation: `next/link` warf englische
            Besucher hier ins Deutsche zurück. */}
        <Link href="/events" className="font-medium text-primary hover:underline">
          {t("allEvents")} →
        </Link>
      </p>

      {offenesEvent ? (
        <TicketPurchaseDialog
          open
          onOpenChange={(o) => !o && setOffenesEvent(null)}
          event={offenesEvent.event}
          hasMandate={hasMandate}
          stornierbar={offenesEvent.stornierbar}
        />
      ) : null}
    </section>
  );
}
