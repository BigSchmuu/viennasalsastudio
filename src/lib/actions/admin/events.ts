"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { eventSchema, createEventSchema, type EventInput } from "@/lib/validations/events";
import { enqueueNotification } from "@/lib/notifications/dispatch";
import { eindeutigeAdresse, eventAdresse } from "@/lib/events/adresse";
import type { ActionResult } from "@/lib/actions/types";

type AdminSupabase = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

const GUELTIGE_TICKETS = ["reserved", "confirmed", "checked_in"];

function parseEventFormData(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description"),
    location: formData.get("location"),
    event_type_id: formData.get("event_type_id"),
    sales_mode: formData.get("sales_mode"),
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at"),
    capacity: formData.get("capacity"),
    price_normal: formData.get("price_normal"),
    price_student: formData.get("price_student"),
  };
}

function zahlOderNull(wert: string | undefined): number | null {
  return wert ? Number(wert) : null;
}

/**
 * Die Spalten aus dem Formular. Bei „Nur anzeigen" bleiben Kapazität und Preise
 * leer, wenn der Admin nichts einträgt — das Schema erlaubt es nur dort.
 */
function eventSpalten(data: EventInput) {
  return {
    name: data.name,
    description: data.description || null,
    location: data.location || null,
    event_type_id: data.event_type_id,
    sales_mode: data.sales_mode,
    starts_at: data.starts_at,
    ends_at: data.ends_at || null,
    capacity: zahlOderNull(data.capacity),
    price_normal: zahlOderNull(data.price_normal),
    price_student: zahlOderNull(data.price_student),
  };
}

/**
 * Alle Adressen, die mit `basis` beginnen — aktuelle und frühere, ausgenommen
 * die des Events `eigenesEvent`. Frühere zählen mit: Bekäme ein neues Event die
 * alte Adresse eines umbenannten, führten dessen geteilte Links aufs falsche.
 */
async function vergebeneAdressen(
  supabase: AdminSupabase,
  basis: string,
  eigenesEvent?: string
): Promise<Set<string> | null> {
  const [aktuell, frueher] = await Promise.all([
    supabase.from("events").select("id, slug").like("slug", `${basis}%`),
    supabase.from("event_previous_slugs").select("event_id, slug").like("slug", `${basis}%`),
  ]);
  if (aktuell.error || frueher.error) {
    console.error("Event-Adressen konnten nicht geprüft werden", aktuell.error ?? frueher.error);
    return null;
  }
  return new Set([
    ...(aktuell.data ?? []).filter((zeile) => zeile.id !== eigenesEvent).map((zeile) => zeile.slug),
    ...(frueher.data ?? []).filter((zeile) => zeile.event_id !== eigenesEvent).map((zeile) => zeile.slug),
  ]);
}

function neuLaden(...adressen: string[]) {
  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/mein-bereich");
  for (const adresse of adressen) {
    revalidatePath(`/events/${adresse}`);
  }
}

