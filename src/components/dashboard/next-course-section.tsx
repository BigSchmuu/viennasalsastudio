import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SelfCheckinButton } from "@/components/schedule/self-checkin-button";
import { DashboardSection } from "./dashboard-section";
import type { Kurstermin } from "@/lib/dashboard/naechster-termin";

export type CheckinAngebot = {
  opensAtIso: string;
  endsAtIso: string;
  checkedIn: boolean;
  /** Fenster noch zu — dann steht statt des Knopfes der Hinweis, ab wann. */
  nochGeschlossen: boolean;
  oeffnetUm: string;
};

/**
 * Wie der Tag benannt wird. Die Entscheidung faellt auf der Seite, nicht hier:
 * sie haengt an der Uhr, und eine Komponente, die beim Rendern auf die Uhr
 * schaut, liefert bei jedem Rendern etwas anderes.
 */
export type Tageszustand = "laeuft" | "heute" | "morgen" | "spaeter";

export type TerminAnzeige = {
  termin: Kurstermin;
  zustand: Tageszustand;
  /** 0 = Montag .. 6 = Sonntag, bereits in Wiener Zeit ermittelt. */
  wochentag: number;
  checkin: CheckinAngebot | null;
  buchungsArt: "trial" | "dropin" | null;
};

export type DanachAnzeige = {
  kursName: string;
  wochentag: number;
  startZeit: string;
};

function uhrzeit(zeit: string): string {
  return zeit.slice(0, 5);
}

/**
 * „Dein nächster Kurs".
 *
 * Zeigt genau einen Termin — oder zwei, wenn sie exakt gleichzeitig beginnen;
 * dann wäre es Willkür, einen davon zu unterschlagen. Der übernächste steht
 * als Zeile darunter, damit der zweite Kurs nicht verlorengeht.
 */
export async function NextCourseSection({
  anzeigen,
  danach,
}: {
  anzeigen: TerminAnzeige[];
  danach: DanachAnzeige | null;
}) {
  if (anzeigen.length === 0) return null;

  const [t, tw] = await Promise.all([
    getTranslations("dashboard.nextCourse"),
    getTranslations("weekdays"),
  ]);

  function tagesLabel(zustand: Tageszustand, wochentag: number): string {
    if (zustand === "laeuft") return t("running");
    if (zustand === "heute") return t("today");
    if (zustand === "morgen") return t("tomorrow");
    return tw(String(wochentag));
  }

  function ort(raum: string | null, standort: string | null): string {
    if (raum && standort) return t("place", { room: raum, location: standort });
    if (raum) return t("roomOnly", { room: raum });
    return t("noPlace");
  }

  return (
    <DashboardSection title={t("heading")}>
      <div className="space-y-3">
        {anzeigen.map(({ termin, zustand, wochentag, checkin, buchungsArt }) => (
          <Card key={`${termin.kursId}-${termin.datum}`} className="border-primary/25 bg-primary/[0.03]">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.8px] text-primary">
                  {tagesLabel(zustand, wochentag)}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {uhrzeit(termin.startZeit)}–{uhrzeit(termin.endZeit)}
                </span>
                {buchungsArt ? (
                  <Badge variant="secondary" className="text-[11px]">
                    {buchungsArt === "trial" ? t("trialBadge") : t("dropinBadge")}
                  </Badge>
                ) : null}
              </div>

              <p className="mt-2 font-heading text-xl font-bold tracking-[-0.5px]">{termin.kursName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{ort(termin.raum, termin.standort)}</p>

              {checkin ? (
                <div className="mt-4">
                  {checkin.nochGeschlossen ? (
                    <p className="text-center text-xs text-muted-foreground">
                      {t("checkinOpensAt", { time: checkin.oeffnetUm })}
                    </p>
                  ) : (
                    <SelfCheckinButton
                      courseId={termin.kursId}
                      opensAtIso={checkin.opensAtIso}
                      endsAtIso={checkin.endsAtIso}
                      initialCheckedIn={checkin.checkedIn}
                    />
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}

        {danach ? (
          <p className="text-sm text-muted-foreground">
            {t("after", {
              weekday: tw(String(danach.wochentag)),
              time: uhrzeit(danach.startZeit),
              course: danach.kursName,
            })}
          </p>
        ) : null}
      </div>
    </DashboardSection>
  );
}
