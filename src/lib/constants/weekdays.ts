export const weekdayOptions: { value: number; label: string }[] = [
  { value: 0, label: "Montag" },
  { value: 1, label: "Dienstag" },
  { value: 2, label: "Mittwoch" },
  { value: 3, label: "Donnerstag" },
  { value: 4, label: "Freitag" },
  { value: 5, label: "Samstag" },
  { value: 6, label: "Sonntag" },
];

export function weekdayLabel(value: number): string {
  return weekdayOptions.find((o) => o.value === value)?.label ?? "—";
}
