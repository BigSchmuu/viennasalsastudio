"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { purchaseTicket } from "@/lib/actions/events";
import { ticketPaymentMethodLabel, type TicketPaymentMethod } from "@/lib/constants/events";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/pricing";
import { useLocale, useTranslations } from "next-intl";
import { TermsConsent } from "@/components/booking/terms-consent";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export type TicketPurchaseEvent = {
  id: string;
  name: string;
  priceNormal: number;
  priceStudent: number;
};

export function TicketPurchaseDialog({
  open,
  onOpenChange,
  event,
  hasMandate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: TicketPurchaseEvent;
  hasMandate: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("events");
  const locale = useLocale();
  const [wantsStudentPrice, setWantsStudentPrice] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<TicketPaymentMethod>(hasMandate ? "sepa" : "onsite");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const price = wantsStudentPrice ? event.priceStudent : event.priceNormal;

  // PROJ-42: Ein Ticketkauf ist ein Vertragsschluss wie eine Kursbuchung.
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Dieser Dialog bleibt gemountet, wenn er geschlossen wird — anders als der
  // Buchungsdialog. Ohne dieses Zurücksetzen wäre das Häkchen beim zweiten
  // Ticketkauf noch gesetzt, und eine vorausgehakte Zustimmung ist keine.
  useEffect(() => {
    if (open) setTermsAccepted(false);
  }, [open]);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const result = await purchaseTicket(event.id, paymentMethod, wantsStudentPrice, termsAccepted);

      if ("error" in result) {
        setError(result.error);
        return;
      }
      if ("needsMandate" in result) {
        setError(t("needsMandate"));
        return;
      }
      if ("full" in result) {
        setError(t("full"));
        router.refresh();
        return;
      }

      toast.success(
        result.ticket.status === "confirmed"
          ? t("confirmed")
          : t("reserved")
      );
      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{event.name}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="ticket-student-price"
              checked={wantsStudentPrice}
              onCheckedChange={(checked) => setWantsStudentPrice(checked === true)}
            />
            <Label htmlFor="ticket-student-price" className="font-normal">
              {t("studentPrice")}
            </Label>
          </div>

          <p className="text-lg font-semibold">{formatPrice(price, locale)}</p>

          <div className="space-y-2">
            <Label>{t("paymentMethod")}</Label>
            {!hasMandate && (
              <Alert>
                <AlertDescription>
                  Kein SEPA-Mandat hinterlegt.{" "}
                  <Link href="/profil" className="underline">
                    Jetzt hinterlegen
                  </Link>{" "}
                  oder vor Ort zahlen.
                </AlertDescription>
              </Alert>
            )}
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as TicketPaymentMethod)}>
              {hasMandate && (
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sepa" id="payment-sepa" />
                  <Label htmlFor="payment-sepa" className="font-normal">
                    {ticketPaymentMethodLabel.sepa} — sofort bestätigt
                  </Label>
                </div>
              )}
              <div className="flex items-center gap-2">
                <RadioGroupItem value="onsite" id="payment-onsite" />
                <Label htmlFor="payment-onsite" className="font-normal">
                  {ticketPaymentMethodLabel.onsite}
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <TermsConsent checked={termsAccepted} onCheckedChange={setTermsAccepted} id="terms-accepted-ticket" />

        <DialogFooter>
          <Button disabled={loading || !termsAccepted} onClick={handleSubmit}>
            {loading ? t("buying") : t("buyTicket")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
