"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * „Guthaben & Empfehlung" — die kleine Fassung dessen, was im Profil
 * ausführlich steht. Hier nur der Stand und der Code; der Verlauf bleibt
 * im Profil.
 *
 * Der Hinweis, dass Guthaben nicht ausgezahlt wird, steht bewusst auch hier
 * und nicht nur in den AGB: er gehört dorthin, wo der Betrag steht.
 */
export function CreditReferralSection({
  guthaben,
  empfehlungscode,
  waehrungsformat,
}: {
  guthaben: number;
  empfehlungscode: string | null;
  waehrungsformat: string;
}) {
  const t = useTranslations("dashboard.credit");
  const [kopiert, setKopiert] = useState(false);

  if (guthaben <= 0 && !empfehlungscode) return null;

  async function kopieren() {
    if (!empfehlungscode) return;
    try {
      await navigator.clipboard.writeText(empfehlungscode);
      setKopiert(true);
      toast.success(t("copied"));
      window.setTimeout(() => setKopiert(false), 2000);
    } catch {
      // Ohne Zwischenablage-Recht bleibt der Code lesbar auf dem Schirm —
      // das ist kein Fehler, der eine Meldung verdient.
    }
  }

  return (
    <section>
      <h2 className="font-heading text-lg font-bold tracking-[-0.5px]">{t("heading")}</h2>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {guthaben > 0 ? (
          <Card className="border-border/60">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.8px] text-muted-foreground">
                {t("balanceLabel")}
              </p>
              <p className="mt-1 font-heading text-2xl font-bold tabular-nums">{waehrungsformat}</p>
              <p className="mt-2 text-xs text-muted-foreground">{t("offsetHint")}</p>
            </CardContent>
          </Card>
        ) : null}

        {empfehlungscode ? (
          <Card className="border-border/60">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.8px] text-muted-foreground">
                {t("referralLabel")}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1 font-mono text-sm font-semibold tracking-wider">
                  {empfehlungscode}
                </code>
                <Button size="sm" variant="outline" onClick={kopieren}>
                  {kopiert ? t("copied") : t("copy")}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("referralHint")}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
