import { z } from "zod";
import { attendanceStatusValues } from "@/lib/constants/attendance";

export const markAttendanceSchema = z.object({
  course_id: z.string().uuid("Ungültiger Kurs"),
  customer_id: z.string().uuid("Ungültiger Kunde"),
  occurrence_date: z.string().min(1, "Datum ist erforderlich"),
  status: z.enum(attendanceStatusValues, { message: "Ungültiger Status" }),
});
export type MarkAttendanceInput = z.infer<typeof markAttendanceSchema>;

export const sessionNoteSchema = z.object({
  course_id: z.string().uuid("Ungültiger Kurs"),
  occurrence_date: z.string().min(1, "Datum ist erforderlich"),
  note: z.string().trim().max(2000, "Notiz ist zu lang"),
});
export type SessionNoteInput = z.infer<typeof sessionNoteSchema>;
