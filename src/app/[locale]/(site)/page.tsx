import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/auth/viewer";
import { levelOptions } from "@/lib/constants/levels";

/**
 * Die Startseite (Designüberarbeitung 2026-08).
 *
 * Vorher stand hier ein zentrierter Titel mit drei Knöpfen auf weißer Fläche —
 * 800 Pixel Leere darunter. Ein Tanzstudio empfängt niemanden mit einer
 * leeren Seite.
 *
 * Bildsprache und Aufbau kommen von der Marketing-Website: ein
 * randabfallendes Bild, eine Überschrift aus dünnem und fettem Teil, ein
 * Geisterknopf darauf. So sieht die App aus wie dasselbe Studio.
 */
export default async function Home() {
  const t = await getTranslations("home");
  const user = await getViewer();

  return (
    <div className="space-y-20 pb-20">
      {/* Hero */}
      <section className="relative isolate min-h-[78vh] overflow-hidden">
        <Image
          src="/media/hero-piran.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Gerichtet statt flächig: Eine gleichmäßige Abdunklung macht aus
            einem Abendlicht-Foto eine graue Fläche. Dunkel wird nur die linke
            Seite, wo die Schrift steht — rechts bleiben Tänzer und Licht. */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b1020]/85 via-[#0b1020]/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0b1020]/70 to-transparent" />

        <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-end px-4 pb-16 pt-24 text-white">
          <p className="nav-label mb-4 text-white/80">{t("heroKicker")}</p>
          <h1 className="font-heading text-[clamp(2.5rem,7vw,5rem)] font-extrabold leading-[0.95] tracking-[-1px]">
            <span className="font-light">{t("heroTitleThin")}</span>
            <br />
            {t("heroTitleBold")}
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/85">{t("heroLead")}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-full px-8">
              <Link href="/kurse">{t("heroPrimary")}</Link>
            </Button>
            {/* Geisterknopf wie auf der Website: Umriss auf dem Bild, keine
                zweite Farbfläche neben dem roten. */}
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-white/60 bg-white/10 px-8 text-white backdrop-blur-sm hover:bg-white hover:text-[#0b1020]"
            >
              <Link href="/stundenplan">{t("heroSecondary")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Einstieg über die Stufe — die Farben sind dieselben wie auf den
          Kurskarten, damit die Zuordnung ohne Erklärung sitzt. */}
      <section className="mx-auto max-w-6xl px-4">
        <h2 className="font-heading text-3xl font-bold tracking-[-0.5px]">{t("levelsTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("levelsLead")}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {levelOptions.map((stufe) => (
            <Link
              key={stufe.value}
              href={{ pathname: "/kurse", query: { level: stufe.value } }}
              className="group rounded-card border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg"
            >
              <span
                className="mb-4 block h-1.5 w-12 rounded-full transition-all duration-300 group-hover:w-20"
                style={{ backgroundColor: stufe.color }}
              />
              <p className="font-heading text-xl font-bold">{stufe.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  stufe.value === "beginner"
                    ? "levelBeginnerHint"
                    : stufe.value === "improver"
                      ? "levelImproverHint"
                      : stufe.value === "intermediate"
                        ? "levelIntermediateHint"
                        : stufe.value === "advanced"
                          ? "levelAdvancedHint"
                          : "levelOpenHint"
                )}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Der Zugang zum eigenen Konto — für Angemeldete führt er ins Profil,
          nicht auf einen Login, den sie nicht mehr brauchen. */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="overflow-hidden rounded-card border bg-card shadow-soft md:grid md:grid-cols-2">
          <div className="p-8 md:p-12">
            <h2 className="font-heading text-3xl font-bold tracking-[-0.5px]">{t("memberTitle")}</h2>
            <p className="mt-3 text-muted-foreground">{t("memberLead")}</p>
            <Button asChild className="mt-6 rounded-full px-8">
              <Link href={user ? "/profil" : "/login"}>{user ? t("profileCta") : t("memberCta")}</Link>
            </Button>
          </div>
          <div className="relative min-h-[220px]">
            <Image
              src="/media/lehrer.webp"
              alt=""
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
