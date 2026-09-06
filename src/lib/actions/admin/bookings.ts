"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { enqueueAndDispatch, enqueueNotification } from "@/lib/notifications/dispatch";
import type { ActionResult } from "@/lib/actions/types";
import { MAX_PRICE } from "@/lib/validations/booking";
import { STAPEL_MAX } from "@/lib/bookings/stapel";

export async function confirmRegularBooking(
  bookingId: string,
  formData: FormData
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const priceRaw = formData.get("price");
  const price = priceRaw === null || priceRaw === "" ? NaN : Number(priceRaw);

  if (!name) {
    return { error: "Name ist erforderlich" };
  }
  if (Number.isNaN(price) || price < 0) {
    return { error: "Bitte einen gültigen Preis eingeben" };
  }
  // PROJ-41: dieselbe Obergrenze wie in der Preisliste — ein Zahlendreher darf
  // auch hier nicht zu einem monatlichen Einzug in dieser Höhe führen.
  if (price > MAX_PRICE) {
    return { error: `Der Preis darf höchstens ${MAX_PRICE} € betragen` };
  }

  const { supabase } = await requireAdmin();

  const { data: booking } = await supabase
    .from("course_bookings")
    .select("id, customer_id, type, status, course_id, desired_plan, chosen_date")
    .eq("id", bookingId)
    .single();

  if (!booking || booking.type !== "regular" || booking.status !== "open") {
    return { error: "Buchung nicht gefunden oder nicht mehr offen." };
  }

  // PROJ-15: redeem (atomically, re-checked fresh) before the subscription
  // insert below — the RPC's own "customer never had a subscription" check
  // relies on the subscription not existing yet. A coupon that's since
  // become invalid (expired/exhausted/deactivated) is silently not redeemed;
  // the booking still gets confirmed either way.
  await supabase.rpc("redeem_coupon_for_booking", { p_booking_id: bookingId });

  const { data: subscription, error: subError } = await supabase
    .from("subscriptions")
    .insert({
      customer_id: booking.customer_id,
      name,
      price,
      status: "active",
      course_id: booking.desired_plan === "single_course" ? booking.course_id : null,
      cycle_anchor_date: booking.chosen_date,
    })
    .select("id")
    .single();

  if (subError || !subscription) {
    return { error: "Abo konnte nicht angelegt werden." };
  }

  const { error } = await supabase
    .from("course_bookings")
    .update({ status: "confirmed", subscription_id: subscription.id })
    .eq("id", bookingId);

  if (error) {
    return { error: "Buchung konnte nicht bestätigt werden." };
  }

  await enqueueAndDispatch({
    customerId: booking.customer_id,
    eventType: "buchungsstatus",
    payload: { booking_id: bookingId, new_status: "confirmed" },
    dedupeKey: `booking_status:${bookingId}:confirmed`,
  });

  revalidatePath("/admin/buchungen");
  revalidatePath("/admin/kunden");
  return { success: true };
}

export async function confirmDropinBooking(bookingId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { data: booking } = await supabase
    .from("course_bookings")
    .select("id, type, status, customer_id")
    .eq("id", bookingId)
    .single();

  if (!booking || booking.type !== "dropin" || booking.status !== "open") {
    return { error: "Buchung nicht gefunden oder nicht mehr offen." };
  }

  const { error } = await supabase
    .from("course_bookings")
    .update({ status: "confirmed" })
    .eq("id", bookingId);

  if (error) {
    return { error: "Buchung konnte nicht bestätigt werden." };
  }

  await enqueueAndDispatch({
    customerId: booking.customer_id,
    eventType: "buchungsstatus",
    payload: { booking_id: bookingId, new_status: "confirmed" },
    dedupeKey: `booking_status:${bookingId}:confirmed`,
  });

  revalidatePath("/admin/buchungen");
  return { success: true };
}

export async function rejectBooking(bookingId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { data: booking } = await supabase
    .from("course_bookings")
    .select("id, status, type, course_id, customer_id")
    .eq("id", bookingId)
    .single();

  if (!booking || booking.status !== "open") {
    return { error: "Buchung nicht gefunden oder nicht mehr offen." };
  }

  const { error } = await supabase
    .from("course_bookings")
    .update({ status: "rejected" })
    .eq("id", bookingId);

  if (error) {
    return { error: "Buchung konnte nicht abgelehnt werden." };
  }

  await enqueueAndDispatch({
    customerId: booking.customer_id,
    eventType: "buchungsstatus",
    payload: { booking_id: bookingId, new_status: "rejected" },
    dedupeKey: `booking_status:${bookingId}:rejected`,
  });

  if (booking.type === "regular" && booking.course_id) {
    const { error: promoteError } = await supabase.rpc("promote_waitlist_for_course", {
      p_course_id: booking.course_id,
    });
    if (promoteError) {
      console.error("promote_waitlist_for_course failed", promoteError);
    }
  }

  revalidatePath("/admin/buchungen");
  return { success: true };
}

