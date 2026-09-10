"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { kursAusFlatrateEntfernen, kursZuFlatrateHinzufuegen } from "@/lib/actions/flatrate";

export type FlatrateKurs = {
  kursId: string;
  name: string;
  /** „Donnerstag · 19:00", bereits übersetzt und zusammengesetzt. */
  termin: string | null;
  tanzrolle: string | null;
};

/**
 * Die Kurse einer laufenden Flatrate (PROJ-50).
 *
 * Steht im Profil beim Abo, nicht im Katalog: Hinzufügen passiert dort, wo man
 * Kurse entdeckt — der Überblick über das eigene Abo gehört hierher.
 *
 * Der zweite Block sind die Kurse aus der Zeit vor einer Pause. Pausieren
 * beendet die Kursplätze, sonst käme jemand nach vier Wochen in einen Kurs
 * zurück, der inzwischen voll ist. Damit er sie danach nicht aus dem Gedächtnis
 * rekonstruieren muss, stehen sie hier — ein Klick je Kurs, sofern noch Platz
 * ist.
 */
export function FlatrateCourses({
  kurse,
  frueher,
}: {
  kurse: FlatrateKurs[];
  frueher: FlatrateKurs[];
}) {
  const t = useTranslations("flatrate");
  const tb = useTranslations("booking");
  const [zuEntfernen, setZuEntfernen] = useState<FlatrateKurs | null>(null);
  const [laeuft, starte] = useTransition();

  function entfernen(kurs: FlatrateKurs) {
    starte(async () => {
      const ergebnis = await kursAusFlatrateEntfernen(kurs.kursId);
      setZuEntfernen(null);
      if ("ok" in ergebnis) {
        toast.success(t("removed"));
        return;
      }
      toast.error("error" in ergebnis ? ergebnis.error : t("removed"));
    });
  }

  function wiederAufnehmen(kurs: FlatrateKurs) {
    starte(async () => {
      const ergebnis = await kursZuFlatrateHinzufuegen(kurs.kursId, kurs.tanzrolle, true);
      if ("ok" in ergebnis) {
        toast.success(t("added"));
        return;
      }
      if ("full" in ergebnis) {
        toast.error(t("noRoom"));
        return;
      }
      toast.error("error" in ergebnis ? ergebnis.error : t("noRoom"));
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div>
          <p className="font-medium">{t("myCourses")}</p>
          <p className="text-sm text-muted-foreground">{t("myCoursesHint")}</p>
        </div>

        {kurse.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm">
            <p className="text-muted-foreground">{t("noCourses")}</p>
            <Button variant="link" className="px-0" asChild>
              <Link href="/kurse">{t("noCoursesAction")}</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {kurse.map((k) => (
              <li key={k.kursId} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <Link href={`/kurse/${k.kursId}`} className="font-medium underline-offset-4 hover:underline">
                    {k.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {k.termin ?? "—"}
                    {k.tanzrolle ? ` · ${tb(`danceRoles.${k.tanzrolle}`)}` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZuEntfernen(k)}
                  disabled={laeuft}
                >
                  {t("remove")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {frueher.length > 0 && (
        <div className="space-y-2">
          <div>
            <p className="font-medium">{t("earlier")}</p>
            <p className="text-sm text-muted-foreground">{t("earlierHint")}</p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {frueher.map((k) => (
              <li key={k.kursId}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => wiederAufnehmen(k)}
                  disabled={laeuft}
                >
                  {k.name}
                  {k.tanzrolle && (
                    <Badge variant="secondary" className="ml-2">
                      {tb(`danceRoles.${k.tanzrolle}`)}
                    </Badge>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AlertDialog open={zuEntfernen !== null} onOpenChange={(o) => !o && setZuEntfernen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("removeConfirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={laeuft}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => zuEntfernen && entfernen(zuEntfernen)}
              disabled={laeuft}
            >
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
