import { z } from "zod";
import { danceRoleValues } from "@/lib/constants/booking";
import { GELTUNGEN } from "@/lib/events/tickets";

/**
 * Einheiten, Ticketarten und Gäste von Hand (PROJ-56).
 *
 * Die Regeln stehen hier einmal und gelten für Formular und Server-Aktion —
 * eine Prüfung, die nur im Browser steht, lässt sich umgehen.
 */

/** Ein leeres Feld oder eine Zahl, die `gueltig` besteht. */
function leerOderZahl(gueltig: (zahl: number) => boolean, message: string) {
  return z
    .string()
    .trim()
    .refine((value) => value === "" || gueltig(Number(value)), { message });
}

function zeitpunkt(message: string) {
  return z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), { message });
}

export const einheitSchema = z
  .object({
    title: z.string().trim().min(1, "Titel ist erforderlich").max(200, "Höchstens 200 Zeichen"),
    starts_at: zeitpunkt("Bitte einen gültigen Beginn wählen"),
    ends_at: z
      .string()
      .refine((value) => value === "" || !Number.isNaN(new Date(value).getTime()), { message: "Ungültiges Ende" })
      .optional()
      .or(z.literal("")),
    capacity: leerOderZahl((zahl) => Number.isInteger(zahl) && zahl > 0, "Bitte eine gültige Kapazität eingeben"),
  })
  .refine((data) => !data.ends_at || new Date(data.ends_at) >= new Date(data.starts_at), {
    message: "Das Ende darf nicht vor dem Beginn liegen",
    path: ["ends_at"],
  });

export type EinheitInput = z.infer<typeof einheitSchema>;

export const ticketartSchema = z
  .object({
    name: z.string().trim().min(1, "Name ist erforderlich").max(120, "Höchstens 120 Zeichen"),
    price_normal: z
      .string()
      .trim()
      .refine((value) => value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0, {
        message: "Bitte einen gültigen Preis eingeben",
      }),
    price_student: z
      .string()
      .trim()
      .refine((value) => value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0, {
        message: "Bitte einen gültigen Studierendenpreis eingeben",
      }),
    quota: leerOderZahl((zahl) => Number.isInteger(zahl) && zahl > 0, "Bitte ein gültiges Kontingent eingeben"),
    scope: z.enum(GELTUNGEN, { message: "Bitte den Geltungsbereich wählen" }),
    /** Nur bei fester Auswahl gefüllt. */
    unit_ids: z.array(z.string().uuid()).default([]),
    on_sale: z.enum(["true", "false"]).default("true"),
  })
  // Eine feste Auswahl ohne Einheiten gälte für nichts — der Kunde kaufte ein
  // Ticket, das ihn nirgends hineinlässt.
  .refine((data) => data.scope !== "selected" || data.unit_ids.length > 0, {
    message: "Bitte mindestens eine Einheit wählen",
    path: ["unit_ids"],
  });

export type TicketartInput = z.infer<typeof ticketartSchema>;

export const gastSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich").max(200, "Höchstens 200 Zeichen"),
  note: z.string().trim().max(300, "Höchstens 300 Zeichen").optional().or(z.literal("")),
  dance_role: z.enum(danceRoleValues).optional().or(z.literal("")),
  /** Leer heißt: für alle Einheiten. */
  unit_ids: z.array(z.string().uuid()).default([]),
});

export type GastInput = z.infer<typeof gastSchema>;
