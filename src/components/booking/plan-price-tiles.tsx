"use client";

import { useLocale } from "next-intl";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { desiredPlanOptions, type DesiredPlan } from "@/lib/constants/booking";
import { planPrice, formatPrice, type StudioPricing } from "@/lib/pricing";
import { cn } from "@/lib/utils";

const planDescriptions: Record<DesiredPlan, string> = {
  single_course: "Dieser eine Kurs, wöchentlich",
  flatrate: "Alle Kurse, so oft du willst",
};

/**
 * Die Abo-Auswahl im Buchungsdialog (PROJ-41).
 *
 * Zwei Angebote nebeneinander laden zum Vergleich ein — eine Liste mit
 * Auswahlknöpfen stellt nur die Frage „welches?", ohne bei der Antwort zu
 * helfen. Darunter liegt weiterhin eine RadioGroup: sie bringt Pfeiltasten-
 * Navigation und einen einzigen Tab-Stopp mit, was eine Sammlung anklickbarer
 * Kacheln erst mühsam nachbauen müsste.
 */
export function PlanPriceTiles({
  pricing,
  coursePrice,
  student,
  value,
  onChange,
}: {
  pricing: StudioPricing;
  /** Eigener Preis dieses Kurses; `null` heißt „Standardpreis gilt". */
  coursePrice: number | null;
  student: boolean;
  value: DesiredPlan | "";
  onChange: (plan: DesiredPlan) => void;
}) {
  const locale = useLocale();

  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as DesiredPlan)}
      className="grid gap-3 sm:grid-cols-2"
    >
      {desiredPlanOptions.map((option) => {
        const price = planPrice(pricing, option.value, { coursePrice, student });
        const selected = value === option.value;
        return (
          <Label
            key={option.value}
            htmlFor={`plan-${option.value}`}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-lg border p-4 transition-colors",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2",
              selected ? "border-primary bg-primary/5" : "hover:border-primary/40"
            )}
          >
            <RadioGroupItem value={option.value} id={`plan-${option.value}`} className="sr-only" />
            <span className="text-sm font-medium">{option.label}</span>
            {price === null ? (
              // Eine „0,00 €"-Kachel wäre eine Preisaussage, die niemand
              // getroffen hat. Buchen bleibt möglich — den Betrag setzt der
              // Betreiber beim Bestätigen.
              <span className="text-sm text-muted-foreground">Preis auf Anfrage</span>
            ) : (
              <span className="text-lg font-semibold tabular-nums">
                {formatPrice(price, locale)}
                <span className="text-sm font-normal text-muted-foreground"> / Monat</span>
              </span>
            )}
            <span className="text-xs text-muted-foreground">{planDescriptions[option.value]}</span>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
