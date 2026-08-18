import { createClient } from "@/lib/supabase/server";
import { EventManager, type EventRow } from "@/components/admin/events/event-manager";

export default async function AdminEventsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("events")
    .select("id, name, description, location, starts_at, ends_at, capacity, price_normal, price_student, status, tickets(status)")
    .order("starts_at", { ascending: false });

  const events: EventRow[] = (data ?? []).map((e) => ({
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
    ticketCount: e.tickets.filter((t) => t.status !== "cancelled").length,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-bold">Events</h2>
        <p className="text-sm text-muted-foreground">Events & Workshops anlegen, bearbeiten und absagen</p>
      </div>
      <EventManager events={events} />
    </div>
  );
}
