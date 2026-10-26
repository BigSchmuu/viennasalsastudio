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
// Schlüssel im Namensraum `auth`, keine fertigen Sätze (2026-09-13): Die
// Formulare übersetzen sie über `AuthFormMessage`. Vorher standen die
// deutschen Sätze auch auf der englischen Seite. `passwordHint` ist derselbe
// Text, der schon als Hinweis unter dem Feld steht.
const PASSWORT_HINWEIS = "passwordHint";

const neuesPasswort = z
  .string()
  .min(8, PASSWORT_HINWEIS)
  .regex(/[a-z]/, PASSWORT_HINWEIS)
  .regex(/[A-Z]/, PASSWORT_HINWEIS)
  .regex(/[0-9]/, PASSWORT_HINWEIS);

export const loginSchema = z.object({
  email: z.string().min(1, "valEmailRequired").email("valEmailInvalid"),
  password: z.string().min(1, "valPasswordRequired"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * PROJ-94: Vor- und Nachname sind bei der Registrierung Pflicht. Sie gehen als
 * Metadaten der Anmeldung mit und landen über `handle_new_user` im Profil —
 * geprüft wird hier, serverseitig, nicht im Formular.
 */
const nameFeld = (fehlend: string) =>
  z.string().trim().min(1, fehlend).max(100, "valNameTooLong");

export const registerSchema = z.object({
  email: z.string().min(1, "valEmailRequired").email("valEmailInvalid"),
  password: neuesPasswort,
  first_name: nameFeld("valFirstNameRequired"),
  last_name: nameFeld("valLastNameRequired"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "valEmailRequired").email("valEmailInvalid"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: neuesPasswort,
    confirmPassword: z.string().min(1, "valConfirmRequired"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "valPasswordsDiffer",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Passwort im angemeldeten Zustand ändern (PROJ-73).
 *
 * Das aktuelle Passwort hat hier **keine** Mindestanforderung: Es gilt die
 * Regel von damals, als es gesetzt wurde. Geprüft wird es ohnehin von Supabase
 * — eine Längenprüfung im Formular würde nur Bestandskunden mit kürzerem
 * Passwort aussperren, bevor überhaupt jemand nachsieht.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "valPasswordRequired"),
    password: neuesPasswort,
    confirmPassword: z.string().min(1, "valConfirmRequired"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "valPasswordsDiffer",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

const genderValues = ["weiblich", "maennlich", "divers", "keine_angabe"] as const;
export const genderOptions: { value: (typeof genderValues)[number]; label: string }[] = [
  { value: "weiblich", label: "Weiblich" },
  { value: "maennlich", label: "Männlich" },
  { value: "divers", label: "Divers" },
  { value: "keine_angabe", label: "Keine Angabe" },
];

export const profileSchema = z.object({
  // PROJ-94: Pflicht. Ohne das wäre die Pflicht bei der Registrierung eine
  // Formalität, die man eine Minute später rückgängig macht.
  first_name: z.string().trim().min(1, "valFirstNameRequired").max(100, "valNameTooLong"),
  last_name: z.string().trim().min(1, "valLastNameRequired").max(100, "valNameTooLong"),
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

/**
 * Dasselbe für die Verwaltung — mit **freiwilligem** Nachnamen (PROJ-94).
 *
 * An der Tür kennt man manchmal nur einen Namen. Eine Sperre würde dort die
 * Lehrkraft aufhalten, nicht die Daten verbessern; der Kunde selbst muss beides
 * angeben, weil er es bei der Registrierung schon getan hat.
 */
export const adminProfileSchema = profileSchema.extend({
  last_name: z.string().trim().max(100, "valNameTooLong").optional().or(z.literal("")),
});

export type AdminProfileInput = z.infer<typeof adminProfileSchema>;
