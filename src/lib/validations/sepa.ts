import { z } from "zod";
import { validateIban } from "@/lib/sepa/iban";

export const mandateSchema = z.object({
  iban: z
    .string()
    .trim()
    .min(1, "IBAN ist erforderlich")
    .superRefine((value, ctx) => {
      const result = validateIban(value);
      if (!result.valid) {
        ctx.addIssue({ code: "custom", message: result.error });
      }
    }),
  account_holder_name: z.string().trim().min(1, "Kontoinhaber ist erforderlich").max(200, "Name ist zu lang"),
  consent: z.boolean().refine((value) => value === true, "Bitte stimme dem Mandatstext zu"),
  /**
   * PROJ-7: Bestätigung, dass das Konto auf einen anderen Namen läuft.
   *
   * Nur verlangt, wenn der Kontoinhaber vom Profilnamen abweicht — diese
   * Bedingung kennt das Schema nicht, sie steht in der Aktion. Hier steht nur,
   * dass das Feld existiert.
   */
  foreign_holder_confirmed: z.boolean().optional(),
});

export type MandateInput = z.infer<typeof mandateSchema>;

export const collectionRunSchema = z.object({
  due_date: z
    .string()
    .min(1, "Fälligkeitsdatum ist erforderlich")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Ungültiges Datum"),
  confirm_duplicate: z.enum(["true", "false"]).optional(),
  // PROJ-107: Der Zyklus, für den eingezogen wird. Optional, weil das Formular
  // ihn erst nach der Umstellung mitschickt — und weil ein Fälligkeitstag ohne
  // eingetragenen Zyklus auf die Vier-Wochen-Rechnung zurückfällt.
  cycle_id: z.string().uuid("Ungültiger Zyklus").optional(),
});

export type CollectionRunInput = z.infer<typeof collectionRunSchema>;

/**
 * Ein Zahlungszyklus (PROJ-107).
 *
 * Geprüft wird hier nur, was der Betreiber falsch tippen kann. Überschneidung
 * und Unveränderlichkeit prüft die Datenbank — eine Prüfung im Formular wäre
 * wirkungslos, sobald ein Zyklus einmal anders entsteht.
 */
export const zyklusSchema = z
  .object({
    starts_on: z
      .string()
      .min(1, "Erster Tag ist erforderlich")
      .refine((v) => !Number.isNaN(new Date(v).getTime()), "Ungültiges Datum"),
    ends_on: z
      .string()
      .min(1, "Letzter Tag ist erforderlich")
      .refine((v) => !Number.isNaN(new Date(v).getTime()), "Ungültiges Datum"),
  })
  .refine((werte) => werte.ends_on >= werte.starts_on, {
    message: "Der letzte Tag liegt vor dem ersten.",
    path: ["ends_on"],
  });

export type ZyklusInput = z.infer<typeof zyklusSchema>;
