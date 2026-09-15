"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { bildBeschreibungSchema, eventVideoSchema } from "@/lib/validations/medien";
import { getYoutubeVideoId } from "@/lib/youtube";
import {
  BILD_GALERIE,
  BILD_TITEL,
  BILDER_BUCKET,
  ERLAUBTE_BILDTYPEN,
  MAX_BILD_BYTES,
  MAX_GALERIE_BILDER,
  type BildRolle,
  type MedienZiel,
} from "@/lib/events/medien";
import type { ActionResult } from "@/lib/actions/types";

type AdminSupabase = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

export type MedienBildZeile = {
  id: string;
  rolle: BildRolle;
  pfad: string;
  beschreibung: string | null;
  breite: number;
  hoehe: number;
};

export type MedienVideoZeile = {
  id: string;
  youtubeId: string;
  titel: string | null;
};

export type MedienBestand = {
  titelbild: MedienBildZeile | null;
  galerie: MedienBildZeile[];
  videos: MedienVideoZeile[];
};

/**
 * Die nächste freie Stelle in der Reihenfolge.
 *
 * Neues stellt sich hinten an. Aus der Uhrzeit abgeleitete Zahlen sahen
 * anfangs gleichwertig aus, wären aber irgendwann übergelaufen — und dann
 * stünde ein neues Bild plötzlich vorn.
 */
async function naechstePosition(
  supabase: AdminSupabase,
  tabelle: "event_images" | "event_videos",
  ziel: MedienZiel
): Promise<number> {
  const { data } = await zielFilter(supabase.from(tabelle).select("position"), ziel)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.position ?? -1) + 1;
}

/** Die Spalte, an der ein Bild oder Video hängt — Event oder Serie, nie beides. */
function zielSpalten(ziel: MedienZiel) {
  return ziel.eventId ? { event_id: ziel.eventId, series_id: null } : { event_id: null, series_id: ziel.serieId! };
}

function zielFilter<T extends { eq: (spalte: string, wert: string) => T }>(abfrage: T, ziel: MedienZiel): T {
  return ziel.eventId ? abfrage.eq("event_id", ziel.eventId) : abfrage.eq("series_id", ziel.serieId!);
}

/**
 * Die Seiten, die sich ändern, wenn Bilder dazukommen oder verschwinden.
 *
 * Großzügig gewählt: Ein Titelbild erscheint auf der Karte in der Übersicht,
 * auf der eigenen Seite und bei einer Serie auf jedem ihrer Termine.
 */
function neuLaden(adressen: string[]) {
  revalidatePath("/admin/events");
  revalidatePath("/events");
  for (const adresse of adressen) revalidatePath(`/events/${adresse}`);
}

/** Die Adresse, unter der das Ziel öffentlich erreichbar ist. */
async function zieladressen(supabase: AdminSupabase, ziel: MedienZiel): Promise<string[]> {
  if (ziel.serieId) {
    const [{ data: serie }, { data: termine }] = await Promise.all([
      supabase.from("event_series").select("slug").eq("id", ziel.serieId).maybeSingle(),
      supabase.from("events").select("slug").eq("series_id", ziel.serieId),
    ]);
    return [serie?.slug, ...(termine ?? []).map((termin) => termin.slug)].filter((s): s is string => !!s);
  }

  const { data: event } = await supabase.from("events").select("slug").eq("id", ziel.eventId!).maybeSingle();
  return event?.slug ? [event.slug] : [];
}

export async function getEventMedien(ziel: MedienZiel): Promise<MedienBestand> {
  const { supabase } = await requireAdmin();

  const [bilderRes, videosRes] = await Promise.all([
    zielFilter(supabase.from("event_images").select("id, role, storage_path, alt_text, width, height"), ziel).order(
      "position",
      { ascending: true }
    ),
    zielFilter(supabase.from("event_videos").select("id, youtube_id, title"), ziel).order("position", {
      ascending: true,
    }),
  ]);

  if (bilderRes.error) console.error("Bilder nicht lesbar", bilderRes.error);
  if (videosRes.error) console.error("Videos nicht lesbar", videosRes.error);

  const bilder = (bilderRes.data ?? []).map((bild) => ({
    id: bild.id,
    rolle: bild.role as BildRolle,
    pfad: bild.storage_path,
    beschreibung: bild.alt_text,
    breite: bild.width,
    hoehe: bild.height,
  }));

  return {
    titelbild: bilder.find((bild) => bild.rolle === BILD_TITEL) ?? null,
    galerie: bilder.filter((bild) => bild.rolle === BILD_GALERIE),
    videos: (videosRes.data ?? []).map((video) => ({
      id: video.id,
      youtubeId: video.youtube_id,
      titel: video.title,
    })),
  };
}

/**
 * Ein hochgeladenes Bild eintragen.
 *
 * Die Datei liegt zu diesem Zeitpunkt schon im Bildspeicher — der Browser legt
 * sie direkt dort ab, weil ein verkleinertes Foto sonst durch die Server-Aktion
 * müsste, die dafür nicht gemacht ist. Scheitert das Eintragen, wird die Datei
 * wieder weggeräumt: Eine Datei ohne Eintrag sähe niemand mehr, sie belegte nur
 * Platz.
 */
