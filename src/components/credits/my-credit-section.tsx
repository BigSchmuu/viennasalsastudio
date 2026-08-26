"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
 * Empfehlungscode und eigenes Guthaben im Profil (PROJ-44).
 *
 * Beides steht zusammen, weil es zusammengehört: Der Code ist der Weg, wie
 * Guthaben entsteht, und der Verlauf beantwortet, woher es kam. Wer 30 €
 * gutgeschrieben bekommt, will wissen wofür — und wer sieht, dass etwas
 * abgezogen wurde, erst recht.
 *
 * Der vom Betreiber eingetragene Grund erscheint hier unverändert. Er ist für
 * den Kunden geschrieben, nicht als interne Notiz.
 */
export function MyCreditSection({
  balance,
  entries,
  referralCode,
  rewardReferrer,
  rewardReferee,
}: {
  balance: number;
  entries: MyCreditEntry[];
  referralCode: string | null;
  rewardReferrer: number;
  rewardReferee: number;
}) {
  const t = useTranslations("credit");
  const locale = useLocale();
  const [kopiert, setKopiert] = useState(false);

  // Beide Beträge auf 0 heißt: das Programm ist aus. Dann ist der Code eine
  // Zahlenreihe ohne Zweck — ihn trotzdem anzuzeigen, würde ein Versprechen
  // machen, das niemand einlöst.
  const programmLaeuft = referralCode !== null && (rewardReferrer > 0 || rewardReferee > 0);

  async function kopieren() {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      // Ohne Zwischenablage-Erlaubnis bleibt der Code lesbar und markierbar —
      // der Knopf tut dann nichts, statt eine Fehlermeldung zu zeigen.
    }
  }

  return (
    <div className="space-y-5">
      {programmLaeuft && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("referralHeading")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md border bg-muted px-3 py-2 font-mono text-base tracking-wider">
              {referralCode}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={kopieren}>
              {kopiert ? t("copied") : t("copy")}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {rewardReferee > 0
              ? t("referralIntro", {
                  werber: formatPrice(rewardReferrer, locale),
                  geworbener: formatPrice(rewardReferee, locale),
                })
              : t("referralIntroOneSided", { werber: formatPrice(rewardReferrer, locale) })}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <p className="text-sm font-medium">{t("balanceHeading")}</p>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
