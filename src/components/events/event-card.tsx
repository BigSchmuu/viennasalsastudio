"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale, useTranslations } from "next-intl";
import { formatPrice } from "@/lib/pricing";
import { formatDateTime } from "@/lib/formatting";
import { Badge } from "@/components/ui/badge";
import { TicketPurchaseDialog } from "@/components/events/ticket-purchase-dialog";

export type PublicEventRow = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  capacity: number;
  priceNormal: number;
  priceStudent: number;
  occupied: number;
};

export function EventCard({
  event,
  isLoggedIn,
  hasMandate,
}: {
  event: PublicEventRow;
  isLoggedIn: boolean;
  hasMandate: boolean;
}) {
  const t = useTranslations("events");
  const locale = useLocale();
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const isFull = event.occupied >= event.capacity;
  const remaining = event.capacity - event.occupied;

  return (
    <Card className="flex flex-col rounded-card shadow-soft">
      <CardHeader>
        <CardTitle className="font-heading">{event.name}</CardTitle>
        <CardDescription>{formatDateTime(event.startsAt, locale)}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        {event.location && <p className="text-sm text-muted-foreground">📍 {event.location}</p>}
        {event.description && <p className="text-sm">{event.description}</p>}
        <p className="text-sm font-medium">
          {formatPrice(event.priceNormal, locale)}
          {event.priceStudent !== event.priceNormal && (
            <span className="text-muted-foreground"> · {t("studentPriceLabel", { price: formatPrice(event.priceStudent, locale) })}</span>
          )}
        </p>
        {isFull ? (
          <Badge variant="destructive">{t("soldOut")}</Badge>
        ) : (
          <p className="text-xs text-muted-foreground">{t("spotsLeft", { count: remaining })}</p>
        )}
      </CardContent>
      <CardFooter>
        {isFull ? (
          <Button disabled className="w-full">
            {t("soldOut")}
          </Button>
        ) : isLoggedIn ? (
          <Button className="w-full" onClick={() => setPurchaseOpen(true)}>
            {t("buyTicket")}
          </Button>
        ) : (
          <Button className="w-full" asChild>
            <Link href={`/login?redirect=/events`}>{t("loginToBuy")}</Link>
          </Button>
        )}
      </CardFooter>

      {isLoggedIn && (
        <TicketPurchaseDialog
          open={purchaseOpen}
          onOpenChange={setPurchaseOpen}
          event={{ id: event.id, name: event.name, priceNormal: event.priceNormal, priceStudent: event.priceStudent }}
          hasMandate={hasMandate}
        />
      )}
    </Card>
  );
}
