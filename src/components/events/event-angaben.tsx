import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/pricing";
import type { EventZustand } from "@/lib/events/event-zustand";

/**
 * Preis und Verfügbarkeit eines Events — auf der Karte und auf der Eventseite
 * dieselben Sätze (PROJ-53).
 */

export function EventPreis({ priceNormal, priceStudent }: { priceNormal: number | null; priceStudent: number | null }) {
  const t = useTranslations("events");
  const locale = useLocale();

  // Bei „Nur anzeigen" darf der Preis fehlen — dann gibt es keine Preiszeile.
  if (priceNormal === null) return null;
  if (priceNormal === 0) return <p className="text-sm font-medium">{t("priceFree")}</p>;

  return (
    <p className="text-sm font-medium">
      {formatPrice(priceNormal, locale)}
      {priceStudent !== null && priceStudent !== priceNormal ? (
        <span className="text-muted-foreground">
          {" "}
          · {t("studentPriceLabel", { price: formatPrice(priceStudent, locale) })}
        </span>
      ) : null}
    </p>
  );
}

export function EventVerfuegbarkeit({ zustand, plaetze }: { zustand: EventZustand; plaetze: number | null }) {
  const t = useTranslations("events");

  switch (zustand) {
    case "kaufen":
      return plaetze === null ? null : (
        <p className="text-xs text-muted-foreground">{t("spotsLeft", { count: plaetze })}</p>
      );
    case "ausgebucht":
      return <Badge variant="destructive">{t("soldOut")}</Badge>;
    case "ticketVorhanden":
      return <Badge variant="secondary">{t("hasTicket")}</Badge>;
    case "nurAnzeigen":
      return <p className="text-sm text-muted-foreground">{t("onSite")}</p>;
    case "abgesagt":
      return <Badge variant="destructive">{t("cancelled")}</Badge>;
    case "vorbei":
      return <p className="text-sm text-muted-foreground">{t("past")}</p>;
  }
}
