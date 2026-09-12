"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ladeFerien, kurszeitraum } from "@/lib/scheduling/ferien";
import { bookingSchema } from "@/lib/validations/booking";
import { upcomingOccurrences, daysUntil } from "@/lib/scheduling/dates";
import { BOOKING_CANCELLATION_LEAD_DAYS } from "@/lib/constants/booking";
import { notifyAdminsOfNewBooking } from "@/lib/notifications/admin-alerts";
import { AGB_VERSION } from "@/lib/legal";
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
  couponId: string | null;
};

type CreateBookingResult =
  | { error: string }
  | { needsMandate: true }
  | { full: true }
  | { roleImbalance: true }
  | { success: true; booking: BookingRow };

const UPCOMING_OCCURRENCES_WINDOW = 8;

async function getValidOccurrenceDates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  courseId: string
): Promise<string[]> {
  const [{ data: schedule }, { data: kurs }, ferien] = await Promise.all([
    supabase
      .from("course_schedule")
      .select("weekday, course_schedule_pauses(pause_date)")
      .eq("course_id", courseId)
      .maybeSingle(),
    // PROJ-51: Ein Termin außerhalb des Kurszeitraums ist kein gültiger
    // Einstiegstermin — sonst böte der Buchungsdialog Daten an, an denen
    // nichts stattfindet.
    supabase.from("courses").select("runs_from, runs_until").eq("id", courseId).maybeSingle(),
    ladeFerien(supabase),
  ]);

  if (!schedule) return [];

  const pauseDates = schedule.course_schedule_pauses.map((p) => p.pause_date);
  return upcomingOccurrences(schedule.weekday, {
    count: UPCOMING_OCCURRENCES_WINDOW,
    pauseDates,
    zeitraum: kurszeitraum(kurs ?? {}),
    ferien,
  });
}

