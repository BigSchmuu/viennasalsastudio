import { z } from "zod";

export const eventSchema = z
  .object({
    name: z.string().trim().min(1, "Name ist erforderlich").max(200),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    location: z.string().trim().max(200).optional().or(z.literal("")),
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
    capacity: z
      .string()
      .trim()
      .refine((value) => Number.isInteger(Number(value)) && Number(value) > 0, {
        message: "Bitte eine gültige Kapazität eingeben",
      }),
    price_normal: z
      .string()
      .trim()
      .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, {
        message: "Bitte einen gültigen Preis eingeben",
      }),
    price_student: z
      .string()
      .trim()
      .refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, {
        message: "Bitte einen gültigen Studierendenpreis eingeben",
      }),
  })
  .refine((data) => !data.ends_at || new Date(data.ends_at) >= new Date(data.starts_at), {
    message: "Enddatum darf nicht vor dem Startdatum liegen",
    path: ["ends_at"],
  });

export type EventInput = z.infer<typeof eventSchema>;

// Only enforced when creating a new event — editing an event whose date has
// since passed (e.g. to fix a typo afterwards) must still be possible.
export const createEventSchema = eventSchema.refine((data) => new Date(data.starts_at) > new Date(), {
  message: "Der Termin muss in der Zukunft liegen",
  path: ["starts_at"],
});
