import { useLocale, useTranslations } from "next-intl";
import { planPrice, formatPrice, type StudioPricing } from "@/lib/pricing";

/**
 * Der Monatspreis eines Kurses, sichtbar ohne Konto (PROJ-41 BUG-2).
 *
 * Der Buchungsdialog verlangt eine Anmeldung — wer sich aber erst überlegt, ob
 * er herkommt, soll vorher wissen, was es kostet. Preise sind keine
 * persönliche Information.
 *
 * Ist kein Preis gepflegt, erscheint nichts: eine Null wäre eine Preisaussage,
 * die niemand getroffen hat.
 */
export function CoursePriceLine({
  pricing,
  coursePrice,
  className,
}: {
  pricing: StudioPricing;
  coursePrice: number | null;
  className?: string;
}) {
  const t = useTranslations("courses");
  const locale = useLocale();
  const normal = planPrice(pricing, "single_course", { coursePrice });
  if (normal === null) return null;

  const student = planPrice(pricing, "single_course", { coursePrice, student: true });
  // Den ermäßigten Satz nur nennen, wenn er wirklich günstiger ist — sonst
  // stünde zweimal derselbe Betrag da.
  const showStudent = student !== null && student < normal;

  return (
    <p className={className}>
      <span className="font-semibold tabular-nums">{formatPrice(normal, locale)}</span>
      <span className="text-muted-foreground"> {t("perMonth")}</span>
      {showStudent && (
        <span className="text-muted-foreground"> · {t("reducedPrice", { price: formatPrice(student, locale) })}</span>
      )}
    </p>
  );
}
