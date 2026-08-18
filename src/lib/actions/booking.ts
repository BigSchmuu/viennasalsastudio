"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { bookingSchema } from "@/lib/validations/booking";
import { upcomingOccurrences, daysUntil } from "@/lib/scheduling/dates";
import { BOOKING_CANCELLATION_LEAD_DAYS } from "@/lib/constants/booking";
import type { ActionResult } from "@/lib/actions/types";

type BookingRow = {
  id: string;
  type: string;
  status: string;
  chosenDate: string;
  desiredPlan: string | null;
  note: string | null;
  price: number | null;
  wantsStudentPrice: boolean | null;
};

type CreateBookingResult =
  | { error: string }
  | { needsMandate: true }
  | { full: true }
  | { success: true; booking: BookingRow };

const UPCOMING_OCCURRENCES_WINDOW = 8;

async function getValidOccurrenceDates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courseId: string
): Promise<string[]> {
  const { data: schedule } = await supabase
    .from("course_schedule")
    .select("weekday, course_schedule_pauses(pause_date)")
    .eq("course_id", courseId)
    .maybeSingle();

  if (!schedule) return [];

  const pauseDates = schedule.course_schedule_pauses.map((p) => p.pause_date);
  return upcomingOccurrences(schedule.weekday, { count: UPCOMING_OCCURRENCES_WINDOW, pauseDates });
}

