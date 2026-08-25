import { createClient } from "@/lib/supabase/server";
import { EventCard, type PublicEventRow } from "@/components/events/event-card";
import { getTranslations } from "next-intl/server";

export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [eventsRes, occupancyRes, mandateRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, description, location, starts_at, ends_at, capacity, price_normal, price_student")
      .eq("status", "geplant")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true }),
    // tickets is RLS-scoped to "own row or staff" — this SECURITY DEFINER
    // function returns aggregate counts only, safe for anonymous visitors
    // (same pattern as get_course_occupancy, PROJ-12).
    supabase.rpc("get_event_occupancy"),
    user
      ? supabase.from("sepa_mandates").select("id").eq("customer_id", user.id).is("revoked_at", null).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const occupiedByEvent = new Map((occupancyRes.data ?? []).map((o) => [o.event_id, o.ticket_count]));

  const events: PublicEventRow[] = (eventsRes.data ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    description: e.description,
    location: e.location,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    capacity: e.capacity,
    priceNormal: e.price_normal,
    priceStudent: e.price_student,
    occupied: occupiedByEvent.get(e.id) ?? 0,
  }));

  const t = await getTranslations("events");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold">{t("heading")}</h1>
        <p className="text-muted-foreground">{t("subheading")}</p>
      </div>

      {events.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} isLoggedIn={!!user} hasMandate={!!mandateRes.data} />
          ))}
        </div>
      )}
    </div>
  );
}
