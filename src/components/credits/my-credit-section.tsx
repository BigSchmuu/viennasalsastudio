"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatPrice } from "@/lib/pricing";
import { formatDate } from "@/lib/formatting";

export type MyCreditEntry = {
  id: string;
  amount: number;
  origin: "referral" | "manual" | "redeemed";
  reason: string | null;
  createdAt: string;
};

/**
 * Das eigene Guthaben im Profil (PROJ-44).
 *
 * Zeigt den Verlauf mit, nicht nur den Stand: Wer 30 € gutgeschrieben bekommt,
 * will wissen wofür — und wer sieht, dass etwas abgezogen wurde, erst recht.
 *
 * Der vom Betreiber eingetragene Grund erscheint hier unverändert. Er ist für
 * den Kunden geschrieben, nicht als interne Notiz.
 */
export function MyCreditSection({ balance, entries }: { balance: number; entries: MyCreditEntry[] }) {
  const t = useTranslations("credit");
  const locale = useLocale();

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("empty")}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-lg font-semibold tabular-nums">{formatPrice(balance, locale)}</p>
      <p className="text-sm text-muted-foreground">{t("offsetHint")}</p>

      <ul className="space-y-2 pt-1">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-start justify-between gap-3 rounded-md border p-3 text-sm">
            <div>
              <p>{entry.origin === "redeemed" ? t("originRedeemed") : entry.reason ?? t("originReferral")}</p>
              <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt, locale)}</p>
            </div>
            <span className="tabular-nums whitespace-nowrap">
              {entry.amount > 0 ? "+" : ""}
              {formatPrice(entry.amount, locale)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