export async function createBooking(formData: FormData): Promise<CreateBookingResult> {
  const parsed = bookingSchema.safeParse({
    course_id: formData.get("course_id"),
    type: formData.get("type"),
    chosen_date: formData.get("chosen_date"),
    desired_plan: formData.get("desired_plan") ?? "",
    note: formData.get("note") ?? "",
    wants_student_price: formData.get("wants_student_price") === "true",
    referral_source: formData.get("referral_source") ?? "",
    prerequisite_confirmed: formData.get("prerequisite_confirmed") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Nicht eingeloggt" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("referral_source")
    .eq("id", user.id)
    .single();

  if (!profile?.referral_source && !parsed.data.referral_source) {
    return { error: "Bitte gib an, wie du von uns erfahren hast." };
  }

  const { data: course } = await supabase
    .from("courses")
    .select("prerequisite_note")
    .eq("id", parsed.data.course_id)
    .single();

  if (course?.prerequisite_note && !parsed.data.prerequisite_confirmed) {
    return { error: "Bitte bestätige den Hinweis zu den Vorkenntnissen." };
  }

  if (parsed.data.type === "regular") {
    const { data: mandate } = await supabase
      .from("sepa_mandates")
      .select("id")
      .eq("customer_id", user.id)
      .is("revoked_at", null)
      .maybeSingle();
    if (!mandate) {
      return { needsMandate: true };
    }

    const { data: entryDates } = await supabase
      .from("course_entry_dates")
      .select("entry_date")
      .eq("course_id", parsed.data.course_id);
    const validEntryDates = new Set((entryDates ?? []).map((d) => d.entry_date));
    if (!validEntryDates.has(parsed.data.chosen_date)) {
      return { error: "Ungültiger Einstiegstermin." };
    }

    // Capacity check + insert happen atomically in one server-side function
    // (row-locked on the course) so two simultaneous requests can't both
    // claim the last free spot.
    const { data: booking, error } = await supabase.rpc("create_regular_course_booking", {
      p_course_id: parsed.data.course_id,
      p_desired_plan: parsed.data.desired_plan ?? "",
      p_chosen_date: parsed.data.chosen_date,
      p_note: parsed.data.note ?? "",
      p_prerequisite_confirmed: parsed.data.prerequisite_confirmed ?? false,
    });

    if (error) {
      if (error.message.includes("already requested")) {
        return { error: "Du hast bereits eine offene Anfrage für diesen Kurs." };
      }
      if (error.message.includes("course is full")) {
        return { full: true };
      }
      return { error: "Buchung konnte nicht gespeichert werden." };
    }
    if (!booking) {
      return { error: "Buchung konnte nicht gespeichert werden." };
    }

    if (!profile?.referral_source && parsed.data.referral_source) {
      await supabase
        .from("profiles")
        .update({ referral_source: parsed.data.referral_source })
        .eq("id", user.id);
    }

    revalidatePath("/kurse");
    revalidatePath("/profil");
    return {
      success: true,
      booking: {
        id: booking.id,
        type: booking.type,
        status: booking.status,
        chosenDate: booking.chosen_date,
        desiredPlan: booking.desired_plan,
        note: booking.note,
        price: booking.price,
        wantsStudentPrice: booking.wants_student_price,
      },
    };
  }

  const validDates = await getValidOccurrenceDates(supabase, parsed.data.course_id);
  if (!validDates.includes(parsed.data.chosen_date)) {
    return { error: "Ungültiger Termin." };
  }

  // Write happens server-side in a SECURITY DEFINER function (not a direct
  // client insert) so the prerequisite-confirmation check and price
  // computation can't be bypassed via a direct API call.
  const { data: booking, error } = await supabase.rpc("create_self_service_booking", {
    p_course_id: parsed.data.course_id,
    p_type: parsed.data.type,
    p_chosen_date: parsed.data.chosen_date,
    p_wants_student_price: parsed.data.type === "dropin" ? parsed.data.wants_student_price ?? false : false,
    p_prerequisite_confirmed: parsed.data.prerequisite_confirmed ?? false,
  });

  if (error || !booking) {
    return { error: "Buchung konnte nicht gespeichert werden." };
  }

  if (!profile?.referral_source && parsed.data.referral_source) {
    await supabase
      .from("profiles")
      .update({ referral_source: parsed.data.referral_source })
      .eq("id", user.id);
  }

  revalidatePath("/kurse");
  revalidatePath("/profil");
  return {
    success: true,
    booking: {
      id: booking.id,
      type: booking.type,
      status: booking.status,
      chosenDate: booking.chosen_date,
      desiredPlan: booking.desired_plan,
      note: booking.note,
      price: booking.price,
      wantsStudentPrice: booking.wants_student_price,
    },
  };
}

export async function cancelBooking(bookingId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Nicht eingeloggt" };
  }

  const { data: booking } = await supabase
    .from("course_bookings")
    .select("id, customer_id, chosen_date, status")
    .eq("id", bookingId)
    .single();

  if (!booking || booking.customer_id !== user.id) {
    return { error: "Buchung nicht gefunden." };
  }
  if (booking.status === "cancelled" || booking.status === "rejected") {
    return { error: "Diese Buchung ist bereits storniert oder abgelehnt." };
  }
  if (daysUntil(booking.chosen_date) < BOOKING_CANCELLATION_LEAD_DAYS) {
    return { error: "Die Frist zum Stornieren ist abgelaufen." };
  }

  const { error } = await supabase
    .from("course_bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId);

  if (error) {
    return { error: "Buchung konnte nicht storniert werden." };
  }

  revalidatePath("/profil");
  return { success: true };
}

type RebookResult = { error: string } | { success: true; booking: BookingRow };

export async function rebookBooking(bookingId: string, newDate: string): Promise<RebookResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Nicht eingeloggt" };
  }

  const { data: booking } = await supabase
    .from("course_bookings")
    .select("id, customer_id, course_id, type, chosen_date, status, wants_student_price")
    .eq("id", bookingId)
    .single();

  if (!booking || booking.customer_id !== user.id) {
    return { error: "Buchung nicht gefunden." };
  }
  if (booking.type === "regular") {
    return { error: "Reguläre Anfragen können nicht umgebucht werden." };
  }
  if (booking.status === "cancelled" || booking.status === "rejected") {
    return { error: "Diese Buchung ist bereits storniert oder abgelehnt." };
  }
  if (daysUntil(booking.chosen_date) < BOOKING_CANCELLATION_LEAD_DAYS) {
    return { error: "Die Frist zum Umbuchen ist abgelaufen." };
  }

  const validDates = await getValidOccurrenceDates(supabase, booking.course_id);
  if (!validDates.includes(newDate)) {
    return { error: "Ungültiger Termin." };
  }

  // Rebooking only changes the date of an already-accepted trial/dropin
  // booking — it isn't a fresh prerequisite decision, so the confirmation
  // from the original booking still applies here.
  const { data: newBooking, error: insertError } = await supabase.rpc("create_self_service_booking", {
    p_course_id: booking.course_id,
    p_type: booking.type,
    p_chosen_date: newDate,
    p_wants_student_price: booking.wants_student_price ?? false,
    p_prerequisite_confirmed: true,
  });

  if (insertError || !newBooking) {
    return { error: "Umbuchung konnte nicht gespeichert werden." };
  }

  await supabase.from("course_bookings").update({ status: "cancelled" }).eq("id", bookingId);

  revalidatePath("/profil");
  return {
    success: true,
    booking: {
      id: newBooking.id,
      type: newBooking.type,
      status: newBooking.status,
      chosenDate: newBooking.chosen_date,
      desiredPlan: newBooking.desired_plan,
      note: newBooking.note,
      price: newBooking.price,
      wantsStudentPrice: newBooking.wants_student_price,
    },
  };
}
