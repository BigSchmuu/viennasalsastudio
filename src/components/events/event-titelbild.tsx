import Image from "next/image";
import { bildBeschriftung, bildUrl, type EventBild } from "@/lib/events/medien";
import { ausschnittPosition, ausschnittrichtung } from "@/lib/events/ausschnitt";
import { cn } from "@/lib/utils";

/**
 * Das Titelbild eines Events oder einer Serie (PROJ-55).
 *
 * Zwei Auftritte, ein Baustein: Auf der Karte in festem Querformat, damit alle
 * Karten gleich hoch bleiben und die Übersicht ruhig wirkt — auf der Eventseite
 * ganz, damit ein hochformatiger Flyer lesbar bleibt.
 *
 * Welcher Teil auf der Karte zu sehen ist, bestimmt seit PROJ-63 die Verwaltung.
 * Der Wert wirkt nur hier: Auf der Eventseite gibt es nichts zuzuschneiden.
 * Weil auch die Vorschau im Bilder-Dialog diesen Baustein benutzt, kann sie gar
 * nicht anders aussehen als die Karte.
 *
 * Ohne Bild bleibt kein Loch: Dann steht dort eine Fläche in den Studiofarben
 * mit der Eventart. Ein leerer Rahmen sähe aus wie ein Ladefehler.
 */
export function EventTitelbild({
  bild,
  eventName,
  typeName,
  variante,
  prioritaet = false,
}: {
  bild: EventBild | null;
  eventName: string;
  typeName: string | null;
  variante: "karte" | "seite";
  prioritaet?: boolean;
}) {
  const aufKarte = variante === "karte";

  if (!bild) {
    return (
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden bg-gradient-to-br from-salsa/15 via-mango/15 to-berry/10",
          aufKarte ? "aspect-[16/9] rounded-t-card" : "aspect-[16/7] rounded-card"
        )}
        aria-hidden
      >
        <span className="px-4 text-center font-heading text-sm font-bold uppercase tracking-[0.8px] text-foreground/45">
          {typeName ?? eventName}
        </span>
      </div>
    );
  }

  const beschriftung = bildBeschriftung(bild.beschreibung, eventName);

  if (aufKarte) {
    return (
      <div className="relative aspect-[16/9] overflow-hidden rounded-t-card bg-muted">
        <Image
          src={bildUrl(bild.pfad)}
          alt={beschriftung}
          fill
          // Drei Karten nebeneinander auf dem Bildschirm, eine am Telefon.
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
          style={{
            objectPosition: ausschnittPosition(
              bild.ausschnitt,
              ausschnittrichtung(bild.breite, bild.hoehe)
            ),
          }}
          priority={prioritaet}
        />
      </div>
    );
  }

  return (
    <Image
      src={bildUrl(bild.pfad)}
      alt={beschriftung}
      width={bild.breite}
      height={bild.hoehe}
      sizes="(min-width: 768px) 768px, 100vw"
      className="h-auto w-full rounded-card bg-muted object-contain"
      priority={prioritaet}
    />
  );
}
