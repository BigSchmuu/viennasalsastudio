export const eventStatusValues = ["geplant", "abgesagt"] as const;
export type EventStatus = (typeof eventStatusValues)[number];

export const ticketPaymentMethodValues = ["sepa", "onsite"] as const;
export type TicketPaymentMethod = (typeof ticketPaymentMethodValues)[number];

export const ticketPaymentMethodLabel: Record<TicketPaymentMethod, string> = {
  sepa: "SEPA-Lastschrift",
  onsite: "Vor Ort zahlen",
};

export const ticketStatusValues = ["reserved", "confirmed", "checked_in", "cancelled"] as const;
export type TicketStatus = (typeof ticketStatusValues)[number];

export const ticketStatusOptions: { value: TicketStatus; label: string; color: string }[] = [
  { value: "reserved", label: "Reserviert", color: "#e9c46a" },
  { value: "confirmed", label: "Bestätigt", color: "#2a9d8f" },
  { value: "checked_in", label: "Eingecheckt", color: "#457b9d" },
  { value: "cancelled", label: "Storniert", color: "#94a3b8" },
];

export function ticketStatusLabel(value: string): string {
  return ticketStatusOptions.find((o) => o.value === value)?.label ?? value;
}

export function ticketStatusColor(value: string): string {
  return ticketStatusOptions.find((o) => o.value === value)?.color ?? "#94a3b8";
}

/** Days of lead time required to cancel a ticket — same policy as course bookings. */
export const TICKET_CANCELLATION_LEAD_DAYS = 1;
