"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TicketPurchaseDialog } from "@/components/events/ticket-purchase-dialog";

function formatPrice(price: number): string {
  return price.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-AT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const isFull = event.occupied >= event.capacity;
  const remaining = event.capacity - event.occupied;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">{event.name}</CardTitle>
        <CardDescription>{formatDateTime(event.startsAt)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {event.location && <p className="text-sm text-muted-foreground">📍 {event.location}</p>}
        {event.description && <p className="text-sm">{event.description}</p>}
        <p className="text-sm font-medium">
          {formatPrice(event.priceNormal)}
          {event.priceStudent !== event.priceNormal && (
            <span className="text-muted-foreground"> · Studierende {formatPrice(event.priceStudent)}</span>
          )}
        </p>
        {isFull ? (
          <Badge variant="destructive">Ausgebucht</Badge>
        ) : (
          <p className="text-xs text-muted-foreground">Noch {remaining} Plätze frei</p>
        )}
      </CardContent>
      <CardFooter>
        {isFull ? (
          <Button disabled className="w-full">
            Ausgebucht
          </Button>
        ) : isLoggedIn ? (
          <Button className="w-full" onClick={() => setPurchaseOpen(true)}>
            Ticket kaufen
          </Button>
        ) : (
          <Button className="w-full" asChild>
            <Link href={`/login?redirect=/events`}>Zum Ticket-Kauf einloggen</Link>
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