export async function createBooking(formData: FormData): Promise<CreateBookingResult> {
  const parsed = bookingSchema.safeParse({
    course_id: formData.get("course_id"),
    type: formData.get("type"),
    chosen_date: formData.get("chosen_date"),
    desired_plan: formData.get("desired_plan") ?? "",
    note: formData.get("note") ?? "",
    wants_student_price: formData.get("wants_student_price") === "true",
    // PROJ-42: Nur ob zugestimmt wurde, kommt vom Browser — das ist die
    // Handlung des Kunden. Welcher Stand galt, setzt der Server unten selbst.
    terms_accepted: formData.get("terms_accepted") === "true",
    referral_source: formData.get("referral_source") ?? "",
    prerequisite_confirmed: formData.get("prerequisite_confirmed") === "true",
    dance_role: formData.get("dance_role") ?? "",
    coupon_code: formData.get("coupon_code") ?? "",
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
      p_dance_role: parsed.data.dance_role ?? "",
      p_coupon_code: parsed.data.coupon_code ?? "",
      // PROJ-41: nur der Wunsch — den Preis dazu ermittelt die Funktion selbst.
      p_wants_student_price: parsed.data.wants_student_price ?? false,
      p_terms_accepted: parsed.data.terms_accepted ?? false,
      p_terms_version: AGB_VERSION,
    });

    if (error) {
      if (error.message.includes("terms not accepted")) {
        return { error: "Bitte bestätige zuerst die AGB." };
      }
      if (error.message.includes("dance role required")) {
        return { error: "Bitte wähle, ob du als Leader oder Follower tanzt." };
      }
      if (error.message.includes("flatrate covers this")) {
        // PROJ-50: Die Oberfläche bietet einem Flatrate-Kunden den
        // Buchungsdialog nicht mehr an; diese Meldung greift, wenn der Aufruf
        // trotzdem hier ankommt — etwa aus einem alten, offenen Tab.
        return {
          error:
            "Deine Flatrate deckt diesen Kurs bereits ab — trag dich direkt beim Kurs ein, dann entsteht kein zweites Abo.",
        };
      }
      if (error.message.includes("already enrolled")) {
        return { error: "Du bist für diesen Kurs bereits angemeldet." };
      }
      if (error.message.includes("already requested")) {
        return { error: "Du hast diesen Kurs bereits gebucht — die Bestätigung steht noch aus." };
      }
      if (error.message.includes("course is full")) {
        return { full: true };
      }
      if (error.message.includes("role imbalance")) {
        return { roleImbalance: true };
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

    // PROJ-39: alert the admins — but only after this response has gone out.
    // A booking must never be slowed down (or fail) because the operator is
    // being notified; see PROJ-12, where a synchronous send made the
    // triggering action noticeably sluggish.
    after(() => notifyAdminsOfNewBooking(booking.id));

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
        couponId: booking.coupon_id,
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
    p_terms_accepted: parsed.data.terms_accepted ?? false,
    p_terms_version: AGB_VERSION,
    // PROJ-52: Auch bei Probestunde und Drop-in. Vorher verlangte der Dialog
    // die Rolle und warf sie weg — dabei liest der Lehrer sie gerade beim Gast.
    p_dance_role: parsed.data.dance_role ?? "",
  });

  if (error) {
    // PROJ-39 BUG-1: the guards live in the RPC because the abuse path bypasses
    // this action entirely — but a customer who simply double-clicked deserves
    // a real explanation rather than "could not be saved".
    // PROJ-52: Die Oberfläche bietet einem Kunden mit verbrauchter Probestunde
    // keinen Buchungsknopf mehr an. Diese Meldungen greifen, wenn der Aufruf
    // trotzdem hier ankommt — aus einem alten Tab oder direkt.
    if (error.message.includes("trial already used")) {
      return { error: "Du hast deine Probestunde bereits verbraucht." };
    }
    if (error.message.includes("trial already booked")) {
      return {
        error:
          "Du hast schon eine Probestunde gebucht. Du kannst sie auf diesen Kurs oder einen anderen Termin umbuchen.",
      };
    }
    if (error.message.includes("terms not accepted")) {
      return { error: "Bitte bestätige zuerst die AGB." };
    }
    if (error.message.includes("already booked")) {
      return { error: "Du hast diesen Termin bereits gebucht." };
    }
    if (error.message.includes("booking rate limit")) {
      return { error: "Du hast in kurzer Zeit sehr viele Termine gebucht. Bitte versuche es später noch einmal." };
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

  // PROJ-39: only bookings that actually wait for a decision are worth an
  // alert. Trials are auto-confirmed by the RPC and therefore never "open" —
  // keying on the status means no separate exception is needed for them.
  if (booking.status === "open") {
    after(() => notifyAdminsOfNewBooking(booking.id));
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
      couponId: null,
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
  // Die Frist gilt für zugesagte Buchungen — sie schützt einen Platz, der für
  // jemanden freigehalten wird. Eine offene Anfrage hat noch niemand
  // angenommen; wer sie zurückziehen will, soll das jederzeit können. Der
  // Bildschirm hält sich an dieselbe Regel (profil/page.tsx).
  if (
    booking.status !== "open" &&
    daysUntil(booking.chosen_date) < BOOKING_CANCELLATION_LEAD_DAYS
  ) {
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

export async function rebookBooking(
  bookingId: string,
  newDate: string,
  termsAccepted: boolean,
  /**
   * PROJ-52: Zielkurs, falls die Probestunde auf einen anderen Kurs wandert.
   * Fehlt er, bleibt sie in ihrem Kurs und nur der Termin ändert sich.
   */
  newCourseId?: string,
  /** Vorkenntnis-Hinweis des **Zielkurses**, falls er einen hat. */
  prerequisiteConfirmed?: boolean
): Promise<RebookResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Nicht eingeloggt" };
  }
  // PROJ-42: Auch beim Umbuchen entsteht ein neuer Buchungsdatensatz, und der
  // trägt seine eigene Zustimmung. Der frühere Sonderweg, die Zustimmung der
  // Ursprungsbuchung zu übernehmen, war eine Hintertür — siehe Migration
  // 20260824_proj42_close_carry_terms_bypass.
  if (!termsAccepted) {
    return { error: "Bitte bestätige zuerst die AGB." };
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

  // PROJ-52: Der Zielkurs kann ein anderer sein — dann gilt sein Terminraster,
  // nicht das des alten Kurses.
  const zielKursId = newCourseId ?? booking.course_id;
  const validDates = await getValidOccurrenceDates(supabase, zielKursId);
  if (!validDates.includes(newDate)) {
    return { error: "Ungültiger Termin." };
  }

  // Beim Wechsel in einen anderen Kurs ist der Vorkenntnis-Hinweis eine neue
  // Entscheidung: Der des alten Kurses sagt nichts über den neuen. Bleibt der
  // Kurs derselbe, gilt die Bestätigung von damals weiter.
  const { data: zielKurs } = await supabase
    .from("courses")
    .select("prerequisite_note")
    .eq("id", zielKursId)
    .single();
  const hinweisBestaetigt =
    zielKursId === booking.course_id ? true : prerequisiteConfirmed === true;
  if (zielKurs?.prerequisite_note && !hinweisBestaetigt) {
    return { error: "Bitte bestätige den Hinweis zu den Vorkenntnissen." };
  }

  // Stornieren und neu buchen in **einem** Vorgang (PROJ-52).
  //
  // Vorher lief es in zwei Schritten, und das ging aus zwei Gründen nicht mehr:
  // Mit der Regel „eine Probestunde je Kunde" hätte das Einfügen an der noch
  // aktiven alten Buchung scheitern müssen. Und schon vorher steckte darin ein
  // Fehler — schlug das Stornieren fehl, hatte der Kunde zwei Buchungen.
  const { data: newBooking, error: insertError } = await supabase.rpc(
    "rebook_self_service_booking",
    {
      p_booking_id: bookingId,
      p_course_id: zielKursId,
      p_chosen_date: newDate,
      p_prerequisite_confirmed: hinweisBestaetigt,
      p_terms_accepted: true,
      p_terms_version: AGB_VERSION,
    }
  );

  if (insertError?.message.includes("already booked")) {
    return { error: "Für diesen Termin hast du bereits eine Buchung." };
  }
  if (insertError?.message.includes("booking rate limit")) {
    return { error: "Zu viele Buchungen in kurzer Zeit. Bitte versuch es später noch einmal." };
  }
  if (insertError || !newBooking) {
    return { error: "Umbuchung konnte nicht gespeichert werden." };
  }

  revalidatePath("/profil");
  revalidatePath("/kurse");
  revalidatePath("/stundenplan");
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
      couponId: null,
    },
  };
}