export async function saveEventBild(
  ziel: MedienZiel,
  bild: { pfad: string; breite: number; hoehe: number; rolle: BildRolle }
): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  async function raeumeAuf() {
    await supabase.storage.from(BILDER_BUCKET).remove([bild.pfad]);
  }

  const dateiFehler = await geprüfteDatei(supabase, bild.pfad);
  if (dateiFehler) {
    await raeumeAuf();
    return { error: dateiFehler };
  }

  if (bild.rolle === BILD_GALERIE) {
    const { count, error } = await zielFilter(
      supabase.from("event_images").select("id", { count: "exact", head: true }),
      ziel
    ).eq("role", BILD_GALERIE);
    if (error) {
      await raeumeAuf();
      return { error: "Bild konnte nicht gespeichert werden." };
    }
    if ((count ?? 0) >= MAX_GALERIE_BILDER) {
      await raeumeAuf();
      return { error: `Mehr als ${MAX_GALERIE_BILDER} Bilder sind nicht möglich.` };
    }
  }

  const altesTitelbild =
    bild.rolle === BILD_TITEL
      ? (
          await zielFilter(supabase.from("event_images").select("id, storage_path"), ziel)
            .eq("role", BILD_TITEL)
            .maybeSingle()
        ).data
      : null;

  if (altesTitelbild) {
    // Die vorhandene Zeile bekommt das neue Bild, statt dass eine zweite
    // danebentritt: „Höchstens ein Titelbild je Event" ist eine Sperre in der
    // Datenbank, und ein Eintrag neben dem alten scheiterte daran (QA-Befund
    // BUG-1). Die Beschreibung gehörte zum alten Bild und geht mit ihm.
    const { error: aenderFehler } = await supabase
      .from("event_images")
      .update({ storage_path: bild.pfad, width: bild.breite, height: bild.hoehe, alt_text: null })
      .eq("id", altesTitelbild.id);

    if (aenderFehler) {
      console.error("Titelbild konnte nicht ersetzt werden", aenderFehler);
      await raeumeAuf();
      return { error: "Bild konnte nicht gespeichert werden." };
    }

    // Erst jetzt die alte Datei: Ginge sie vorher, stünde bei einem Fehler
    // eine Zeile ohne Bild da.
    const { error: speicherFehler } = await supabase.storage
      .from(BILDER_BUCKET)
      .remove([altesTitelbild.storage_path]);
    if (speicherFehler) {
      console.error("Altes Titelbild blieb liegen", altesTitelbild.storage_path, speicherFehler);
    }

    neuLaden(await zieladressen(supabase, ziel));
    return { success: true };
  }

  const { error } = await supabase.from("event_images").insert({
    ...zielSpalten(ziel),
    role: bild.rolle,
    storage_path: bild.pfad,
    width: bild.breite,
    height: bild.hoehe,
    position: bild.rolle === BILD_TITEL ? 0 : await naechstePosition(supabase, "event_images", ziel),
  });

  if (error) {
    console.error("Bild konnte nicht eingetragen werden", error);
    await raeumeAuf();
    return { error: "Bild konnte nicht gespeichert werden." };
  }

  neuLaden(await zieladressen(supabase, ziel));
  return { success: true };
}

