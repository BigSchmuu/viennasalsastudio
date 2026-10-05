export const attendanceStatusValues = ["present", "absent"] as const;
export type AttendanceStatus = (typeof attendanceStatusValues)[number];

export function attendanceStatusLabel(status: string | null): string {
  if (status === "present") return "Anwesend";
  if (status === "absent") return "Abwesend";
  return "Nicht markiert";
}

export const attendanceSourceLabel: Record<string, string> = {
  abo: "Abo",
  // PROJ-74: Probestunde und Drop-In getrennt — fuer die Lehrkraft am
  // Kursabend der entscheidende Unterschied. `buchung` bleibt stehen, weil die
  // Datenbank diesen Wert bis zum Einspielen der Migration noch liefert.
  probestunde: "Probestunde",
  dropin: "Drop-In",
  buchung: "Buchung",
  manuell: "Manuell",
  // PROJ-60: Damit die Lehrkraft weiss, warum jemand da ist, den sie nicht
  // aus dem Kurs kennt — und damit ein Gastabend beim Nachrechnen nicht wie
  // ein bezahlter Platz aussieht.
  gast: "Gast",
};
