"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { purchaseTicket } from "@/lib/actions/events";
import type { TicketPaymentMethod } from "@/lib/constants/events";
import { danceRoleOptions, type DanceRole } from "@/lib/constants/booking";
import { fehlertext } from "@/lib/auth/fehler";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/pricing";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { TermsConsent } from "@/components/booking/terms-consent";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  artZustand,
  istKostenlos,
  waehlbareEinheiten,
  zahlungsartenImDialog,
  type Einheit,
  type Ticketart,
  type Zahlungswahl,
} from "@/lib/events/tickets";

export type TicketPurchaseEvent = {
  id: string;
  name: string;
  /** Die Arten, die dieses Event verkauft — mindestens eine (PROJ-56). */
  ticketarten: Ticketart[];
  einheiten: Einheit[];
  zahlungswahl: Zahlungswahl;
  rolleAbfragen: boolean;
  stornofristTage: number;
};

/**
 * Der Ticketkauf (PROJ-14, erweitert in PROJ-56).
 *
 * Aus „ein Preis, eine Zahlungsart" ist eine Auswahl geworden: erst die
 * Ticketart, dann — wenn sie es vorsieht — die Einheit, dann die Tanzrolle.
 * Alles, was ein Event nicht braucht, erscheint nicht: Bei einer einzigen
 * Ticketart ohne Einheiten sieht der Kunde denselben Dialog wie bisher.
 */
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
  const format = useFormatter();

  const kaufbare = useMemo(
    () => event.ticketarten.filter((art) => artZustand(art, event.einheiten) === "kaufbar"),
    [event.ticketarten, event.einheiten]
  );

  const [artId, setArtId] = useState<string>(kaufbare[0]?.id ?? "");
  const art = kaufbare.find((a) => a.id === artId) ?? kaufbare[0] ?? null;

  const einheiten = useMemo(() => (art ? waehlbareEinheiten(art, event.einheiten) : []), [art, event.einheiten]);
  const [einheitId, setEinheitId] = useState<string>("");
  const [rolle, setRolle] = useState<DanceRole>("both");
  const [wantsStudentPrice, setWantsStudentPrice] = useState(false);

  const kostenlos = art ? istKostenlos(art) : false;
  const zahlungsarten = kostenlos ? [] : zahlungsartenImDialog(event.zahlungswahl, hasMandate);
  const [paymentMethod, setPaymentMethod] = useState<TicketPaymentMethod>(zahlungsarten[0] ?? "onsite");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // PROJ-42: Ein Ticketkauf ist ein Vertragsschluss wie eine Kursbuchung.
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Dieser Dialog bleibt gemountet, wenn er geschlossen wird — anders als der
  // Buchungsdialog. Ohne dieses Zurücksetzen wäre das Häkchen beim zweiten
  // Ticketkauf noch gesetzt, und eine vorausgehakte Zustimmung ist keine.
  useEffect(() => {
    if (!open) return;
    setTermsAccepted(false);
    setError(null);
    setArtId(kaufbare[0]?.id ?? "");
    setEinheitId("");
    setRolle("both");
  }, [open, kaufbare]);

  // Wechselt die Ticketart, passt die vorher gewählte Einheit oft nicht mehr.
  useEffect(() => {
    setEinheitId((bisher) => (einheiten.some((einheit) => einheit.id === bisher) ? bisher : ""));
  }, [einheiten]);

  useEffect(() => {
    setPaymentMethod((bisher) => (zahlungsarten.includes(bisher) ? bisher : (zahlungsarten[0] ?? "onsite")));
    // Die Liste ist bei jedem Rendern neu; ihr Inhalt entscheidet, nicht sie selbst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zahlungsarten.join(",")]);

  const preis = art ? (wantsStudentPrice ? art.preisStudierend : art.preisNormal) : 0;
  const brauchtEinheit = art?.geltung === "choice";
  const keineZahlungsart = !kostenlos && zahlungsarten.length === 0;
  const bereit = !!art && (!brauchtEinheit || einheitId !== "") && !keineZahlungsart && termsAccepted;

  async function handleSubmit() {
    if (!art) return;
    setLoading(true);
    setError(null);
    try {
      const result = await purchaseTicket(event.id, paymentMethod, wantsStudentPrice, termsAccepted, {
        ticketTypeId: art.id,
        unitId: brauchtEinheit ? einheitId : null,
        danceRole: event.rolleAbfragen ? rolle : null,
      });

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

      toast.success(result.ticket.status === "confirmed" ? t("confirmed") : t("reserved"));
      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function einheitZeit(einheit: Einheit): string {
    return format.dateTime(new Date(einheit.startsAt), {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event.name}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {/* Bei genau einer Ticketart gibt es nichts zu wählen — dann bleibt
              der Dialog so schlank wie vor PROJ-56. */}
          {kaufbare.length > 1 ? (
            <div className="space-y-2">
              <Label>{t("chooseTicketType")}</Label>
              <RadioGroup value={artId} onValueChange={setArtId} className="gap-2">
                {kaufbare.map((wahl) => (
                  <div key={wahl.id} className="flex items-start gap-2">
                    <RadioGroupItem value={wahl.id} id={`art-${wahl.id}`} className="mt-1" />
                    <Label htmlFor={`art-${wahl.id}`} className="font-normal leading-snug">
                      {wahl.name}
                      <span className="block text-xs text-muted-foreground">
                        {istKostenlos(wahl) ? t("free") : formatPrice(wahl.preisNormal, locale)}
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ) : null}

          {brauchtEinheit ? (
            <div className="space-y-2">
              <Label>{t("chooseUnit")}</Label>
              <RadioGroup value={einheitId} onValueChange={setEinheitId} className="gap-2">
                {einheiten.map((einheit) => (
                  <div key={einheit.id} className="flex items-start gap-2">
                    <RadioGroupItem value={einheit.id} id={`einheit-${einheit.id}`} className="mt-1" />
                    <Label htmlFor={`einheit-${einheit.id}`} className="font-normal leading-snug">
                      {einheit.titel}
                      <span className="block text-xs text-muted-foreground">{einheitZeit(einheit)}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ) : null}

          {event.rolleAbfragen ? (
            <div className="space-y-2">
              <Label>{t("chooseRole")}</Label>
              <RadioGroup value={rolle} onValueChange={(wert) => setRolle(wert as DanceRole)} className="gap-2">
                {danceRoleOptions.map((wahl) => (
                  <div key={wahl.value} className="flex items-center gap-2">
                    <RadioGroupItem value={wahl.value} id={`rolle-${wahl.value}`} />
                    <Label htmlFor={`rolle-${wahl.value}`} className="font-normal">
                      {wahl.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          ) : null}

          {kostenlos ? null : (
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
          )}

          <p className="text-lg font-semibold">{kostenlos ? t("free") : formatPrice(preis, locale)}</p>

          {kostenlos ? null : (
            <div className="space-y-2">
              <Label>{t("paymentMethod")}</Label>
              {keineZahlungsart ? (
                <Alert>
                  <AlertDescription>
                    {t("noMandate")}{" "}
                    <Link href="/profil#zahlungsmethode" className="underline">
                      {t("addMandate")}
                    </Link>
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* Der Hinweis nur dann, wenn bar überhaupt eine Wahl ist —
                      sonst führte er ins Leere. */}
                  {!hasMandate && zahlungsarten.includes("onsite") && event.zahlungswahl === "both" ? (
                    <Alert>
                      <AlertDescription>
                        {t("noMandate")}{" "}
                        <Link href="/profil#zahlungsmethode" className="underline">
                          {t("addMandate")}
                        </Link>{" "}
                        {t("orPayOnSite")}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(v) => setPaymentMethod(v as TicketPaymentMethod)}
                  >
                    {zahlungsarten.map((wahl) => (
                      <div key={wahl} className="flex items-center gap-2">
                        <RadioGroupItem value={wahl} id={`payment-${wahl}`} />
                        <Label htmlFor={`payment-${wahl}`} className="font-normal">
                          {wahl === "sepa" ? `${t("paymentSepa")} — ${t("sepaInstant")}` : t("paymentOnsite")}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </>
              )}
            </div>
          )}

          {!stornierbar ? (
            <Alert>
              <AlertDescription>{t("noCancellation")}</AlertDescription>
            </Alert>
          ) : (
            <p className="text-xs text-muted-foreground">
              {event.stornofristTage === 0
                ? t("cancelUntilSameDay")
                : t("cancelUntil", { days: event.stornofristTage })}
            </p>
          )}
        </div>

        <TermsConsent checked={termsAccepted} onCheckedChange={setTermsAccepted} id="terms-accepted-ticket" />

        <DialogFooter>
          <Button disabled={loading || !bereit} onClick={handleSubmit}>
            {loading ? t("buying") : t("buyTicket")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