/* ------------------------------------------------------------------------ *
 * PROJ-48: Stapelweise bearbeiten
 *
 * Beide Vorgaenge fuehren den Einzelweg je Buchung aus, statt einen eigenen
 * Vorgang ueber alle zu sein. Das kostet mehr Schritte, bringt aber drei
 * Dinge mit: Der ehrliche Bericht ergibt sich von selbst, ein veralteter
 * Bildschirm ueberschreibt keine fremde Arbeit, und es gibt keinen zweiten
 * Ort, an dem dieselben Regeln stehen.
 *
 * Die Nachrichten werden eingereiht statt sofort verschickt. Der sofortige
 * Weg ist genau eine Zeile ueber `enqueueAndDispatch` als "nicht fuer Stapel
 * geeignet" gekennzeichnet: Zwanzig E-Mail-Versuche nacheinander liessen die
 * Anfrage auflaufen. Der Cron-Lauf leert die Warteschlange ohnehin.
 * ------------------------------------------------------------------------ */

export type StapelAusgang =
  | { error: string }
  | {
      success: true;
      erledigt: number;
      uebersprungen: { buchungId: string; kundenname: string; grund: string }[];
    };

/** Eine Zeile aus der Vorschau: was der Betreiber gesehen hat, als er zusagte. */
export type StapelEintrag = {
  buchungId: string;
  aboName: string;
  preis: number;
};

function stapelVorpruefung(anzahl: number): string | null {
  if (anzahl === 0) return "Es ist keine Buchung ausgewählt.";
  if (anzahl > STAPEL_MAX) {
    return `Höchstens ${STAPEL_MAX} Buchungen auf einmal. Bitte in kleineren Schritten vorgehen.`;
  }
  return null;
}

/**
 * Mehrere offene Buchungen bestätigen.
 *
 * Name und Preis kommen aus der Vorschau, statt hier neu gerechnet zu werden.
 * Rechnete diese Funktion neu, koennte zwischen Ansehen und Bestaetigen ein
 * Gutschein ablaufen -- und es entstuende ein Abo zu einem Preis, den niemand
 * gesehen hat. Geprueft werden die Werte trotzdem, mit derselben Obergrenze
 * wie im Einzeldialog.
 */
export async function bestaetigeBuchungenStapel(
  eintraege: StapelEintrag[]
): Promise<StapelAusgang> {
  const vorpruefung = stapelVorpruefung(eintraege.length);
  if (vorpruefung) return { error: vorpruefung };

  for (const eintrag of eintraege) {
    if (!Number.isFinite(eintrag.preis) || eintrag.preis < 0) {
      return { error: "Ein Preis in der Auswahl ist ungültig." };
    }
    if (eintrag.preis > MAX_PRICE) {
      return { error: `Ein Preis in der Auswahl übersteigt ${MAX_PRICE} €.` };
    }
    if (!eintrag.aboName.trim()) {
      return { error: "Ein Abo-Name in der Auswahl fehlt." };
    }
  }

  const { supabase } = await requireAdmin();

  const { data: buchungen, error: leseFehler } = await supabase
    .from("course_bookings")
    .select("id, customer_id, type, status, course_id, desired_plan, chosen_date, profiles(full_name)")
    .in("id", eintraege.map((e) => e.buchungId));

  if (leseFehler) return { error: "Die Buchungen konnten nicht gelesen werden." };

  const buchungJeId = new Map((buchungen ?? []).map((b) => [b.id, b]));
  const uebersprungen: { buchungId: string; kundenname: string; grund: string }[] = [];
  let erledigt = 0;

  for (const eintrag of eintraege) {
    const buchung = buchungJeId.get(eintrag.buchungId);
    const kundenname = buchung?.profiles?.full_name ?? "Unbekannt";

    if (!buchung) {
      uebersprungen.push({ buchungId: eintrag.buchungId, kundenname, grund: "nicht mehr vorhanden" });
      continue;
    }
    // Je Buchung geprüft, nicht einmal für den Stapel: Sonst überschriebe ein
    // veralteter Bildschirm die Arbeit von jemand anderem.
    if (buchung.status !== "open") {
      uebersprungen.push({ buchungId: buchung.id, kundenname, grund: "war nicht mehr offen" });
      continue;
    }

    if (buchung.type === "regular") {
      // Vor dem Abo einlösen: Die Prüfung im Gutschein-Vorgang verlässt sich
      // darauf, dass es noch kein Abo gibt.
      await supabase.rpc("redeem_coupon_for_booking", { p_booking_id: buchung.id });

      const { data: abo, error: aboFehler } = await supabase
        .from("subscriptions")
        .insert({
          customer_id: buchung.customer_id,
          name: eintrag.aboName.trim(),
          price: eintrag.preis,
          status: "active",
          course_id: buchung.desired_plan === "single_course" ? buchung.course_id : null,
          cycle_anchor_date: buchung.chosen_date,
        })
        .select("id")
        .single();

      if (aboFehler || !abo) {
        uebersprungen.push({ buchungId: buchung.id, kundenname, grund: "Abo ließ sich nicht anlegen" });
        continue;
      }

      const { error } = await supabase
        .from("course_bookings")
        .update({ status: "confirmed", subscription_id: abo.id })
        .eq("id", buchung.id)
        .eq("status", "open");
      if (error) {
        uebersprungen.push({ buchungId: buchung.id, kundenname, grund: "Status ließ sich nicht setzen" });
        continue;
      }
    } else if (buchung.type === "dropin") {
      const { error } = await supabase
        .from("course_bookings")
        .update({ status: "confirmed" })
        .eq("id", buchung.id)
        .eq("status", "open");
      if (error) {
        uebersprungen.push({ buchungId: buchung.id, kundenname, grund: "Status ließ sich nicht setzen" });
        continue;
      }
    } else {
      // Probestunden entstehen bereits bestätigt und können hier nicht
      // auftauchen. Falls doch, wird nicht geraten.
      uebersprungen.push({ buchungId: buchung.id, kundenname, grund: "Art nicht stapelbar" });
      continue;
    }

    await enqueueNotification({
      customerId: buchung.customer_id,
      eventType: "buchungsstatus",
      payload: { booking_id: buchung.id, new_status: "confirmed" },
      dedupeKey: `booking_status:${buchung.id}:confirmed`,
    });
    erledigt++;
  }

  revalidatePath("/admin/buchungen");
  revalidatePath("/admin/kunden");
  return { success: true, erledigt, uebersprungen };
}

