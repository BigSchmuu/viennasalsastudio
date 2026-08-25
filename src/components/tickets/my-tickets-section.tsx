"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cancelTicket } from "@/lib/actions/events";
import { ticketPaymentMethodLabel, ticketStatusLabel, ticketStatusColor } from "@/lib/constants/events";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TicketQrCode } from "@/components/tickets/ticket-qr-code";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

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

export type MyTicketRow = {
  id: string;
  eventName: string;
  eventStartsAt: string;
  paymentMethod: string;
  status: string;
  price: number;
  canCancel: boolean;
};

export function MyTicketsSection({ tickets }: { tickets: MyTicketRow[] }) {
  const t = useTranslations("profile");
  const locale = useLocale();
  const router = useRouter();
  const [cancelTarget, setCancelTarget] = useState<MyTicketRow | null>(null);
  const [loading, setLoading] = useState(false);

  if (tickets.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noTickets")}</p>;
  }

  return (
    <div className="space-y-4">
      {tickets.map((ticket) => (
        <div key={ticket.id} className="rounded-md border p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{ticket.eventName}</p>
              <p className="text-sm text-muted-foreground">{formatDateTime(ticket.eventStartsAt)}</p>
              <p className="text-xs text-muted-foreground">
                {ticketPaymentMethodLabel[ticket.paymentMethod as "sepa" | "onsite"] ?? ticket.paymentMethod}
              </p>
            </div>
            <Badge style={{ backgroundColor: ticketStatusColor(ticket.status) }} className="text-white">
              {ticketStatusLabel(ticket.status)}
            </Badge>
          </div>

          {(ticket.status === "reserved" || ticket.status === "confirmed") && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <TicketQrCode ticketId={ticket.id} />
              <p className="text-xs text-muted-foreground">{t("showAtEntrance")}</p>
            </div>
          )}

          {ticket.canCancel && (
            <Button variant="outline" size="sm" onClick={() => setCancelTarget(ticket)}>
              {t("cancelTicket")}
            </Button>
          )}
        </div>
      ))}

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cancelTicketTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              Dein Ticket für „{cancelTarget?.eventName}&rdquo; wird storniert und der Platz wieder freigegeben.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={async () => {
                if (!cancelTarget) return;
                setLoading(true);
                try {
                  const result = await cancelTicket(cancelTarget.id);
                  if ("error" in result) {
                    toast.error(result.error);
                  } else {
                    toast.success(t("ticketCancelled"));
                    router.refresh();
                  }
                } finally {
                  setLoading(false);
                  setCancelTarget(null);
                }
              }}
            >
              {t("cancelBooking")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
