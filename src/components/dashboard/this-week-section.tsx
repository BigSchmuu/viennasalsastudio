"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useFormatter } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TicketPurchaseDialog, type TicketPurchaseEvent } from "@/components/events/ticket-purchase-dialog";

export type WochenEvent = {
  event: TicketPurchaseEvent;
  startsAt: string;
  location: string | null;
  ausgebucht: boolean;
  hatTicket: boolean;
};

/**
 * „Diese Woche im Studio".
 *
 * Bewusst kompakte Zeilen statt der Eventkarten von /events: drei volle
 * Karten fressen am Telefon den halben Bildschirm, und dieser Abschnitt ist
 * Beiwerk, kein Hauptzweck der Seite. Gekauft wird trotzdem über denselben
 * Dialog wie auf der Eventseite — das Verhalten bleibt identisch.
 */
export function ThisWeekSection({
  events,
  hasMandate,
}: {
  events: WochenEvent[];
  hasMandate: boolean;
}) {
  const t = useTranslations("dashboard.thisWeek");
  const format = useFormatter();
  const [offenesEvent, setOffenesEvent] = useState<TicketPurchaseEvent | null>(null);

  if (events.length === 0) return null;

  return (
    <section>
      <h2 className="font-heading text-lg font-bold tracking-[-0.5px]">{t("heading")}</h2>

      <Card className="mt-3 border-border/60">
        <CardContent className="p-2">
          <ul className="divide-y divide-border/60">
            {events.map(({ event, startsAt, location, ausgebucht, hatTicket }) => (
              <li key={event.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{event.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {format.dateTime(new Date(startsAt), {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Europe/Vienna",
                    })}
                    {location ? ` · ${location}` : ""}
                  </p>
                </div>

                {hatTicket ? (
                  <Badge variant="secondary" className="shrink-0 text-[11px]">
                    {t("hasTicket")}
                  </Badge>
                ) : ausgebucht ? (
                  <Badge variant="outline" className="shrink-0 text-[11px]">
                    {t("soldOut")}
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => setOffenesEvent(event)}
                  >
                    {t("buy")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="mt-2 text-sm">
        <Link href="/events" className="font-medium text-primary hover:underline">
          {t("allEvents")} →
        </Link>
      </p>

      {offenesEvent ? (
        <TicketPurchaseDialog
          open
          onOpenChange={(o) => !o && setOffenesEvent(null)}
          event={offenesEvent}
          hasMandate={hasMandate}
        />
      ) : null}
    </section>
  );
}
