import { z } from "zod";
import { SALES_MODES } from "@/lib/events/event-zustand";
import { ZAHLUNGSWAHLEN } from "@/lib/events/tickets";

/** Ein leeres Feld oder eine Zahl, die `gueltig` besteht. */
function leerOderZahl(gueltig: (zahl: number) => boolean, message: string) {
  return z
    .string()
    .trim()
    .refine((value) => value === "" || gueltig(Number(value)), { message });
}

export const eventSchema = z
  .object({
    name: z.string().trim().min(1, "Name ist erforderlich").max(200),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    location: z.string().trim().max(200).optional().or(z.literal("")),
    event_type_id: z.string().uuid("Bitte eine Eventart wählen"),
    sales_mode: z.enum(SALES_MODES, { message: "Bitte die Verkaufsart wählen" }),
    starts_at: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "Bitte einen gültigen Termin wählen",
    }),
    ends_at: z
      .string()
      .refine((value) => value === "" || !Number.isNaN(new Date(value).getTime()), {
        message: "Ungültiges Enddatum",
      })
      .optional()
      .or(z.literal("")),
    capacity: leerOderZahl((zahl) => Number.isInteger(zahl) && zahl > 0, "Bitte eine gültige Kapazität eingeben"),
    price_normal: leerOderZahl((zahl) => Number.isFinite(zahl) && zahl >= 0, "Bitte einen gültigen Preis eingeben"),
    price_student: leerOderZahl(
      (zahl) => Number.isFinite(zahl) && zahl >= 0,
      "Bitte einen gültigen Studierendenpreis eingeben"
    ),
    // PROJ-56: Mindestens eine Zahlungsart muss übrig bleiben — deshalb eine
    // Auswahl aus dreien statt zweier Häkchen, die beide leer sein könnten.
    payment_methods: z.enum(ZAHLUNGSWAHLEN, { message: "Bitte die Zahlungsarten wählen" }),
    cancellation_lead_days: z
      .string()
      .trim()
      .refine((value) => value !== "" && Number.isInteger(Number(value)) && Number(value) >= 0, {
        message: "Bitte eine Stornofrist in ganzen Tagen eingeben",
      }),
    role_query_enabled: z.enum(["true", "false"]),
    max_role_difference: leerOderZahl(
      (zahl) => Number.isInteger(zahl) && zahl >= 0,
      "Bitte einen gültigen Abstand eingeben"
    ),
  })
  .refine((data) => !data.ends_at || new Date(data.ends_at) >= new Date(data.starts_at), {
    message: "Enddatum darf nicht vor dem Startdatum liegen",
    path: ["ends_at"],
  })
  // PROJ-53: Wer Tickets in der App verkauft, braucht Kapazität und Preise. Wer
  // nur anzeigt (Eintritt vor Ort), darf beides leer lassen — ein Preis wird
  // dann nur angezeigt, falls er eingetragen ist.
  .refine((data) => data.sales_mode === "display" || data.capacity !== "", {
    message: "Für Tickets in der App ist eine Kapazität nötig",
    path: ["capacity"],
  })
  .refine((data) => data.sales_mode === "display" || data.price_normal !== "", {
    message: "Für Tickets in der App ist ein Preis nötig",
    path: ["price_normal"],
  })
  .refine((data) => data.sales_mode === "display" || data.price_student !== "", {
    message: "Für Tickets in der App ist ein Studierendenpreis nötig",
    path: ["price_student"],
  });

export type EventInput = z.infer<typeof eventSchema>;

// Only enforced when creating a new event — editing an event whose date has
// since passed (e.g. to fix a typo afterwards) must still be possible.
export const createEventSchema = eventSchema.refine((data) => new Date(data.starts_at) > new Date(), {
  message: "Der Termin muss in der Zukunft liegen",
  path: ["starts_at"],
});

// PROJ-53: Eventarten wie Party oder Workshop. Kurz gehalten, weil der Name als
// Label auf jeder Karte und als Filter-Chip erscheint.
export const eventTypeSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich").max(60, "Höchstens 60 Zeichen"),
});

export type EventTypeInput = z.infer<typeof eventTypeSchema>;

// PROJ-54: Eine Serie beschreibt die Regel — ein fester Wochentag, eine
// Uhrzeit, ein Anfang und vielleicht ein Ende.
export const eventSeriesSchema = z
  .object({
    name: z.string().trim().min(1, "Name ist erforderlich").max(200),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    location: z.string().trim().max(200).optional().or(z.literal("")),
    event_type_id: z.string().uuid("Bitte eine Eventart wählen"),
    sales_mode: z.enum(SALES_MODES, { message: "Bitte die Verkaufsart wählen" }),
    weekday: z.enum(["0", "1", "2", "3", "4", "5", "6"], { message: "Bitte einen Wochentag wählen" }),
    start_time: z.string().regex(/^\d{2}:\d{2}$/, "Bitte eine Uhrzeit wählen"),
    end_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Ungültige Uhrzeit")
      .optional()
      .or(z.literal("")),
    starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte einen Starttag wählen"),
    ends_on: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Enddatum")
      .optional()
      .or(z.literal("")),
    pause_in_holidays: z.enum(["true", "false"]),
    capacity: leerOderZahl((zahl) => Number.isInteger(zahl) && zahl > 0, "Bitte eine gültige Kapazität eingeben"),
    price_normal: leerOderZahl((zahl) => Number.isFinite(zahl) && zahl >= 0, "Bitte einen gültigen Preis eingeben"),
    price_student: leerOderZahl(
      (zahl) => Number.isFinite(zahl) && zahl >= 0,
      "Bitte einen gültigen Studierendenpreis eingeben"
    ),
  })
  .refine((data) => !data.ends_on || data.ends_on >= data.starts_on, {
    message: "Das Ende der Serie darf nicht vor ihrem Beginn liegen",
    path: ["ends_on"],
  })
  // Wie beim Einzelevent: Wer Tickets verkauft, braucht Kapazität und Preise.
  .refine((data) => data.sales_mode === "display" || data.capacity !== "", {
    message: "Für Tickets in der App ist eine Kapazität nötig",
    path: ["capacity"],
  })
  .refine((data) => data.sales_mode === "display" || data.price_normal !== "", {
    message: "Für Tickets in der App ist ein Preis nötig",
    path: ["price_normal"],
  })
  .refine((data) => data.sales_mode === "display" || data.price_student !== "", {
    message: "Für Tickets in der App ist ein Studierendenpreis nötig",
    path: ["price_student"],
  });

export type EventSeriesInput = z.infer<typeof eventSeriesSchema>;

// PROJ-54: Einen einzelnen Termin verlegen — Datum, Uhrzeit und Ort dürfen
// vom Rhythmus abweichen.
export const terminVerlegenSchema = z.object({
  starts_at: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Bitte einen gültigen Termin wählen",
  }),
  ends_at: z
    .string()
    .refine((value) => value === "" || !Number.isNaN(new Date(value).getTime()), { message: "Ungültiges Ende" })
    .optional()
    .or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
});

export type TerminVerlegenInput = z.infer<typeof terminVerlegenSchema>;