export async function updateBildBeschreibung(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = bildBeschreibungSchema.safeParse({ alt_text: formData.get("alt_text") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("event_images")
    .update({ alt_text: parsed.data.alt_text || null })
    .eq("id", id)
    .select("event_id, series_id")
    .single();

  if (error || !data) {
    return { error: "Beschreibung konnte nicht gespeichert werden." };
  }

  neuLaden(await zieladressen(supabase, zielAusZeile(data)));
  return { success: true };
}

export async function deleteEventBild(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("event_images")
    .delete()
    .eq("id", id)
    .select("storage_path, event_id, series_id")
    .single();

  if (error || !data) {
    return { error: "Bild konnte nicht entfernt werden." };
  }

  // Erst der Eintrag, dann die Datei: Bleibt die Datei liegen, sieht sie
  // niemand mehr. Bliebe umgekehrt der Eintrag stehen, zeigte die Seite ein
  // kaputtes Bild.
  const { error: speicherFehler } = await supabase.storage.from(BILDER_BUCKET).remove([data.storage_path]);
  if (speicherFehler) {
    console.error("Bilddatei blieb liegen", data.storage_path, speicherFehler);
  }

  neuLaden(await zieladressen(supabase, zielAusZeile(data)));
  return { success: true };
}

/** Ein Galeriebild eine Stelle nach vorn oder nach hinten. */
export async function moveEventBild(id: string, richtung: "hoch" | "runter"): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data: bild, error } = await supabase
    .from("event_images")
    .select("id, position, event_id, series_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !bild) return { error: "Bild nicht gefunden." };

  const ziel = zielAusZeile(bild);
  const { data: geschwister } = await zielFilter(supabase.from("event_images").select("id, position"), ziel)
    .eq("role", BILD_GALERIE)
    .order("position", { ascending: true });

  const ergebnis = await tausche(supabase, "event_images", geschwister ?? [], id, richtung);
  if (!ergebnis) return { error: "Reihenfolge konnte nicht geändert werden." };

  neuLaden(await zieladressen(supabase, ziel));
  return { success: true };
}

export async function addEventVideo(ziel: MedienZiel, formData: FormData): Promise<ActionResult> {
  const parsed = eventVideoSchema.safeParse({ url: formData.get("url"), title: formData.get("title") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const youtubeId = getYoutubeVideoId(parsed.data.url);
  if (!youtubeId) return { error: "Das ist kein YouTube-Link" };

  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("event_videos").insert({
    ...zielSpalten(ziel),
    youtube_id: youtubeId,
    title: parsed.data.title || null,
    position: await naechstePosition(supabase, "event_videos", ziel),
  });

  if (error) {
    console.error("Video konnte nicht gespeichert werden", error);
    return { error: "Video konnte nicht gespeichert werden." };
  }

  neuLaden(await zieladressen(supabase, ziel));
  return { success: true };
}

export async function deleteEventVideo(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("event_videos")
    .delete()
    .eq("id", id)
    .select("event_id, series_id")
    .single();

  if (error || !data) return { error: "Video konnte nicht entfernt werden." };

  neuLaden(await zieladressen(supabase, zielAusZeile(data)));
  return { success: true };
}

export async function moveEventVideo(id: string, richtung: "hoch" | "runter"): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data: video, error } = await supabase
    .from("event_videos")
    .select("id, position, event_id, series_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !video) return { error: "Video nicht gefunden." };

  const ziel = zielAusZeile(video);
  const { data: geschwister } = await zielFilter(
    supabase.from("event_videos").select("id, position"),
    ziel
  ).order("position", { ascending: true });

  const ergebnis = await tausche(supabase, "event_videos", geschwister ?? [], id, richtung);
  if (!ergebnis) return { error: "Reihenfolge konnte nicht geändert werden." };

  neuLaden(await zieladressen(supabase, ziel));
  return { success: true };
}

function zielAusZeile(zeile: { event_id: string | null; series_id: string | null }): MedienZiel {
  return zeile.event_id ? { eventId: zeile.event_id } : { serieId: zeile.series_id! };
}

/**
 * Zwei Nachbarn tauschen die Plätze.
 *
 * Dieselbe Bewegung für Bilder und Videos — zwei Fassungen liefen früher oder
 * später auseinander, und eine davon sortierte dann falsch herum.
 */
async function tausche(
  supabase: AdminSupabase,
  tabelle: "event_images" | "event_videos",
  zeilen: { id: string; position: number }[],
  id: string,
  richtung: "hoch" | "runter"
): Promise<boolean> {
  const stelle = zeilen.findIndex((zeile) => zeile.id === id);
  const nachbarStelle = richtung === "hoch" ? stelle - 1 : stelle + 1;
  if (stelle < 0 || nachbarStelle < 0 || nachbarStelle >= zeilen.length) return false;

  const eigene = zeilen[stelle];
  const nachbar = zeilen[nachbarStelle];

  const [a, b] = await Promise.all([
    supabase.from(tabelle).update({ position: nachbar.position }).eq("id", eigene.id),
    supabase.from(tabelle).update({ position: eigene.position }).eq("id", nachbar.id),
  ]);
  if (a.error || b.error) {
    console.error("Reihenfolge nicht änderbar", a.error ?? b.error);
    return false;
  }
  return true;
}

/**
 * Die hochgeladene Datei am Bildspeicher nachschlagen und prüfen.
 *
 * Der Browser sagt, was er hochgeladen hat — geglaubt wird ihm nicht: Gefragt
 * wird der Speicher selbst, nach Typ und Größe der Datei, die dort wirklich
 * liegt. Findet sich nichts, ist der Upload unterwegs steckengeblieben, und es
 * entsteht kein Eintrag ohne Bild.
 */
async function geprüfteDatei(supabase: AdminSupabase, pfad: string): Promise<string | null> {
  const letzterStrich = pfad.lastIndexOf("/");
  const ordner = letzterStrich > 0 ? pfad.slice(0, letzterStrich) : "";
  const name = pfad.slice(letzterStrich + 1);

  const { data, error } = await supabase.storage.from(BILDER_BUCKET).list(ordner, { search: name, limit: 100 });
  if (error) {
    console.error("Bildspeicher nicht lesbar", error);
    return "Bild konnte nicht gespeichert werden.";
  }

  const datei = (data ?? []).find((eintrag) => eintrag.name === name);
  if (!datei) return "Das Bild ist nicht vollständig angekommen. Bitte noch einmal versuchen.";

  const typ = datei.metadata?.mimetype as string | undefined;
  const groesse = datei.metadata?.size as number | undefined;
  if (!typ || !(ERLAUBTE_BILDTYPEN as readonly string[]).includes(typ)) {
    return "Nur JPG, PNG oder WebP.";
  }
  if (typeof groesse === "number" && groesse > MAX_BILD_BYTES) {
    return "Das Bild ist zu groß.";
  }
  return null;
}
