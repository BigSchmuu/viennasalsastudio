import { z } from "zod";

/**
 * Anforderungen an ein *neues* Passwort.
 *
 * Acht Zeichen aus drei Zeichenklassen statt sechs beliebiger: Das sind rund
 * 2^48 Rateversuche statt 2^27 -- der Unterschied zwischen "an einem Abend
 * durchprobiert" und "nicht lohnend". Sonderzeichen bleiben bewusst
 * freiwillig; sie erhoehen die Huerde beim Registrieren spuerbar und bringen
 * daneben wenig.
 *
 * Dieselbe Regel muss im Supabase-Dashboard stehen (Authentication →
 * Providers → Email: Mindestlaenge 8, "Lowercase, uppercase letters and
 * digits"). Laufen die beiden auseinander, sagt die App "passt" und der
 * Dienst weist ab -- der Kunde erfaehrt die Anforderung erst nach dem
 * Absenden.
 *
 * Bewusst **nicht** in loginSchema: Bestandskunden mit kuerzerem Passwort
 * muessen sich weiterhin anmelden koennen. Die Regel gilt nur, wenn ein
 * Passwort neu gesetzt wird.
 */
const PASSWORT_HINWEIS =
  "Mindestens 8 Zeichen mit Groß- und Kleinbuchstaben und mindestens einer Ziffer";

const neuesPasswort = z
  .string()
  .min(8, PASSWORT_HINWEIS)
  .regex(/[a-z]/, PASSWORT_HINWEIS)
  .regex(/[A-Z]/, PASSWORT_HINWEIS)
  .regex(/[0-9]/, PASSWORT_HINWEIS);

export const loginSchema = z.object({
  email: z.string().min(1, "E-Mail ist erforderlich").email("Ungültige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort ist erforderlich"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().min(1, "E-Mail ist erforderlich").email("Ungültige E-Mail-Adresse"),
  password: neuesPasswort,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "E-Mail ist erforderlich").email("Ungültige E-Mail-Adresse"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: neuesPasswort,
    confirmPassword: z.string().min(1, "Bitte bestätige dein Passwort"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

const genderValues = ["weiblich", "maennlich", "divers", "keine_angabe"] as const;
export const genderOptions: { value: (typeof genderValues)[number]; label: string }[] = [
  { value: "weiblich", label: "Weiblich" },
  { value: "maennlich", label: "Männlich" },
  { value: "divers", label: "Divers" },
  { value: "keine_angabe", label: "Keine Angabe" },
];

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .max(200, "Name ist zu lang")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(50, "Telefonnummer ist zu lang")
    .optional()
    .or(z.literal("")),
  birthdate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => {
      if (!value) return true;
      // Compare calendar days, not instants: `new Date("2026-08-23")` is
      // parsed as UTC midnight, while `new Date()` is the current instant.
      // In a UTC+2 timezone that made *today* count as "in the future"
      // between 00:00 and 02:00 local time. ISO date strings compare
      // correctly as plain strings.
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}`;
      return value <= today;
    }, "Geburtsdatum darf nicht in der Zukunft liegen"),
  gender: z.enum(genderValues).optional().or(z.literal("")),
});

export type ProfileInput = z.infer<typeof profileSchema>;
