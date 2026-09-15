"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { bildBeschriftung, bildUrl, type EventBild } from "@/lib/events/medien";

/**
 * Die Galerie einer Eventseite (PROJ-55).
 *
 * Das Raster zeigt Vorschauen; wer eines antippt, sieht es groß und kann
 * blättern oder wischen. Die Großansicht ist bewusst kein Dialog-Baustein von
 * der Stange: Sie soll den ganzen Bildschirm füllen, unter dem Bild nichts als
 * die Beschreibung zeigen und sich mit Escape, dem X oder einem Wisch schließen
 * lassen.
 */
export function EventGalerie({ bilder, eventName }: { bilder: EventBild[]; eventName: string }) {
  const t = useTranslations("events");
  const [offen, setOffen] = useState<number | null>(null);

  if (bilder.length === 0) return null;

  return (
    <section className="mt-8 border-t border-border/60 pt-6">
      <h2 className="font-heading text-lg font-bold tracking-[-0.5px]">{t("galleryHeading")}</h2>

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {bilder.map((bild, stelle) => (
          <li key={bild.id}>
            <button
              type="button"
              onClick={() => setOffen(stelle)}
              className="group relative block aspect-square w-full overflow-hidden rounded-md bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Image
                src={bildUrl(bild.pfad)}
                alt={bildBeschriftung(bild.beschreibung, eventName)}
                fill
                sizes="(min-width: 640px) 33vw, 50vw"
                className="object-cover transition-transform duration-200 group-hover:scale-105"
                // Die Galerie steht unten auf der Seite: Erst laden, wenn
                // jemand hinscrollt.
                loading="lazy"
              />
            </button>
          </li>
        ))}
      </ul>

      {offen !== null ? (
        <Grossansicht
          bilder={bilder}
          eventName={eventName}
          stelle={offen}
          aufStelle={setOffen}
          schliessen={() => setOffen(null)}
        />
      ) : null}
    </section>
  );
}

function Grossansicht({
  bilder,
  eventName,
  stelle,
  aufStelle,
  schliessen,
}: {
  bilder: EventBild[];
  eventName: string;
  stelle: number;
  aufStelle: (stelle: number) => void;
  schliessen: () => void;
}) {
  const t = useTranslations("events");
  const rahmen = useRef<HTMLDivElement>(null);
  const wischStart = useRef<number | null>(null);
  const bild = bilder[stelle];

  const weiter = useCallback(
    (richtung: 1 | -1) => {
      // Im Kreis: Wer am letzten Bild weiterblättert, landet beim ersten.
      aufStelle((stelle + richtung + bilder.length) % bilder.length);
    },
    [aufStelle, bilder.length, stelle]
  );

  useEffect(() => {
    function aufTaste(ereignis: KeyboardEvent) {
      if (ereignis.key === "Escape") schliessen();
      if (ereignis.key === "ArrowRight") weiter(1);
      if (ereignis.key === "ArrowLeft") weiter(-1);
    }
    document.addEventListener("keydown", aufTaste);
    // Die Seite dahinter soll nicht mitscrollen, während das Bild offen ist.
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aufTaste);
      document.body.style.overflow = vorher;
    };
  }, [schliessen, weiter]);

  useEffect(() => {
    rahmen.current?.focus();
  }, []);

  const mehrAlsEins = bilder.length > 1;

  return (
    <div
      ref={rahmen}
      role="dialog"
      aria-modal="true"
      aria-label={t("galleryHeading")}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 focus:outline-none"
      onClick={(ereignis) => {
        // Ein Klick neben das Bild schließt — auf das Bild selbst nicht.
        if (ereignis.target === ereignis.currentTarget) schliessen();
      }}
      onTouchStart={(ereignis) => {
        wischStart.current = ereignis.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(ereignis) => {
        const start = wischStart.current;
        wischStart.current = null;
        if (start === null || !mehrAlsEins) return;
        const strecke = (ereignis.changedTouches[0]?.clientX ?? start) - start;
        // Kurze Berührungen sind Tippen, kein Wischen.
        if (Math.abs(strecke) > 50) weiter(strecke < 0 ? 1 : -1);
      }}
    >
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={schliessen}
          aria-label={t("galleryClose")}
          className="min-h-11 min-w-11 text-white hover:bg-white/10 hover:text-white"
        >
          <X className="h-6 w-6" aria-hidden />
        </Button>
      </div>

      <div className="flex flex-1 items-center justify-center gap-2">
        {mehrAlsEins ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => weiter(-1)}
            aria-label={t("galleryPrevious")}
            className="min-h-11 min-w-11 shrink-0 text-white hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="h-7 w-7" aria-hidden />
          </Button>
        ) : null}

        <Image
          key={bild.id}
          src={bildUrl(bild.pfad)}
          alt={bildBeschriftung(bild.beschreibung, eventName)}
          width={bild.breite}
          height={bild.hoehe}
          sizes="100vw"
          className="max-h-[75vh] w-auto max-w-full object-contain"
        />

        {mehrAlsEins ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => weiter(1)}
            aria-label={t("galleryNext")}
            className="min-h-11 min-w-11 shrink-0 text-white hover:bg-white/10 hover:text-white"
          >
            <ChevronRight className="h-7 w-7" aria-hidden />
          </Button>
        ) : null}
      </div>

      <p className="mt-3 text-center text-sm text-white/80">
        {bild.beschreibung?.trim() ? `${bild.beschreibung} · ` : ""}
        {t("galleryPosition", { current: stelle + 1, total: bilder.length })}
      </p>
    </div>
  );
}
