import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "E-Mail ist erforderlich").email("Ungültige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort ist erforderlich"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().min(1, "E-Mail ist erforderlich").email("Ungültige E-Mail-Adresse"),
  password: z.string().min(6, "Passwort muss mindestens 6 Zeichen lang sein"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "E-Mail ist erforderlich").email("Ungültige E-Mail-Adresse"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Passwort muss mindestens 6 Zeichen lang sein"),
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
    .refine(
      (value) => !value || new Date(value) <= new Date(),
      "Geburtsdatum darf nicht in der Zukunft liegen"
    ),
  gender: z.enum(genderValues).optional().or(z.literal("")),
});

export type ProfileInput = z.infer<typeof profileSchema>;
