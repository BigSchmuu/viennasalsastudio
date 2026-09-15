"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { YoutubeEmbed } from "@/components/video/youtube-embed";
import { createClient } from "@/lib/supabase/client";
import { verkleinereBild } from "@/lib/bilder/verkleinern";
import {
  BILD_GALERIE,
  BILD_TITEL,
  BILDER_BUCKET,
  bildFehler,
  bildUrl,
  ERLAUBTE_BILDTYPEN,
  MAX_GALERIE_BILDER,
  type BildFehler,
  type BildRolle,
  type MedienZiel,
} from "@/lib/events/medien";
import {
  addEventVideo,
  deleteEventBild,
  deleteEventVideo,
  getEventMedien,
  moveEventBild,
  moveEventVideo,
  saveEventBild,
  updateBildBeschreibung,
  type MedienBestand,
  type MedienBildZeile,
} from "@/lib/actions/admin/event-medien";

const FEHLERTEXT: Record<BildFehler, string> = {
  typ: "Nur JPG, PNG oder WebP.",
  heic: "Dieses Foto ist im iPhone-Format HEIC. Bitte als JPG teilen oder exportieren.",
  zuGross: "Das Bild ist größer als 10 MB.",
};

/**
 * Bilder und Videos eines Events oder einer Serie verwalten (PROJ-55).
 *
 * Der Weg eines Bildes: Der Browser verkleinert und zeichnet es neu — dabei
 * fallen auch die Standortdaten weg —, legt es im Bildspeicher ab und meldet
 * es dann der App. Durch die Server-Aktion selbst geht die Datei nicht: Die
 * ist für Formularfelder gedacht, nicht für Fotos.
 */
