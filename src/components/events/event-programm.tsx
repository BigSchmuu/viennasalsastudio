import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/pricing";
import {
  artZustand,
  einheitenFuerArt,
  freiePlaetzeEinheit,
  istKostenlos,
  restKontingent,
  type Einheit,
  type Ticketart,
} from "@/lib/events/tickets";

/**
 * Programm und Ticketarten eines Events (PROJ-56).
 *
 * Zwei Abschnitte, die nur erscheinen, wenn es sie gibt: Das Programm zeigt
 * die Einheiten nach Zeit, die Ticketliste, was es kostet und was dafür
 * enthalten ist. Ein Event mit einer einzigen Ticketart und ohne Einheiten
 * sieht aus wie vor PROJ-56 — dann steht der Preis weiterhin allein beim Knopf.
 */

export function EventProgramm({ einheiten }: { einheiten: Einheit[] }) {
  const t = useTranslations("events");
  const format = useFormatter();
  if (einheiten.length === 0) return null;

  return (
    <section className="mt-8 border-t border-border/60 pt-6">
      <h2 className="font-heading text-lg font-bold tracking-[-0.5px]">{t("programHeading")}</h2>
      <ul className="mt-3 divide-y divide-border/60">
        {einheiten.map((einheit) => {
          const frei = freiePlaetzeEinheit(einheit);
          return (
            <li key={einheit.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{einheit.titel}</p>
                <p className="text-xs text-muted-foreground">
                  {format.dateTime(new Date(einheit.startsAt), {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {einheit.endsAt
                    ? ` – ${format.dateTime(new Date(einheit.endsAt), { hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                </p>
              </div>
              {frei === null ? null : frei === 0 ? (
                <Badge variant="destructive">{t("soldOut")}</Badge>
              ) : (
                <span className="text-xs text-muted-foreground">{t("spotsLeft", { count: frei })}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function EventTicketarten({ arten, einheiten }: { arten: Ticketart[]; einheiten: Einheit[] }) {
  const t = useTranslations("events");
  const locale = useLocale();

  // Bei genau einer Art, die für alles gilt, sagt die Liste nichts, was nicht
  // ohnehin am Kaufknopf steht.
  const sichtbar = arten.filter((art) => art.imVerkauf || art.verkauft > 0);
  if (sichtbar.length <= 1 && einheiten.length === 0) return null;

  return (
    <section className="mt-8 border-t border-border/60 pt-6">
      <h2 className="font-heading text-lg font-bold tracking-[-0.5px]">{t("ticketsHeading")}</h2>
      <ul className="mt-3 divide-y divide-border/60">
        {sichtbar.map((art) => {
          const zustand = artZustand(art, einheiten);
          const rest = restKontingent(art);
          const gilt =
            art.geltung === "all"
              ? t("includedAll")
              : art.geltung === "choice"
                ? t("includedChoice")
                : t("includedList", {
                    units: einheitenFuerArt(art, einheiten)
                      .map((einheit) => einheit.titel)
                      .join(", "),
                  });

          return (
            <li key={art.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{art.name}</p>
                <p className="text-xs text-muted-foreground">{gilt}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {istKostenlos(art) ? t("free") : formatPrice(art.preisNormal, locale)}
                  {!istKostenlos(art) && art.preisStudierend !== art.preisNormal ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {t("studentPriceLabel", { price: formatPrice(art.preisStudierend, locale) })}
                    </span>
                  ) : null}
                </p>
                {zustand === "ausverkauft" ? (
                  <Badge variant="destructive" className="mt-1">
                    {t("soldOut")}
                  </Badge>
                ) : zustand === "nichtImVerkauf" ? (
                  <Badge variant="secondary" className="mt-1">
                    {t("notOnSale")}
                  </Badge>
                ) : rest !== null ? (
                  <p className="text-xs text-muted-foreground">{t("quotaLeft", { count: rest })}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
