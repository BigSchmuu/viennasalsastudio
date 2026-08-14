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
});

export type MandateInput = z.infer<typeof mandateSchema>;

export const collectionRunSchema = z.object({
  due_date: z
    .string()
    .min(1, "Fälligkeitsdatum ist erforderlich")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Ungültiges Datum"),
  confirm_duplicate: z.enum(["true", "false"]).optional(),
});

export type CollectionRunInput = z.infer<typeof collectionRunSchema>;
