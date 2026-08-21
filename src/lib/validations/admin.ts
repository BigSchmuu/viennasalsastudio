import { z } from "zod";
import { levelValues } from "@/lib/constants/levels";
import { subscriptionStatusValues } from "@/lib/constants/subscription-status";
import { getYoutubeVideoId } from "@/lib/youtube";

// Empty string is accepted here (an unfilled optional slot) — callers that
// require a value must chain `.min(1, ...)` or similar on top of this.
const youtubeUrlField = z
  .string()
  .trim()
  .refine((value) => value === "" || getYoutubeVideoId(value) !== null, {
    message: "Bitte eine gültige YouTube-URL eingeben",
  });

export const locationSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich").max(200),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
});
export type LocationInput = z.infer<typeof locationSchema>;

export const roomSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich").max(200),
  location_id: z.string().uuid("Bitte einen Standort wählen"),
});
export type RoomInput = z.infer<typeof roomSchema>;

export const danceStyleSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich").max(100),
});
export type DanceStyleInput = z.infer<typeof danceStyleSchema>;

export const courseSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich").max(200),
  dance_style_id: z.string().uuid("Bitte einen Tanzstil wählen"),
  level: z.enum(levelValues, { message: "Bitte ein Level wählen" }),
  room_id: z.string().uuid("Bitte einen Raum wählen"),
  video_set_id: z.string().uuid("Ungültiger Videosatz").optional().or(z.literal("")),
  teacher_ids: z.array(z.string().uuid()),
  max_participants: z
    .string()
    .trim()
    .refine((value) => value === "" || (Number.isInteger(Number(value)) && Number(value) > 0), {
      message: "Bitte eine gültige maximale Teilnehmerzahl eingeben",
    })
    .optional()
    .or(z.literal("")),
  price: z
    .string()
    .trim()
    .refine((value) => value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0), {
      message: "Bitte einen gültigen Preis eingeben",
    })
    .optional()
    .or(z.literal("")),
  prerequisite_note: z.string().trim().max(500, "Hinweis ist zu lang").optional().or(z.literal("")),
  role_query_enabled: z.boolean().optional(),
  max_role_difference: z
    .string()
    .trim()
    .refine((value) => value === "" || (Number.isInteger(Number(value)) && Number(value) >= 0), {
      message: "Bitte eine gültige maximale Differenz eingeben",
    })
    .optional()
    .or(z.literal("")),
});
export type CourseInput = z.infer<typeof courseSchema>;

export const videoSetSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich").max(200),
  level: z.enum(levelValues).optional().or(z.literal("")),
});
export type VideoSetInput = z.infer<typeof videoSetSchema>;

export const lessonSchema = z.object({
  title: z.string().trim().min(1, "Titel ist erforderlich").max(200),
  video_set_id: z.string().uuid("Ungültiger Videosatz"),
  video_urls: z.array(youtubeUrlField),
  customer_video_url: youtubeUrlField,
});
export type LessonInput = z.infer<typeof lessonSchema>;

export const subscriptionSchema = z.object({
  name: z.string().trim().min(1, "Name ist erforderlich").max(200),
  price: z
    .number({ message: "Bitte einen gültigen Preis eingeben" })
    .min(0, "Preis darf nicht negativ sein")
    .max(100000, "Preis ist zu hoch"),
  status: z.enum(subscriptionStatusValues, { message: "Bitte einen Status wählen" }),
  course_id: z.string().uuid("Ungültiger Kurs").optional().or(z.literal("")),
  cycle_anchor_date: z.string().trim().min(1, "Ankerdatum ist erforderlich"),
});
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

export const courseScheduleSchema = z
  .object({
    weekday: z.enum(["0", "1", "2", "3", "4", "5", "6"], {
      message: "Bitte einen Wochentag wählen",
    }),
    start_time: z.string().trim().min(1, "Startzeit ist erforderlich"),
    end_time: z.string().trim().min(1, "Endzeit ist erforderlich"),
  })
  .refine((data) => data.end_time > data.start_time, {
    message: "Endzeit muss nach der Startzeit liegen",
    path: ["end_time"],
  });
export type CourseScheduleInput = z.infer<typeof courseScheduleSchema>;

export const schedulePauseSchema = z.object({
  pause_date: z.string().trim().min(1, "Datum ist erforderlich"),
});
export type SchedulePauseInput = z.infer<typeof schedulePauseSchema>;

export const teacherInviteSchema = z.object({
  full_name: z.string().trim().min(1, "Name ist erforderlich").max(200),
  email: z.string().trim().min(1, "E-Mail ist erforderlich").email("Bitte eine gültige E-Mail-Adresse eingeben"),
});
export type TeacherInviteInput = z.infer<typeof teacherInviteSchema>;

export const invoiceSettingsSchema = z.object({
  company_name: z.string().trim().min(1, "Firmenname ist erforderlich").max(200),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  uid_number: z.string().trim().max(50).optional().or(z.literal("")),
  vat_rate: z
    .number({ message: "Bitte einen gültigen USt-Satz eingeben" })
    .min(0, "USt-Satz darf nicht negativ sein")
    .max(100, "USt-Satz darf 100% nicht übersteigen"),
});
export type InvoiceSettingsInput = z.infer<typeof invoiceSettingsSchema>;
