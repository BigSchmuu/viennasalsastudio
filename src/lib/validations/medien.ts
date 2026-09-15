import { z } from "zod";
import { getYoutubeVideoId } from "@/lib/youtube";

/**
 * Bildbeschreibung und Videolink (PROJ-55).
 *
 * Die Beschreibung ist der Alternativtext — kurz gehalten, weil sie
 * vorgelesen wird und niemand einem Bild einen Absatz hinterherhören will.
 */
export const bildBeschreibungSchema = z.object({
  alt_text: z.string().trim().max(300, "Höchstens 300 Zeichen").optional().or(z.literal("")),
});

export type BildBeschreibungInput = z.infer<typeof bildBeschreibungSchema>;

export const eventVideoSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Bitte einen YouTube-Link einfügen")
    .refine((wert) => getYoutubeVideoId(wert) !== null, {
      message: "Das ist kein YouTube-Link",
    }),
  title: z.string().trim().max(200, "Höchstens 200 Zeichen").optional().or(z.literal("")),
});

export type EventVideoInput = z.infer<typeof eventVideoSchema>;