/** Mehrere offene Buchungen ablehnen. Bei jeder Art ein reiner Statuswechsel. */
export async function lehneBuchungenAbStapel(buchungIds: string[]): Promise<StapelAusgang> {
  const vorpruefung = stapelVorpruefung(buchungIds.length);
  if (vorpruefung) return { error: vorpruefung };

  const { supabase } = await requireAdmin();

  const { data: buchungen, error: leseFehler } = await supabase
    .from("course_bookings")
    .select("id, customer_id, type, status, course_id, profiles(full_name)")
    .in("id", buchungIds);

  if (leseFehler) return { error: "Die Buchungen konnten nicht gelesen werden." };

  const buchungJeId = new Map((buchungen ?? []).map((b) => [b.id, b]));
  const uebersprungen: { buchungId: string; kundenname: string; grund: string }[] = [];
  const kurseZumNachruecken = new Set<string>();
  let erledigt = 0;

  for (const id of buchungIds) {
    const buchung = buchungJeId.get(id);
    const kundenname = buchung?.profiles?.full_name ?? "Unbekannt";

    if (!buchung) {
      uebersprungen.push({ buchungId: id, kundenname, grund: "nicht mehr vorhanden" });
      continue;
    }
    if (buchung.status !== "open") {
      uebersprungen.push({ buchungId: id, kundenname, grund: "war nicht mehr offen" });
      continue;
    }

    const { error } = await supabase
      .from("course_bookings")
      .update({ status: "rejected" })
      .eq("id", id)
      .eq("status", "open");
    if (error) {
      uebersprungen.push({ buchungId: id, kundenname, grund: "Status ließ sich nicht setzen" });
      continue;
    }

    await enqueueNotification({
      customerId: buchung.customer_id,
      eventType: "buchungsstatus",
      payload: { booking_id: id, new_status: "rejected" },
      dedupeKey: `booking_status:${id}:rejected`,
    });

    if (buchung.type === "regular" && buchung.course_id) {
      kurseZumNachruecken.add(buchung.course_id);
    }
    erledigt++;
  }

  // Je Kurs einmal, nicht je Buchung: Werden fünf Anfragen desselben Kurses
  // abgelehnt, rückt die Warteliste einmal nach und füllt die frei gewordenen
  // Plätze — fünf Läufe hintereinander täten dasselbe, nur langsamer.
  for (const kursId of kurseZumNachruecken) {
    const { error } = await supabase.rpc("promote_waitlist_for_course", { p_course_id: kursId });
    if (error) console.error("promote_waitlist_for_course failed", error);
  }

  revalidatePath("/admin/buchungen");
  return { success: true, erledigt, uebersprungen };
}
