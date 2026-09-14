import type { ComponentProps, ReactNode } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { EventCard, type PublicEventRow } from "@/components/events/event-card";
import { eventEnde, eventZustand, freiePlaetze, stornierbar, type SalesMode } from "@/lib/events/event-zustand";

const GUELTIGE_TICKETS = ["reserved", "confirmed", "checked_in"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("events");
  return { title: `${t("heading")} · Vienna Salsa Studio`, description: t("subheading") };
}

type Props = {
  searchParams: Promise<{ art?: string }>;
};

export default async function EventsPage({ searchParams }: Props) {
  const { art } = await searchParams;
  const supabase = await createClient();
  // Der Rahmen hat das schon ermittelt — getViewer() gibt innerhalb einer
  // Anfrage dieselbe Antwort zurück, ohne erneut zu fragen.
  const user = await getViewer();
  const jetzt = new Date();

  // Die Datenbank wählt grob vor, die genaue Grenze zieht `eventEnde`: Ein
  // Event bleibt bis zu seinem Ende sichtbar, eines ohne Ende bis Mitternacht —
  // also nie länger als einen Tag nach Beginn.
  const vorEinemTag = new Date(jetzt.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [eventsRes, occupancyRes, mandateRes, ticketsRes, locale, t] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, name, description, location, starts_at, ends_at, capacity, price_normal, price_student, sales_mode, slug, status, event_type_id, event_types(name)"
      )
      .eq("status", "geplant")
      .or(`ends_at.gt.${jetzt.toISOString()},starts_at.gt.${vorEinemTag}`)
      .order("starts_at", { ascending: true }),
    // tickets is RLS-scoped to "own row or staff" — this SECURITY DEFINER
    // function returns aggregate counts only, safe for anonymous visitors
    // (same pattern as get_course_occupancy, PROJ-12).
    supabase.rpc("get_event_occupancy"),
    user
      ? supabase.from("sepa_mandates").select("id").eq("customer_id", user.id).is("revoked_at", null).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("tickets").select("event_id").eq("customer_id", user.id).in("status", GUELTIGE_TICKETS)
      : Promise.resolve({ data: [] as { event_id: string }[] }),
    getLocale(),
    getTranslations("events"),
  ]);

  if (eventsRes.error) {
    console.error("Events konnten nicht geladen werden", eventsRes.error);
  }

  const belegt = new Map((occupancyRes.data ?? []).map((o) => [o.event_id, o.ticket_count]));
  const meineEvents = new Set((ticketsRes.data ?? []).map((ticket) => ticket.event_id));
  const kommende = (eventsRes.data ?? []).filter((e) => eventEnde(e.starts_at, e.ends_at) > jetzt);

  // Nur Arten, zu denen es gerade etwas gibt — ein Filter ins Leere hilft niemandem.
  const arten = [
    ...new Map(
      kommende.flatMap((e) => (e.event_types ? [[e.event_type_id, e.event_types.name] as const] : []))
    ).entries(),
  ]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  const gefiltert = art ? kommende.filter((e) => e.event_type_id === art) : kommende;

  const events: PublicEventRow[] = gefiltert.map((e) => {
    const lage = {
      status: e.status,
      salesMode: e.sales_mode as SalesMode,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      capacity: e.capacity,
      occupied: belegt.get(e.id) ?? 0,
      hatTicket: meineEvents.has(e.id),
    };
    return {
      id: e.id,
      name: e.name,
      description: e.description,
      location: e.location,
      startsAt: e.starts_at,
      endsAt: e.ends_at,
      priceNormal: e.price_normal,
      priceStudent: e.price_student,
      salesMode: lage.salesMode,
      slug: e.slug,
      typeName: e.event_types?.name ?? null,
      zustand: eventZustand(lage, jetzt),
      freiePlaetze: freiePlaetze(lage),
      stornierbar: stornierbar(e.starts_at, jetzt),
    };
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold">{t("heading")}</h1>
        <p className="text-muted-foreground">{t("subheading")}</p>
      </div>

      {kommende.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          {arten.length > 1 || art ? (
            <nav aria-label={t("filterLabel")} className="mb-6 flex flex-wrap gap-2">
              <FilterChip aktiv={!art} href="/events">
                {t("filterAll")}
              </FilterChip>
              {arten.map((eventArt) => (
                <FilterChip
                  key={eventArt.id}
                  aktiv={art === eventArt.id}
                  href={{ pathname: "/events", query: { art: eventArt.id } }}
                >
                  {eventArt.name}
                </FilterChip>
              ))}
            </nav>
          ) : null}

          {/* „Regelmäßig" (Serien) kommt mit PROJ-54. Ohne Serien entfällt der
              Bereich ganz — eine leere Überschrift wäre ein falsches Versprechen. */}
          <section aria-labelledby="besondere-events">
            <h2 id="besondere-events" className="mb-3 font-heading text-lg font-bold tracking-[-0.5px]">
              {t("sectionSpecial")}
            </h2>
            {events.length === 0 ? (
              <div className="rounded-card border border-dashed border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">{t("filterEmpty")}</p>
                <Button asChild variant="outline" className="mt-3 min-h-11">
                  <Link href="/events">{t("filterReset")}</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} isLoggedIn={!!user} hasMandate={!!mandateRes.data} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function FilterChip({
  aktiv,
  href,
  children,
}: {
  aktiv: boolean;
  href: ComponentProps<typeof Link>["href"];
  children: ReactNode;
}) {
  return (
    <Button asChild size="sm" variant={aktiv ? "default" : "outline"} className="min-h-11 rounded-full px-4">
      <Link href={href} aria-current={aktiv ? "true" : undefined}>
        {children}
      </Link>
    </Button>
  );
}
