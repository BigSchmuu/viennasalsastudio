import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { hasConvertedSince } from "@/lib/trials/conversion";

export const newsletterGroupValues = ["alle", "aktive", "probestunde_ohne_folgebuchung", "kurs_teilnehmer"] as const;
export type NewsletterGroup = (typeof newsletterGroupValues)[number];

export const newsletterGroupLabel: Record<NewsletterGroup, string> = {
  alle: "Alle Kunden",
  aktive: "Aktive Kunden",
  probestunde_ohne_folgebuchung: "Probestunde ohne Folgebuchung",
  kurs_teilnehmer: "Kurs-Teilnehmer",
};

/**
 * Customer IDs for a newsletter recipient group — always computed live, never
 * stored (same pattern as the derived status values in PROJ-29/31/33). Shared
 * between the recipient-count preview and the actual send, so both always
 * agree on who's included.
 */
export async function resolveRecipientIds(
  supabase: SupabaseClient<Database>,
  group: NewsletterGroup,
  courseId?: string
): Promise<string[]> {
  switch (group) {
    case "alle": {
      const { data } = await supabase.from("profiles").select("id").eq("role", "customer");
      return (data ?? []).map((p) => p.id);
    }

    case "aktive": {
      const { data } = await supabase.from("subscriptions").select("customer_id").eq("status", "active");
      return Array.from(new Set((data ?? []).map((s) => s.customer_id)));
    }

    case "probestunde_ohne_folgebuchung": {
      // Only each customer's LATEST confirmed trial counts, per the spec wording
      // ("deren letzte Probestunden-Buchung...").
      const { data } = await supabase
        .from("course_bookings")
        .select("customer_id, chosen_date")
        .eq("type", "trial")
        .eq("status", "confirmed")
        .order("chosen_date", { ascending: false });

      const latestTrialByCustomer = new Map<string, string>();
      for (const booking of data ?? []) {
        if (!latestTrialByCustomer.has(booking.customer_id)) {
          latestTrialByCustomer.set(booking.customer_id, booking.chosen_date);
        }
      }

      const recipientIds: string[] = [];
      for (const [customerId, chosenDate] of latestTrialByCustomer) {
        const converted = await hasConvertedSince(supabase, customerId, chosenDate);
        if (!converted) recipientIds.push(customerId);
      }
      return recipientIds;
    }

    case "kurs_teilnehmer": {
      if (!courseId) return [];
      // Only OPEN regular bookings count alongside active subscriptions — a
      // "confirmed" booking's customer is already covered via their subscription
      // if it's still active, and if that subscription was later cancelled, the
      // booking's own status stays "confirmed" forever, which would otherwise
      // wrongly keep counting them as a CURRENT participant. Same convention as
      // the existing course occupancy calculation in src/app/admin/kurse/page.tsx.
      const [activeSubsRes, openBookingsRes] = await Promise.all([
        supabase.from("subscriptions").select("customer_id").eq("course_id", courseId).eq("status", "active"),
        supabase
          .from("course_bookings")
          .select("customer_id")
          .eq("course_id", courseId)
          .eq("type", "regular")
          .eq("status", "open"),
      ]);
      const ids = new Set<string>();
      for (const s of activeSubsRes.data ?? []) ids.add(s.customer_id);
      for (const b of openBookingsRes.data ?? []) ids.add(b.customer_id);
      return Array.from(ids);
    }
  }
}
