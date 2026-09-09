import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import type { Termin, OffenerTermin, Geburtstag } from "@/lib/teacher/uebersicht";

export type Probestunde = {
  id: string;
  name: string;
  kursName: string;
  datum: string;
};

/**
 * Der Lehrer-Bereich unter „Mein Bereich" (PROJ-49).
 *
 * Rechnet nichts aus — die Seite reicht fertige Listen herein. So bleibt die
 * Rechenarbeit in `lib/teacher/uebersicht.ts` einzeln prüfbar, und diese Datei
 * beantwortet nur noch die Frage, wie es aussieht.
 *
 * Jeder Abschnitt verschwindet, wenn er nichts zu sagen hat — die Regel des
 * Kunden-Dashboards, hier übernommen. Ein Lehrer ohne anstehende Probestunde
 * soll keine leere Überschrift sehen.
 */
export async function LehrerUebersicht({
  termine,
  probestunden,
  geburtstage,
  offeneAnwesenheit,
  wochentagNamen,
}: {
  termine: Termin[];
  probestunden: Probestunde[];
  geburtstage: Geburtstag[];
  offeneAnwesenheit: OffenerTermin[];
  /** 0 = Montag … 6 = Sonntag, bereits übersetzt und in Wiener Zeit ermittelt. */
  wochentagNamen: Record<string, string>;
}) {
  const t = await getTranslations("teacherArea");

  return (
    <div className="space-y-8">
      <DashboardSection title={t("upcoming")} description={t("upcomingHint")}>
        {termine.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noUpcoming")}</p>
        ) : (
          <div className="space-y-3">
            {termine.map((termin) => (
              <Card key={`${termin.kursId}-${termin.datum}`}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="font-medium">{termin.kursName}</p>
                    <p className="text-sm text-muted-foreground">
                      {wochentagNamen[termin.datum]}
                      {termin.startZeit ? ` · ${termin.startZeit.slice(0, 5)}` : ""}
                      {termin.ort ? ` · ${termin.ort}` : ""}
                    </p>
                  </div>

                  {termin.rollen && (
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{t("leaders", { n: termin.rollen.leader })}</Badge>
                      <Badge variant="secondary">
                        {t("followers", { n: termin.rollen.follower })}
                      </Badge>
                      {termin.rollen.beides > 0 && (
                        <Badge variant="secondary">{t("both", { n: termin.rollen.beides })}</Badge>
                      )}
                    </div>
                  )}

                  {termin.letzteNotiz && (
                    <p className="border-l-2 pl-3 text-sm text-muted-foreground">
                      <span className="font-medium">{t("lastNote")} </span>
                      {termin.letzteNotiz}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/lehrer/${termin.kursId}`}>{t("attendance")}</Link>
                    </Button>
                    {termin.hatVideosatz && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/lehrer/${termin.kursId}`}>{t("material")}</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DashboardSection>

      {probestunden.length > 0 && (
        <DashboardSection title={t("trials")} description={t("trialsHint")}>
          <ul className="space-y-2 text-sm">
            {probestunden.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-x-3">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">
                  {p.kursName} · {wochentagNamen[p.datum] ?? p.datum}
                </span>
              </li>
            ))}
          </ul>
        </DashboardSection>
      )}

      {geburtstage.length > 0 && (
        <DashboardSection title={t("birthdays")} description={t("birthdaysHint")}>
          <ul className="space-y-2 text-sm">
            {geburtstage.map((g) => (
              <li key={g.id} className="flex flex-wrap justify-between gap-x-3">
                <span className="font-medium">{g.name}</span>
                {/* Nur Tag und Monat — das Geburtsjahr geht niemanden etwas an
                    (dieselbe Zurückhaltung wie in PROJ-31). */}
                <span className="text-muted-foreground">{g.datum.slice(8, 10)}.{g.datum.slice(5, 7)}.</span>
              </li>
            ))}
          </ul>
        </DashboardSection>
      )}

      {offeneAnwesenheit.length > 0 && (
        <DashboardSection title={t("missingAttendance")} description={t("missingAttendanceHint")}>
          <ul className="space-y-2 text-sm">
            {offeneAnwesenheit.map((o) => (
              <li key={`${o.kursId}-${o.datum}`} className="flex flex-wrap justify-between gap-x-3">
                <Link href={`/lehrer/${o.kursId}`} className="font-medium underline underline-offset-4">
                  {o.kursName}
                </Link>
                <span className="text-muted-foreground">{wochentagNamen[o.datum] ?? o.datum}</span>
              </li>
            ))}
          </ul>
        </DashboardSection>
      )}
    </div>
  );
}
