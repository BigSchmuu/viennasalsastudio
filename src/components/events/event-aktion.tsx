"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { TicketPurchaseDialog, type TicketPurchaseEvent } from "@/components/events/ticket-purchase-dialog";
import type { EventZustand } from "@/lib/events/event-zustand";
import { cn } from "@/lib/utils";

/**
 * Der Knopf zu einem Event — auf der Karte und auf der Eventseite derselbe
 * (PROJ-53). Was er anbietet, entscheidet `eventZustand`; hier steht nur, wie
 * das aussieht.
 *
 * Alle Links laufen über die sprachbewusste Navigation. Vorher warf „Zum
 * Ticket-Kauf einloggen" englische Besucher ins Deutsche zurück.
 */
export function EventAktion({
  event,
  zustand,
  isLoggedIn,
  hasMandate,
  stornierbar,
  className,
}: {
  event: TicketPurchaseEvent & { slug: string };
  zustand: EventZustand;
  isLoggedIn: boolean;
  hasMandate: boolean;
  stornierbar: boolean;
  className?: string;
}) {
  const t = useTranslations("events");
  const [kaufOffen, setKaufOffen] = useState(false);
  const knopf = cn("min-h-11", className);

  if (zustand === "ticketVorhanden") {
    return (
      <Button asChild variant="outline" className={knopf}>
        <Link href="/profil#tickets">{t("viewTicket")}</Link>
      </Button>
    );
  }

  if (zustand === "ausgebucht") {
    return (
      <Button disabled className={knopf}>
        {t("soldOut")}
      </Button>
    );
  }

  // Abgesagt, vorbei oder nur angezeigt: kein Knopf. Was stattdessen gilt,
  // sagen die Angaben daneben.
  if (zustand !== "kaufen") return null;

  if (!isLoggedIn) {
    return (
      <Button asChild className={knopf}>
        <Link href={{ pathname: "/login", query: { redirect: `/events/${event.slug}` } }}>{t("loginToBuy")}</Link>
      </Button>
    );
  }

  return (
    <>
      <Button className={knopf} onClick={() => setKaufOffen(true)}>
        {t("buyTicket")}
      </Button>
      <TicketPurchaseDialog
        open={kaufOffen}
        onOpenChange={setKaufOffen}
        event={{ id: event.id, name: event.name, priceNormal: event.priceNormal, priceStudent: event.priceStudent }}
        hasMandate={hasMandate}
        stornierbar={stornierbar}
      />
    </>
  );
}
