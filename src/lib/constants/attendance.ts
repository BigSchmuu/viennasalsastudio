export const attendanceStatusValues = ["present", "absent"] as const;
export type AttendanceStatus = (typeof attendanceStatusValues)[number];

export function attendanceStatusLabel(status: string | null): string {
  if (status === "present") return "Anwesend";
  if (status === "absent") return "Abwesend";
  return "Nicht markiert";
}

export const attendanceSourceLabel: Record<string, string> = {
  abo: "Abo",
  buchung: "Buchung",
  manuell: "Manuell",
};
