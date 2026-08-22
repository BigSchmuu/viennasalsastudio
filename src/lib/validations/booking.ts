import { z } from "zod";
import { bookingTypeValues, desiredPlanValues, referralSourceValues, danceRoleValues } from "@/lib/constants/booking";

export const bookingSchema = z
  .object({
    course_id: z.string().uuid("Ungültiger Kurs"),
    type: z.enum(bookingTypeValues),
    chosen_date: z.string().min(1, "Bitte wähle einen Termin"),
    desired_plan: z.enum(desiredPlanValues).optional().or(z.literal("")),
    note: z.string().trim().max(500, "Notiz ist zu lang").optional().or(z.literal("")),
    wants_student_price: z.boolean().optional(),
    referral_source: z.enum(referralSourceValues).optional().or(z.literal("")),
    prerequisite_confirmed: z.boolean().optional(),
    dance_role: z.enum(danceRoleValues).optional().or(z.literal("")),
    coupon_code: z.string().trim().max(50, "Code ist zu lang").optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.type === "regular" && !data.desired_plan) {
      ctx.addIssue({
        code: "custom",
        message: "Bitte wähle eine Abo-Art (Nur diesen Kurs oder Flatrate)",
        path: ["desired_plan"],
      });
    }
  });

export type BookingInput = z.infer<typeof bookingSchema>;

export const courseEntryDateSchema = z.object({
  entry_date: z.string().min(1, "Datum ist erforderlich"),
});

export type CourseEntryDateInput = z.infer<typeof courseEntryDateSchema>;

export const dropinPricingSchema = z.object({
  normal_price: z.number().positive("Normalpreis muss größer als 0 sein"),
  student_price: z.number().positive("Studierendenpreis muss größer als 0 sein"),
});

export type DropinPricingInput = z.infer<typeof dropinPricingSchema>;
