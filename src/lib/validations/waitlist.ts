import { z } from "zod";
import { desiredPlanValues, danceRoleValues } from "@/lib/constants/booking";

export const joinWaitlistSchema = z.object({
  course_id: z.string().uuid("Ungültiger Kurs"),
  desired_plan: z.enum(desiredPlanValues, { message: "Bitte wähle eine Abo-Art" }),
  chosen_date: z.string().min(1, "Bitte wähle einen Termin"),
  dance_role: z.enum(danceRoleValues).optional().or(z.literal("")),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
