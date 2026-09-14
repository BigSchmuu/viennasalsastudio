import { createClient } from "@/lib/supabase/server";
import { EventTypeManager, type EventTypeRow } from "@/components/admin/event-types/event-type-manager";

export default async function EventTypesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("event_types")
    .select("id, name, events(count)")
    .order("name", { ascending: true });

  // Ohne diese Prüfung sähe eine gescheiterte Abfrage genauso aus wie „noch
  // keine Eventarten" — und der Admin legte doppelt an.
  if (error) {
    console.error("Eventarten konnten nicht geladen werden", error);
  }

  const eventTypes: EventTypeRow[] = (data ?? []).map((art) => ({
    id: art.id,
    name: art.name,
    eventCount: art.events[0]?.count ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-bold">Eventarten</h2>
        <p className="text-sm text-muted-foreground">
          Arten wie Party oder Workshop — sie erscheinen als Label und Filter im Veranstaltungsprogramm
        </p>
      </div>
      <EventTypeManager eventTypes={eventTypes} />
    </div>
  );
}
