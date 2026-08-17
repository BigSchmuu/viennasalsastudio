export const levelValues = [
  "beginner",
  "improver",
  "intermediate",
  "advanced",
  "open_level",
] as const;

export type Level = (typeof levelValues)[number];

export const levelOptions: { value: Level; label: string; color: string }[] = [
  { value: "beginner", label: "Beginner", color: "#2a9d8f" },
  { value: "improver", label: "Improver", color: "#457b9d" },
  { value: "intermediate", label: "Intermediate", color: "#e9c46a" },
  { value: "advanced", label: "Advanced", color: "#e63946" },
  { value: "open_level", label: "Open Level", color: "#8d5cf6" },
];

export function levelLabel(value: string | null): string {
  return levelOptions.find((o) => o.value === value)?.label ?? "—";
}

export function levelColor(value: string | null): string {
  return levelOptions.find((o) => o.value === value)?.color ?? "#94a3b8";
}

/** Tinted pill style (translucent level-colored background, level-colored text/border) —
 * matches the level tag styling on the marketing website's course cards. */
export function levelBadgeStyle(value: string | null): { backgroundColor: string; color: string; borderColor: string } {
  const color = levelColor(value);
  return { backgroundColor: `${color}2e`, color, borderColor: `${color}59` };
}
