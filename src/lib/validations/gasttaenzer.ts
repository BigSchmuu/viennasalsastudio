import { z } from "zod";
import { LEVEL_REIHE } from "@/lib/gasttaenzer/level";

/** Anmeldung zum Gasttänzer-Programm (PROJ-60). */
export const gasttaenzerSchema = z.object({
  dance_role: z.enum(["leader", "follower", "both"], { message: "Bitte deine Rolle wählen" }),
  level: z.enum(LEVEL_REIHE, { message: "Bitte dein Level wählen" }),
});

export type GasttaenzerInput = z.infer<typeof gasttaenzerSchema>;

/**
 * Eine Ausschreibung (PROJ-60).
 *
 * `min_level` darf leer bleiben: Bei Open Level und bei Advanced greift „eine
 * Stufe drüber" nicht, und dann entscheidet der Betreiber, dass jedes Können
 * genügt.
 */
export const ausschreibungSchema = z.object({
  course_id: z.string().uuid("Bitte einen Kurs wählen"),
  occurrence_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte einen Termin wählen"),
  dance_role: z.enum(["leader", "follower"], { message: "Bitte die gesuchte Rolle wählen" }),
  seats: z
    .string()
    .trim()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 20, {
      message: "Bitte eine Anzahl zwischen 1 und 20 angeben",
    }),
  min_level: z.enum(LEVEL_REIHE).nullable().or(z.literal("")),
});

export type AusschreibungInput = z.infer<typeof ausschreibungSchema>;
