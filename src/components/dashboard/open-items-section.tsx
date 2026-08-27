import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardSection } from "./dashboard-section";

export type OffenerPunkt =
  | { art: "mandat" }
  | { art: "buchung"; kursName: string }
  | { art: "warteliste"; kursName: string };

/**
 * „Zu erledigen".
 *
 * Der Abschnitt verschwindet vollständig, wenn nichts anliegt — kein Kästchen
 * mit „alles erledigt". Am Telefon ist Platz das knappste Gut.
 *
 * Die Reihenfolge ist nicht die Eingabereihenfolge: das fehlende Mandat steht
 * immer oben, weil es das Einzige ist, das den Kunden wirklich blockiert.
 */
export async function OpenItemsSection({ punkte }: { punkte: OffenerPunkt[] }) {
  if (punkte.length === 0) return null;

  const t = await getTranslations("dashboard.openItems");
  const rang = { mandat: 0, buchung: 1, warteliste: 2 } as const;
  const sortiert = [...punkte].sort((a, b) => rang[a.art] - rang[b.art]);

  return (
    <DashboardSection title={t("heading")}>
      <ul className="space-y-2">
        {sortiert.map((punkt, i) => {
          const inhalt =
            punkt.art === "mandat"
              ? { titel: t("mandateTitle"), text: t("mandateBody"), cta: t("mandateCta"), ziel: "/profil#zahlungsweise" }
              : punkt.art === "buchung"
                ? {
                    titel: t("bookingTitle"),
                    text: t("bookingBody", { course: punkt.kursName }),
                    cta: t("bookingCta"),
                    ziel: "/profil#buchungen",
                  }
                : {
                    titel: t("waitlistTitle"),
                    text: t("waitlistBody", { course: punkt.kursName }),
                    cta: t("waitlistCta"),
                    ziel: "/profil#warteliste",
                  };

          return (
            <li key={`${punkt.art}-${i}`}>
              <Card
                className={
                  punkt.art === "mandat"
                    ? "border-primary/30 bg-primary/[0.04]"
                    : "border-border/60"
                }
              >
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{inhalt.titel}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{inhalt.text}</p>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant={punkt.art === "mandat" ? "default" : "outline"}
                    className="shrink-0"
                  >
                    <Link href={inhalt.ziel}>{inhalt.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </DashboardSection>
  );
}