export async function createEvent(formData: FormData): Promise<ActionResult> {
  const parsed = createEventSchema.safeParse(parseEventFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();
  const basis = eventAdresse(parsed.data.name);

  // Zwei Versuche: Legt jemand gleichzeitig ein Event mit demselben Namen an,
  // ist die eben berechnete Adresse beim Speichern schon vergeben. Die
  // Datenbank lehnt dann ab, und der zweite Versuch nimmt die nächste freie.
  for (let versuch = 0; versuch < 2; versuch++) {
    const vergeben = await vergebeneAdressen(supabase, basis);
    if (!vergeben) {
      return { error: "Event konnte nicht angelegt werden." };
    }
    const slug = eindeutigeAdresse(basis, vergeben);

    const { error } = await supabase.from("events").insert({ ...eventSpalten(parsed.data), slug });
    if (!error) {
      neuLaden(slug);
      return { success: true };
    }
    if (error.code !== "23505") {
      console.error("Event konnte nicht angelegt werden", error);
      return { error: "Event konnte nicht angelegt werden." };
    }
  }

  return { error: "Event konnte nicht angelegt werden. Bitte noch einmal speichern." };
}

export async function updateEvent(eventId: string, formData: FormData): Promise<ActionResult> {
  const parsed = eventSchema.safeParse(parseEventFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe" };
  }

  const { supabase } = await requireAdmin();

  const { data: bisher, error: ladeFehler } = await supabase
    .from("events")
    .select("name, slug, sales_mode")
    .eq("id", eventId)
    .maybeSingle();
  if (ladeFehler || !bisher) {
    return { error: "Event nicht gefunden." };
  }

  // Mit verkauften Tickets auf „Nur anzeigen" umzustellen, hinterließe gültige
  // Tickets für ein Event ohne Ticketverkauf. Die Datenbank sperrt das ebenfalls;
  // hier bekommt der Admin die Zahl dazu.
  if (parsed.data.sales_mode === "display" && bisher.sales_mode !== "display") {
    const { count, error } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .in("status", GUELTIGE_TICKETS);
    if (error) {
      return { error: "Event konnte nicht gespeichert werden." };
    }
    if ((count ?? 0) > 0) {
      const verkauft = count === 1 ? "ist schon 1 Ticket" : `sind schon ${count} Tickets`;
      return {
        error: `Für dieses Event ${verkauft} verkauft. „Nur anzeigen" ist erst möglich, wenn keine gültigen Tickets mehr bestehen.`,
      };
    }
  }

  // Eine neue Adresse nur, wenn sich der Name so ändert, dass auch die Adresse
  // anders lautet. Groß-/Kleinschreibung oder ein Satzzeichen ändern keinen Link.
  let slug = bisher.slug;
  const basis = eventAdresse(parsed.data.name);
  if (basis !== eventAdresse(bisher.name)) {
    const vergeben = await vergebeneAdressen(supabase, basis, eventId);
    if (!vergeben) {
      return { error: "Event konnte nicht gespeichert werden." };
    }
    slug = eindeutigeAdresse(basis, vergeben);

    // Die alte Adresse zuerst merken: Scheitert danach das Speichern, zeigt
    // der Merkeintrag auf dasselbe Event und schadet nicht. Andersherum gäbe
    // es einen Moment, in dem geteilte Links ins Leere führen.
    const { error: merkFehler } = await supabase
      .from("event_previous_slugs")
      .insert({ event_id: eventId, slug: bisher.slug });
    if (merkFehler && merkFehler.code !== "23505") {
      console.error("Frühere Event-Adresse konnte nicht gespeichert werden", merkFehler);
      return { error: "Event konnte nicht gespeichert werden." };
    }
  }

  const { error } = await supabase
    .from("events")
    .update({ ...eventSpalten(parsed.data), slug })
    .eq("id", eventId);

  if (error) {
    if (error.code === "23505") {
      return { error: "Die neue Adresse wurde gerade vergeben. Bitte noch einmal speichern." };
    }
    console.error("Event konnte nicht gespeichert werden", error);
    return { error: "Event konnte nicht gespeichert werden." };
  }

  // Wird ein Event auf einen früheren Namen zurückbenannt, ist dessen Adresse
  // wieder die aktuelle und gehört nicht mehr in die Liste der früheren.
  if (slug !== bisher.slug) {
    await supabase.from("event_previous_slugs").delete().eq("event_id", eventId).eq("slug", slug);
  }

  neuLaden(slug, bisher.slug);
  return { success: true };
}

export async function cancelEvent(eventId: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.from("events").update({ status: "abgesagt" }).eq("id", eventId);

  if (error) {
    return { error: "Event konnte nicht abgesagt werden." };
  }

  const { data: activeTickets } = await supabase
    .from("tickets")
    .select("id, customer_id")
    .eq("event_id", eventId)
    .in("status", ["reserved", "confirmed"]);

  await Promise.all(
    (activeTickets ?? []).map((t) =>
      enqueueNotification({
        customerId: t.customer_id,
        eventType: "event_tickets",
        payload: { sub_type: "event_cancelled", event_id: eventId },
        dedupeKey: `event_ticket_cancelled:${t.id}`,
      })
    )
  );

  neuLaden();
  return { success: true };
}

export type EventGuestRow = {
  id: string;
  customerId: string;
  customerName: string;
  paymentMethod: string;
  status: string;
  price: number;
  checkedInAt: string | null;
};

export async function getEventGuestList(eventId: string): Promise<EventGuestRow[]> {
  const { supabase } = await requireAdmin();

  const { data } = await supabase
    .from("tickets")
    .select("id, customer_id, payment_method, status, price, checked_in_at, profiles(full_name)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  return (data ?? []).map((t) => ({
    id: t.id,
    customerId: t.customer_id,
    customerName: t.profiles?.full_name ?? "—",
    paymentMethod: t.payment_method,
    status: t.status,
    price: t.price,
    checkedInAt: t.checked_in_at,
  }));
}
