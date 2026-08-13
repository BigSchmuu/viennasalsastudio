import { z } from "zod";
import { levelValues } from "@/lib/constants/levels";

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
  content_video_url: z
    .string()
    .trim()
    .url("Bitte eine gültige URL eingeben")
    .optional()
    .or(z.literal("")),
  teacher_ids: z.array(z.string().uuid()),
});
export type CourseInput = z.infer<typeof courseSchema>;
