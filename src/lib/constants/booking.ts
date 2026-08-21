export const bookingTypeValues = ["regular", "trial", "dropin"] as const;
export type BookingType = (typeof bookingTypeValues)[number];

export const bookingTypeLabel: Record<BookingType, string> = {
  regular: "Buchungsanfrage",
  trial: "Probestunde",
  dropin: "Drop-in",
};

export const bookingStatusValues = ["open", "confirmed", "rejected", "cancelled"] as const;
export type BookingStatus = (typeof bookingStatusValues)[number];

export const bookingStatusOptions: { value: BookingStatus; label: string; color: string }[] = [
  { value: "open", label: "Offen", color: "#e9c46a" },
  { value: "confirmed", label: "Bestätigt", color: "#2a9d8f" },
  { value: "rejected", label: "Abgelehnt", color: "#e63946" },
  { value: "cancelled", label: "Storniert", color: "#94a3b8" },
];

export function bookingStatusLabel(value: string): string {
  return bookingStatusOptions.find((o) => o.value === value)?.label ?? value;
}

export function bookingStatusColor(value: string): string {
  return bookingStatusOptions.find((o) => o.value === value)?.color ?? "#94a3b8";
}

export const desiredPlanValues = ["single_course", "flatrate"] as const;
export type DesiredPlan = (typeof desiredPlanValues)[number];

export const desiredPlanOptions: { value: DesiredPlan; label: string }[] = [
  { value: "single_course", label: "Nur diesen Kurs" },
  { value: "flatrate", label: "Flatrate (alle Kurse)" },
];

export function desiredPlanLabel(value: string | null): string {
  return desiredPlanOptions.find((o) => o.value === value)?.label ?? "—";
}

export const referralSourceValues = [
  "google",
  "social_media",
  "empfehlung",
  "website",
  "werbung",
  "sonstiges",
] as const;
export type ReferralSource = (typeof referralSourceValues)[number];

export const referralSourceOptions: { value: ReferralSource; label: string }[] = [
  { value: "google", label: "Google / Suchmaschine" },
  { value: "social_media", label: "Social Media" },
  { value: "empfehlung", label: "Empfehlung" },
  { value: "website", label: "Website" },
  { value: "werbung", label: "Werbung" },
  { value: "sonstiges", label: "Sonstiges" },
];

/** Days of lead time required to cancel/rebook a trial, drop-in, or open regular request. */
export const BOOKING_CANCELLATION_LEAD_DAYS = 1;

export const danceRoleValues = ["leader", "follower", "both"] as const;
export type DanceRole = (typeof danceRoleValues)[number];

export const danceRoleOptions: { value: DanceRole; label: string }[] = [
  { value: "leader", label: "Leader" },
  { value: "follower", label: "Follower" },
  { value: "both", label: "Beide" },
];

export function danceRoleLabel(value: string | null): string {
  return danceRoleOptions.find((o) => o.value === value)?.label ?? "keine Angabe";
}