export function MedienDialog({
  ziel,
  name,
  onOpenChange,
}: {
  ziel: MedienZiel | null;
  name: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [bestand, setBestand] = useState<MedienBestand | null>(null);
  const [laedtHoch, setLaedtHoch] = useState(false);

  const laden = useCallback(async (aktuellesZiel: MedienZiel) => {
    setBestand(await getEventMedien(aktuellesZiel));
  }, []);

  useEffect(() => {
    if (!ziel) return;
    let aktuell = true;
    getEventMedien(ziel).then((geladen) => {
      if (aktuell) setBestand(geladen);
    });
    return () => {
      aktuell = false;
    };
  }, [ziel]);

  /** Ein Bild verkleinern, ablegen und eintragen. */
  async function hochladen(dateien: File[], rolle: BildRolle) {
    if (!ziel) return;
    setLaedtHoch(true);
    const supabase = createClient();
    const ordner = ziel.eventId ? `events/${ziel.eventId}` : `serien/${ziel.serieId}`;

    try {
      for (const datei of dateien) {
        const fehler = bildFehler(datei);
        if (fehler) {
          toast.error(`${datei.name}: ${FEHLERTEXT[fehler]}`);
          continue;
        }

        let verkleinert;
        try {
          verkleinert = await verkleinereBild(datei);
        } catch {
          toast.error(`${datei.name}: Das Bild konnte nicht gelesen werden.`);
          continue;
        }

        const pfad = `${ordner}/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage.from(BILDER_BUCKET).upload(pfad, verkleinert.datei, {
          contentType: verkleinert.datei.type,
          upsert: false,
        });
        if (error) {
          // Häufigster Fall: Das Netz war weg. Dann liegt nichts halb herum —
          // ohne Eintrag ist das Bild für die App nicht vorhanden.
          toast.error(`${datei.name}: Das Hochladen hat nicht geklappt. Bitte noch einmal versuchen.`);
          continue;
        }

        const ergebnis = await saveEventBild(ziel, {
          pfad,
          breite: verkleinert.breite,
          hoehe: verkleinert.hoehe,
          rolle,
        });
        if ("error" in ergebnis) {
          toast.error(ergebnis.error);
          continue;
        }
      }

      await laden(ziel);
    } finally {
      setLaedtHoch(false);
    }
  }

  async function mitMeldung(arbeit: Promise<{ error: string } | { success: true }>, gelungen: string) {
    const ergebnis = await arbeit;
    if ("error" in ergebnis) {
      toast.error(ergebnis.error);
      return;
    }
    toast.success(gelungen);
    if (ziel) await laden(ziel);
  }

  const galerieVoll = (bestand?.galerie.length ?? 0) >= MAX_GALERIE_BILDER;

  return (
    <Dialog open={!!ziel} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bilder &amp; Videos — {name}</DialogTitle>
        </DialogHeader>

        <Alert>
          <AlertDescription>
            Bitte nur Fotos verwenden, an denen das Studio die Rechte hat und mit deren Veröffentlichung die
            abgebildeten Personen einverstanden sind. Standortdaten aus Handyfotos werden beim Hochladen entfernt.
          </AlertDescription>
        </Alert>

        {bestand === null ? (
          <p className="text-sm text-muted-foreground">Wird geladen…</p>
        ) : (
          <div className="space-y-8">
            <section className="space-y-3">
              <div>
                <h3 className="font-heading font-bold">Titelbild</h3>
                <p className="text-sm text-muted-foreground">
                  Erscheint auf der Karte in der Übersicht und oben auf der Seite. Auf der Karte im Querformat
                  zugeschnitten.
                </p>
              </div>

              {bestand.titelbild ? (
                <div className="flex flex-wrap items-start gap-3">
                  <Vorschau bild={bestand.titelbild} name={name} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => mitMeldung(deleteEventBild(bestand.titelbild!.id), "Titelbild entfernt.")}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                    Entfernen
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Noch kein Titelbild.</p>
              )}

              <DateiWahl
                id="titelbild-wahl"
                beschriftung={bestand.titelbild ? "Titelbild ersetzen" : "Titelbild wählen"}
                deaktiviert={laedtHoch}
                aufAuswahl={(dateien) => hochladen(dateien.slice(0, 1), BILD_TITEL)}
              />
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="font-heading font-bold">Galerie</h3>
                <p className="text-sm text-muted-foreground">
                  {bestand.galerie.length} von {MAX_GALERIE_BILDER} Bildern. Die Reihenfolge gilt auch auf der Seite.
                </p>
              </div>

              {bestand.galerie.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Bilder in der Galerie.</p>
              ) : (
                <ul className="space-y-3">
                  {bestand.galerie.map((bild, stelle) => (
                    <li key={bild.id} className="flex flex-wrap items-start gap-3 rounded-md border p-3">
                      <Vorschau bild={bild} name={name} />

                      <div className="min-w-[12rem] flex-1 space-y-2">
                        <Beschreibung bild={bild} aufGespeichert={() => ziel && laden(ziel)} />
                      </div>

                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Nach oben"
                          disabled={stelle === 0}
                          onClick={() => mitMeldung(moveEventBild(bild.id, "hoch"), "Reihenfolge geändert.")}
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Nach unten"
                          disabled={stelle === bestand.galerie.length - 1}
                          onClick={() => mitMeldung(moveEventBild(bild.id, "runter"), "Reihenfolge geändert.")}
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Bild entfernen"
                          onClick={() => mitMeldung(deleteEventBild(bild.id), "Bild entfernt.")}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {galerieVoll ? (
                <p className="text-sm text-muted-foreground">
                  Die Galerie ist voll — mehr als {MAX_GALERIE_BILDER} Bilder sind nicht möglich. Entferne eines, um
                  Platz zu schaffen.
                </p>
              ) : (
                <DateiWahl
                  id="galerie-wahl"
                  beschriftung="Bilder hinzufügen"
                  mehrere
                  deaktiviert={laedtHoch}
                  aufAuswahl={(dateien) =>
                    hochladen(dateien.slice(0, MAX_GALERIE_BILDER - bestand.galerie.length), BILD_GALERIE)
                  }
                />
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="font-heading font-bold">Videos</h3>
                <p className="text-sm text-muted-foreground">
                  YouTube-Links. Eingebettet wird ohne Cookies, wie bei den Beispiel-Videos.
                </p>
              </div>

              {bestand.videos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Videos.</p>
              ) : (
                <ul className="space-y-3">
                  {bestand.videos.map((video, stelle) => (
                    <li key={video.id} className="flex flex-wrap items-start gap-3 rounded-md border p-3">
                      <div className="w-44 shrink-0">
                        <YoutubeEmbed
                          url={`https://www.youtube.com/watch?v=${video.youtubeId}`}
                          title={video.titel ?? name}
                        />
                      </div>
                      <p className="min-w-[8rem] flex-1 text-sm">{video.titel ?? "Ohne Titel"}</p>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Nach oben"
                          disabled={stelle === 0}
                          onClick={() => mitMeldung(moveEventVideo(video.id, "hoch"), "Reihenfolge geändert.")}
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Nach unten"
                          disabled={stelle === bestand.videos.length - 1}
                          onClick={() => mitMeldung(moveEventVideo(video.id, "runter"), "Reihenfolge geändert.")}
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Video entfernen"
                          onClick={() => mitMeldung(deleteEventVideo(video.id), "Video entfernt.")}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {ziel ? <VideoFormular ziel={ziel} aufGespeichert={() => laden(ziel)} /> : null}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Vorschau({ bild, name }: { bild: MedienBildZeile; name: string }) {
  return (
    <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-md bg-muted">
      <Image
        src={bildUrl(bild.pfad)}
        alt={bild.beschreibung ?? name}
        fill
        sizes="112px"
        className="object-cover"
      />
    </div>
  );
}

/**
 * Die Bildbeschreibung — der Alternativtext für alle, die sich die Seite
 * vorlesen lassen. Gespeichert wird beim Verlassen des Feldes, aber nur, wenn
 * sich etwas geändert hat: Sonst schriebe jedes Durchtabben in die Datenbank.
 */
function Beschreibung({ bild, aufGespeichert }: { bild: MedienBildZeile; aufGespeichert: () => void }) {
  const [text, setText] = useState(bild.beschreibung ?? "");
  const gespeichert = useRef(bild.beschreibung ?? "");

  return (
    <div className="space-y-1">
      <Label htmlFor={`beschreibung-${bild.id}`} className="text-xs font-normal text-muted-foreground">
        Bildbeschreibung (optional)
      </Label>
      <Input
        id={`beschreibung-${bild.id}`}
        value={text}
        placeholder="z. B. Tanzfläche am Freitagabend"
        onChange={(ereignis) => setText(ereignis.target.value)}
        onBlur={async () => {
          if (text === gespeichert.current) return;
          const formData = new FormData();
          formData.set("alt_text", text);
          const ergebnis = await updateBildBeschreibung(bild.id, formData);
          if ("error" in ergebnis) {
            toast.error(ergebnis.error);
            return;
          }
          gespeichert.current = text;
          toast.success("Beschreibung gespeichert.");
          aufGespeichert();
        }}
      />
    </div>
  );
}

function VideoFormular({ ziel, aufGespeichert }: { ziel: MedienZiel; aufGespeichert: () => void }) {
  const [url, setUrl] = useState("");
  const [titel, setTitel] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (ereignis) => {
        ereignis.preventDefault();
        setLaeuft(true);
        try {
          const formData = new FormData();
          formData.set("url", url);
          formData.set("title", titel);
          const ergebnis = await addEventVideo(ziel, formData);
          if ("error" in ergebnis) {
            toast.error(ergebnis.error);
            return;
          }
          setUrl("");
          setTitel("");
          toast.success("Video hinzugefügt.");
          aufGespeichert();
        } finally {
          setLaeuft(false);
        }
      }}
    >
      <div className="min-w-[14rem] flex-1 space-y-1">
        <Label htmlFor="video-url" className="text-xs font-normal text-muted-foreground">
          YouTube-Link
        </Label>
        <Input
          id="video-url"
          value={url}
          onChange={(ereignis) => setUrl(ereignis.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          required
        />
      </div>
      <div className="min-w-[10rem] flex-1 space-y-1">
        <Label htmlFor="video-titel" className="text-xs font-normal text-muted-foreground">
          Titel (optional)
        </Label>
        <Input id="video-titel" value={titel} onChange={(ereignis) => setTitel(ereignis.target.value)} />
      </div>
      <Button type="submit" disabled={laeuft || url.trim() === ""}>
        {laeuft ? "Wird gespeichert…" : "Video hinzufügen"}
      </Button>
    </form>
  );
}

/**
 * Der Knopf zum Auswählen einer Datei.
 *
 * Ein eigenes Feld statt des rohen Dateifelds, damit der Knopf aussieht wie
 * jeder andere — und damit das Feld nach der Auswahl geleert wird: Sonst ließe
 * sich dieselbe Datei kein zweites Mal wählen.
 */
function DateiWahl({
  id,
  beschriftung,
  mehrere = false,
  deaktiviert,
  aufAuswahl,
}: {
  id: string;
  beschriftung: string;
  mehrere?: boolean;
  deaktiviert: boolean;
  aufAuswahl: (dateien: File[]) => void;
}) {
  const feld = useRef<HTMLInputElement>(null);

  return (
    <div>
      <input
        ref={feld}
        id={id}
        type="file"
        accept={ERLAUBTE_BILDTYPEN.join(",")}
        multiple={mehrere}
        className="sr-only"
        onChange={(ereignis) => {
          const dateien = Array.from(ereignis.target.files ?? []);
          ereignis.target.value = "";
          if (dateien.length > 0) aufAuswahl(dateien);
        }}
      />
      <Button type="button" variant="outline" disabled={deaktiviert} onClick={() => feld.current?.click()}>
        <Upload className="mr-1.5 h-4 w-4" aria-hidden />
        {deaktiviert ? "Wird hochgeladen…" : beschriftung}
      </Button>
    </div>
  );
}
