"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { purchaseTicket } from "@/lib/actions/events";
import type { TicketPaymentMethod } from "@/lib/constants/events";
import { fehlertext } from "@/lib/auth/fehler";
import { Link } from "@/i18n/navigation";
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
  stornierbar = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: TicketPurchaseEvent;
  hasMandate: boolean;
  /** PROJ-53: Tickets sind bis zum Ende kaufbar — auch dann, wenn die Stornofrist schon vorbei ist. */
  stornierbar?: boolean;
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
        // Ein Schlüssel, in der Sprache der Seite angezeigt (PROJ-53, BUG-2).
        setError(fehlertext(t, result.error));
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
                  {t("noMandate")}{" "}
                  {/* Der Abschnitt heißt `zahlungsmethode`. Der alte Link ging
                      auf /profil ohne Anker und in die falsche Sprache. */}
                  <Link href="/profil#zahlungsmethode" className="underline">
                    {t("addMandate")}
                  </Link>{" "}
                  {t("orPayOnSite")}
                </AlertDescription>
              </Alert>
            )}
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as TicketPaymentMethod)}>
              {hasMandate && (
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sepa" id="payment-sepa" />
                  <Label htmlFor="payment-sepa" className="font-normal">
                    {t("paymentSepa")} — {t("sepaInstant")}
                  </Label>
                </div>
              )}
              <div className="flex items-center gap-2">
                <RadioGroupItem value="onsite" id="payment-onsite" />
                <Label htmlFor="payment-onsite" className="font-normal">
                  {t("paymentOnsite")}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {!stornierbar ? (
            <Alert>
              <AlertDescription>{t("noCancellation")}</AlertDescription>
            </Alert>
          ) : null}
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
