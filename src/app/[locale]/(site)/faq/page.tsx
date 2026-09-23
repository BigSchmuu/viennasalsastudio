import { getLocale, getTranslations } from "next-intl/server";
import { FAQ, faqFlach } from "@/lib/faq/eintraege";

/**
 * Häufige Fragen (PROJ-66).
 *
 * Aufklappbar über `<details>`, nicht über ein Bedienelement mit JavaScript:
 * So steht jede Antwort im ausgelieferten Quelltext — für Suchmaschinen, für
 * die Suche im Browser (Strg+F findet auch zugeklappte Antworten) und für
 * alle, bei denen kein Skript läuft.
 */

export const metadata = {
  title: "FAQ",
};

export default async function FaqPage() {
  const locale = await getLocale();
  const sprache = locale === "en" ? "en" : "de";
  const t = await getTranslations("faq");

  // Die Auszeichnung für Suchmaschinen: Google zeigt damit Fragen und
  // Antworten direkt im Suchergebnis. Sie enthält genau dieselben Sätze wie
  // die Seite — alles andere wäre eine Angabe für Maschinen, die dem Menschen
  // nicht gezeigt wird.
  const strukturierteDaten = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqFlach(sprache).map(({ frage, antwort }) => ({
      "@type": "Question",
      name: frage,
      acceptedAnswer: { "@type": "Answer", text: antwort },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(strukturierteDaten) }}
      />

      <div>
        <h1 className="font-heading text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("intro")}</p>
      </div>

      {FAQ.map((gruppe) => (
        <section key={gruppe.titel.de} className="space-y-3">
          <h2 className="font-heading text-xl font-bold">{gruppe.titel[sprache]}</h2>
          <div className="divide-y rounded-card border">
            {gruppe.eintraege.map((eintrag) => (
              <details key={eintrag.frage.de} className="group px-4 py-3">
                <summary className="cursor-pointer list-none font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                  <span className="flex items-start justify-between gap-4">
                    {eintrag.frage[sprache]}
                    <span
                      aria-hidden
                      className="mt-1 shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {eintrag.antwort[sprache]}
                </p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
