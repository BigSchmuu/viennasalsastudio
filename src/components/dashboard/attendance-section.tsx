import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardSection } from "./dashboard-section";

/**
 * „Deine Anwesenheit".
 *
 * Bewusst nur die eigene Zahl, ohne Vergleich mit anderen Kunden und ohne
 * Kursaufschlüsselung. Wer noch nie da war, sieht den Abschnitt gar nicht —
 * eine Null wäre hier keine Information, sondern ein Vorwurf.
 */
export async function AttendanceSection({ anzahl }: { anzahl: number }) {
  if (anzahl <= 0) return null;

  const t = await getTranslations("dashboard.attendance");

  return (
    <DashboardSection title={t("heading")}>
      <Card className="border-border/60">
        <CardContent className="flex items-baseline gap-3 p-4">
          <span className="font-heading text-3xl font-bold tabular-nums text-primary">{anzahl}</span>
          <span className="text-sm text-muted-foreground">
            {anzahl === 1 ? t("countOne") : t("count")}
          </span>
        </CardContent>
      </Card>
    </DashboardSection>
  );
}
