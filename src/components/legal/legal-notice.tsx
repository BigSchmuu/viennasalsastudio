import { getLocale, getTranslations } from "next-intl/server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";

/**
 * Der Hinweis über einem Rechtstext (PROJ-43).
 *
 * Erscheint nur in der englischen Fassung. Die deutsche Seite braucht ihn
 * nicht — sie *ist* die verbindliche.
 *
 * `variant="translation"` steht über einer Übersetzung, `variant="germanOnly"`
 * über einem deutschen Text, den es nur auf Deutsch gibt.
 */
export async function LegalNotice({ variant }: { variant: "translation" | "germanOnly" }) {
  const locale = await getLocale();
  if (locale === "de") return null;

  const t = await getTranslations("legal");
  return (
    <Alert>
      <AlertDescription>
        {variant === "translation" ? t("translationNotice") : t("germanOnly")}{" "}
        {/* Mit ausdrücklichem `locale`, nicht als schlichter Verweis auf /agb:
            eine Adresse ohne Präfix folgt der Sprachwahl des Lesers, ein
            englischer Kunde käme also wieder auf der englischen Seite heraus.
            Der Klick stellt seine Sprache damit auf Deutsch um — das ist die
            Absicht, und über den Umschalter jederzeit zurücknehmbar. */}
        <Link href="/agb" locale="de" className="underline">
          {t("readGerman")}
        </Link>
      </AlertDescription>
    </Alert>
  );
}
