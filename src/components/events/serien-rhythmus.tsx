import { useTranslations } from "next-intl";
import { uhrzeitKurz } from "@/lib/events/serie";

/**
 * Der Rhythmus einer Serie in Worten: „Jeden Freitag, 21:00–02:00" (PROJ-54).
 *
 * Eigener Baustein, weil derselbe Satz auf der Karte und auf der Serienseite
 * steht — und auf Englisch anders gebaut ist als auf Deutsch.
 */
export function SerienRhythmus({
  weekday,
  startTime,
  endTime,
}: {
  weekday: number;
  startTime: string;
  endTime: string | null;
}) {
  const t = useTranslations("events");
  const wochentag = useTranslations("weekdays");
  const tag = wochentag(String(weekday));

  return (
    <>
      {endTime
        ? t("rhythmWeekly", { day: tag, from: uhrzeitKurz(startTime), to: uhrzeitKurz(endTime) })
        : t("rhythmWeeklyOpen", { day: tag, from: uhrzeitKurz(startTime) })}
    </>
  );
}
