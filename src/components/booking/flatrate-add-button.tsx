"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { danceRoleOptions, type DanceRole } from "@/lib/constants/booking";
import { kursZuFlatrateHinzufuegen } from "@/lib/actions/flatrate";

/**
 * „Zu meiner Flatrate hinzufügen" (PROJ-50).
 *
 * Ersetzt für Flatrate-Kunden den Buchungsdialog. Der große Dialog fragt
 * Zahlweise, Startdatum, Gutschein, Studierendenpreis und AGB ab — davon ist
 * hier nichts mehr offen: Es entsteht kein Vertrag, nur ein Kurs mehr im
 * bestehenden.
 *
 * Übrig bleiben die beiden Angaben, die zum **Kurs** gehören und nicht zur
 * Person: die Tanzrolle (jemand kann in Salsa Leader und in Bachata Follower
 * sein) und der Vorkenntnisse-Hinweis. Fragt der Kurs beides nicht ab, gibt es
 * gar keinen Dialog — dann ist der Klick der ganze Vorgang.
 */
export function FlatrateAddButton({
  kursId,
  fragtRolleAb,
  vorkenntnisseHinweis,
  istVoll,
  onWarteliste,
  className,
}: {
  kursId: string;
  fragtRolleAb: boolean;
  vorkenntnisseHinweis: string | null;
  istVoll: boolean;
  /** Bei vollem Kurs führt der Knopf zur Warteliste statt ins Leere. */
  onWarteliste?: () => void;
  className?: string;
}) {
  const t = useTranslations("flatrate");
  const tb = useTranslations("booking");
  const [offen, setOffen] = useState(false);
  const [rolle, setRolle] = useState<DanceRole | "">("");
  const [bestaetigt, setBestaetigt] = useState(false);
  const [laeuft, starte] = useTransition();

  const brauchtDialog = fragtRolleAb || !!vorkenntnisseHinweis;
  const unvollstaendig = (fragtRolleAb && !rolle) || (!!vorkenntnisseHinweis && !bestaetigt);

  function hinzufuegen(mitRolle: string, mitBestaetigung: boolean) {
    starte(async () => {
      const ergebnis = await kursZuFlatrateHinzufuegen(kursId, mitRolle, mitBestaetigung);
      if ("ok" in ergebnis) {
        setOffen(false);
        toast.success(t("added"));
        return;
      }
      if ("full" in ergebnis) {
        // Zwischen dem Laden der Seite und dem Klick kann der letzte Platz weg
        // sein. Statt einer Fehlermeldung der Weg, der jetzt noch offen steht.
        setOffen(false);
        toast.error(tb("courseFull"));
        onWarteliste?.();
        return;
      }
      if ("roleImbalance" in ergebnis) {
        toast.error(tb("errRole"));
        return;
      }
      toast.error(ergebnis.error);
    });
  }

  function klick() {
    if (istVoll) {
      onWarteliste?.();
      return;
    }
    if (brauchtDialog) {
      setOffen(true);
      return;
    }
    hinzufuegen("", false);
  }

  return (
    <>
      <Button className={className ?? "rounded-full"} onClick={klick} disabled={laeuft}>
        {t("addToFlatrate")}
      </Button>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("addDialogTitle")}</DialogTitle>
            <DialogDescription>{t("addDialogHint")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {fragtRolleAb && (
              <div className="space-y-2">
                <Label>{t("roleQuestion")}</Label>
                <RadioGroup value={rolle} onValueChange={(v) => setRolle(v as DanceRole)}>
                  {danceRoleOptions.map((option) => (
                    <div key={option.value} className="flex items-center gap-2">
                      <RadioGroupItem value={option.value} id={`fr-role-${option.value}`} />
                      <Label htmlFor={`fr-role-${option.value}`} className="font-normal">
                        {tb(`danceRoles.${option.value}`)}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {vorkenntnisseHinweis && (
              <div className="space-y-2">
                <Alert>
                  <AlertDescription>{vorkenntnisseHinweis}</AlertDescription>
                </Alert>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fr-prerequisite"
                    checked={bestaetigt}
                    onCheckedChange={(c) => setBestaetigt(c === true)}
                  />
                  <Label htmlFor="fr-prerequisite" className="font-normal">
                    {tb("prerequisiteConfirm")}
                  </Label>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOffen(false)} disabled={laeuft}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() => hinzufuegen(rolle, bestaetigt)}
              disabled={laeuft || unvollstaendig}
            >
              {t("add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
