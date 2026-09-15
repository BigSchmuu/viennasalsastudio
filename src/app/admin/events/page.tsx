import { createClient } from "@/lib/supabase/server";
import { EventManager, type EventRow } from "@/components/admin/events/event-manager";
import { SerienManager, type SerieRow } from "@/components/admin/events/serien-manager";
import type { SalesMode } from "@/lib/events/event-zustand";

export default async function AdminEventsPage() {
  const supabase = await createClient();

  const [eventsRes, serienRes, artenRes] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, name, description, location, starts_at, ends_at, capacity, price_normal, price_student, status, sales_mode, slug, event_type_id, event_types(name), tickets(status)"
      )
      // PROJ-54: Serientermine stehen bei ihrer Serie, nicht zwischen den
      // Einzelevents — sonst wäre die Liste von einer Party voll.
      .is("series_id", null)
      .order("starts_at", { ascending: false }),
    supabase
      .from("event_series")
      .select(
        "id, name, slug, description, location, weekday, start_time, end_time, starts_on, ends_on, pause_in_holidays, capacity, price_normal, price_student, sales_mode, status, event_type_id, event_types(name)"
      )
      .order("status", { ascending: true })
      .order("weekday", { ascending: true }),
    supabase.from("event_types").select("id, name").order("name", { ascending: true }),
  ]);

  if (eventsRes.error) {
    console.error("Events konnten nicht geladen werden", eventsRes.error);
  }
  if (serienRes.error) {
    console.error("Serien konnten nicht geladen werden", serienRes.error);
  }
  if (artenRes.error) {
    console.error("Eventarten konnten nicht geladen werden", artenRes.error);
  }

  const events: EventRow[] = (eventsRes.data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    location: e.location,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    capacity: e.capacity,
    priceNormal: e.price_normal,
    priceStudent: e.price_student,
    status: e.status,
    salesMode: e.sales_mode as SalesMode,
    slug: e.slug,
    eventTypeId: e.event_type_id,
    eventTypeName: e.event_types?.name ?? "—",
    ticketCount: e.tickets.filter((t) => t.status !== "cancelled").length,
  }));

  const serien: SerieRow[] = (serienRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    eventTypeId: s.event_type_id,
    eventTypeName: s.event_types?.name ?? "—",
    description: s.description,
    location: s.location,
    weekday: s.weekday,
    startTime: s.start_time,
    endTime: s.end_time,
    startsOn: s.starts_on,
    endsOn: s.ends_on,
    pauseInHolidays: s.pause_in_holidays,
    salesMode: s.sales_mode as SalesMode,
    capacity: s.capacity,
    priceNormal: s.price_normal,
    priceStudent: s.price_student,
    status: s.status,
  }));

  const arten = artenRes.data ?? [];

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-xl font-bold">Events</h2>
          <p className="text-sm text-muted-foreground">
            Einzelne Partys, Workshops und andere Events anlegen, bearbeiten und absagen
          </p>
        </div>
        <EventManager events={events} eventTypes={arten} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-heading text-xl font-bold">Serien</h2>
          <p className="text-sm text-muted-foreground">
            Regelmäßige Veranstaltungen — einmal angelegt, die Termine entstehen automatisch
          </p>
        </div>
        <SerienManager serien={serien} eventTypes={arten} />
      </section>
    </div>
  );
}
