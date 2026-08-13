export const subscriptionStatusValues = ["active", "paused", "cancelled"] as const;

export type SubscriptionStatus = (typeof subscriptionStatusValues)[number];

export const subscriptionStatusOptions: { value: SubscriptionStatus; label: string; color: string }[] = [
  { value: "active", label: "Aktiv", color: "#2a9d8f" },
  { value: "paused", label: "Pausiert", color: "#e9c46a" },
  { value: "cancelled", label: "Gekündigt", color: "#94a3b8" },
];

export function subscriptionStatusLabel(value: string | null): string {
  return subscriptionStatusOptions.find((o) => o.value === value)?.label ?? "—";
}

export function subscriptionStatusColor(value: string | null): string {
  return subscriptionStatusOptions.find((o) => o.value === value)?.color ?? "#94a3b8";
}
