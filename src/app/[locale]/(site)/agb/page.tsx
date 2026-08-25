import { getLocale, getTranslations } from "next-intl/server";
import { formatAgbVersion, agbTranslationIsCurrent } from "@/lib/legal";
import { LegalNotice } from "@/components/legal/legal-notice";
import { TermsDe } from "@/components/legal/terms-de";
import { TermsEn } from "@/components/legal/terms-en";

export const metadata = {
  title: "AGB",
};

export default async function AgbPage() {
  const locale = await getLocale();
  const t = await getTranslations("legal");

  // Ist die Übersetzung nicht auf dem Stand der deutschen Fassung, erscheint
  // der deutsche Text — eine veraltete Übersetzung wäre ein falscher
  // Rechtstext in der Sprache des Lesers.
  const zeigeUebersetzung = locale === "en" && agbTranslationIsCurrent();

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-8 text-sm leading-relaxed">
      <div>
        <h1 className="font-heading text-3xl font-bold mb-2">{t("termsTitle")}</h1>
        <p className="text-muted-foreground">{t("asOf", { version: formatAgbVersion() })}</p>
      </div>

      <LegalNotice variant={zeigeUebersetzung ? "translation" : "germanOnly"} />

      {zeigeUebersetzung ? <TermsEn /> : <TermsDe />}
    </div>
  );
}
