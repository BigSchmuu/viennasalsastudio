import { createClient } from "@/lib/supabase/server";
import { EventManager, type EventRow } from "@/components/admin/events/event-manager";
import type { SalesMode } from "@/lib/events/event-zustand";

export default async function AdminEventsPage() {
  const supabase = await createClient();

  const [eventsRes, artenRes] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, name, description, location, starts_at, ends_at, capacity, price_normal, price_student, status, sales_mode, slug, event_type_id, event_types(name), tickets(status)"
      )
      .order("starts_at", { ascending: false }),
    supabase.from("event_types").select("id, name").order("name", { ascending: true }),
  ]);

  if (eventsRes.error) {
    console.error("Events konnten nicht geladen werden", eventsRes.error);
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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-bold">Events</h2>
        <p className="text-sm text-muted-foreground">Partys, Workshops und andere Events anlegen, bearbeiten und absagen</p>
      </div>
      <EventManager events={events} eventTypes={artenRes.data ?? []} />
    </div>
  );
}
