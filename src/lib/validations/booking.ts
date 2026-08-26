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
    terms_accepted: z.boolean().optional(),
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

/**
 * Obergrenze für alle gepflegten Preise (PROJ-41). Ein Zahlendreher — 650 statt
 * 65 — darf nicht stillschweigend zu einem Vertragsangebot werden.
 */
export const MAX_PRICE = 1000;

const requiredPrice = (label: string) =>
  z
    .number()
    .positive(`${label} muss größer als 0 sein`)
    .max(MAX_PRICE, `${label} darf höchstens ${MAX_PRICE} € betragen`);

/**
 * Ein Belohnungsbetrag darf 0 sein — das ist die Art, das Empfehlungsprogramm
 * abzuschalten (PROJ-44). Leer darf er nicht sein: Ein leeres Feld sähe aus
 * wie „nicht gepflegt", würde das Programm aber still beenden.
 */
const rewardAmount = (label: string) =>
  z
    .number({ message: `${label} darf nicht leer sein — 0 schaltet das Programm ab` })
    .min(0, `${label} darf nicht negativ sein`)
    .max(MAX_PRICE, `${label} darf höchstens ${MAX_PRICE} € betragen`);

/** Abo- und Flatrate-Preise dürfen fehlen: `null` heißt „noch nicht gepflegt". */
const optionalPrice = (label: string) => requiredPrice(label).nullable();

/**
 * Paare, bei denen der ermäßigte Satz nie über dem normalen liegen darf
 * (PROJ-41 BUG-1). Beide Felder je Paar dürfen fehlen — geprüft wird nur, wenn
 * tatsächlich zwei Beträge vorliegen.
 */
const STUDENT_PRICE_PAIRS = [
  { normal: "normal_price", student: "student_price", label: "Drop-in" },
  { normal: "course_price", student: "course_student_price", label: "Kursabo" },
  { normal: "flatrate_price", student: "flatrate_student_price", label: "Flatrate" },
] as const;

export const pricingSchema = z
  .object({
    normal_price: requiredPrice("Drop-in-Normalpreis"),
    student_price: requiredPrice("Drop-in-Studierendenpreis"),
    course_price: optionalPrice("Kursabo-Normalpreis"),
    course_student_price: optionalPrice("Kursabo-Studierendenpreis"),
    flatrate_price: optionalPrice("Flatrate-Normalpreis"),
    flatrate_student_price: optionalPrice("Flatrate-Studierendenpreis"),
    referral_reward_referrer: rewardAmount("Empfehlungsguthaben für den Werbenden"),
    referral_reward_referee: rewardAmount("Empfehlungsguthaben für den Geworbenen"),
  })
  // Eine Ermäßigung, die teurer ist als der reguläre Preis, ist immer ein
  // Zahlendreher — und einer, den niemand bemerkt, weil er plausibel aussieht.
  // Der Fehler hängt am Studierendenfeld, damit die Meldung dort steht, wo
  // korrigiert werden muss.
  .superRefine((data, ctx) => {
    for (const pair of STUDENT_PRICE_PAIRS) {
      const normal = data[pair.normal];
      const student = data[pair.student];
      if (normal == null || student == null) continue;
      if (student > normal) {
        ctx.addIssue({
          code: "custom",
          path: [pair.student],
          message: `${pair.label}: Der Studierendenpreis darf nicht über dem Normalpreis liegen.`,
        });
      }
    }
  });

export type PricingInput = z.infer<typeof pricingSchema>;
