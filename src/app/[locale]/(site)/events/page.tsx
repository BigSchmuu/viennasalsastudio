import type { ComponentProps, ReactNode } from "react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { EventCard, type PublicEventRow } from "@/components/events/event-card";
import { SerieKarte, type PublicSerieRow } from "@/components/events/serie-karte";
import { eventEnde, eventZustand, freiePlaetze, stornierbar, type SalesMode } from "@/lib/events/event-zustand";
import { ferienpauseBis, SERIE_AKTIV } from "@/lib/events/serie";
import { ladeFerien } from "@/lib/scheduling/ferien";

const GUELTIGE_TICKETS = ["reserved", "confirmed", "checked_in"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("events");
  return { title: `${t("heading")} · Vienna Salsa Studio`, description: t("subheading") };
}

type Props = {
  searchParams: Promise<{ art?: string }>;
};

type SerieMitArt = PublicSerieRow & { eventTypeId: string };

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

  const [eventsRes, serienRes, serienTermineRes, ferien, occupancyRes, mandateRes, ticketsRes, locale, t] =
    await Promise.all([
    supabase
      .from("events")
      .select(
        "id, name, description, location, starts_at, ends_at, capacity, price_normal, price_student, sales_mode, slug, status, event_type_id, event_types(name)"
      )
      .eq("status", "geplant")
      // PROJ-54: Serientermine stehen unter „Regelmäßig" bei ihrer Serie —
      // einzeln aufgeführt stünde dieselbe Party vier Mal untereinander.
      .is("series_id", null)
      .or(`ends_at.gt.${jetzt.toISOString()},starts_at.gt.${vorEinemTag}`)
      .order("starts_at", { ascending: true }),
    supabase
      .from("event_series")
      .select(
        "id, name, slug, location, weekday, start_time, end_time, starts_on, ends_on, pause_in_holidays, event_type_id, event_types(name)"
      )
      .eq("status", SERIE_AKTIV)
      .order("weekday", { ascending: true }),
    // PROJ-54: Der nächste Termin einer Serie ist der nächste, der wirklich
    // stattfindet — nicht der, den der Rhythmus vorsieht. Ein abgesagter oder
    // verlegter Abend schickte den Gast sonst an einem Tag los, an dem nichts
    // ist (QA-Befund BUG-2).
    supabase
      .from("events")
      .select("series_id, starts_at, ends_at")
      .not("series_id", "is", null)
      .eq("status", "geplant")
      .or(`ends_at.gt.${jetzt.toISOString()},starts_at.gt.${vorEinemTag}`)
      .order("starts_at", { ascending: true }),
    ladeFerien(supabase),
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
  if (serienRes.error) {
    console.error("Serien konnten nicht geladen werden", serienRes.error);
  }
  if (serienTermineRes.error) {
    console.error("Serientermine konnten nicht geladen werden", serienTermineRes.error);
  }

  // Aufsteigend sortiert, also gewinnt der erste Treffer je Serie.
  const naechsteTermine = new Map<string, string>();
  for (const termin of serienTermineRes.data ?? []) {
    if (!termin.series_id || naechsteTermine.has(termin.series_id)) continue;
    if (eventEnde(termin.starts_at, termin.ends_at) <= jetzt) continue;
    naechsteTermine.set(termin.series_id, termin.starts_at);
  }

  const belegt = new Map((occupancyRes.data ?? []).map((o) => [o.event_id, o.ticket_count]));
  const meineEvents = new Set((ticketsRes.data ?? []).map((ticket) => ticket.event_id));
  const kommende = (eventsRes.data ?? []).filter((e) => eventEnde(e.starts_at, e.ends_at) > jetzt);

  const serienAlle: SerieMitArt[] = (serienRes.data ?? []).map((s) => {
    const regel = {
      weekday: s.weekday,
      startsOn: s.starts_on,
      endsOn: s.ends_on,
      pausiertInFerien: s.pause_in_holidays,
    };
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      typeName: s.event_types?.name ?? null,
      location: s.location,
      weekday: s.weekday,
      startTime: s.start_time,
      endTime: s.end_time,
      eventTypeId: s.event_type_id,
      naechsterTermin: naechsteTermine.get(s.id) ?? null,
      ferienpauseBis: ferienpauseBis(regel, { ferien, jetzt }),
    };
  });
  // Eine Serie ohne nächsten Termin und ohne Ferienpause ist ausgelaufen.
  const serien = serienAlle.filter((s) => s.naechsterTermin !== null || s.ferienpauseBis !== null);

  // Nur Arten, zu denen es gerade etwas gibt — ein Filter ins Leere hilft niemandem.
  const arten = [
    ...new Map([
      ...kommende.flatMap((e) => (e.event_types ? [[e.event_type_id, e.event_types.name] as const] : [])),
      ...serien.flatMap((s) => (s.typeName ? [[s.eventTypeId, s.typeName] as const] : [])),
    ]).entries(),
  ]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  const gefiltert = art ? kommende.filter((e) => e.event_type_id === art) : kommende;
  const serienGefiltert = art ? serien.filter((s) => s.eventTypeId === art) : serien;

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

  const nichtsVorhanden = kommende.length === 0 && serien.length === 0;
  const filterOhneTreffer = !nichtsVorhanden && events.length === 0 && serienGefiltert.length === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold">{t("heading")}</h1>
        <p className="text-muted-foreground">{t("subheading")}</p>
      </div>

      {nichtsVorhanden ? (
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

          {filterOhneTreffer ? (
            <div className="rounded-card border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">{t("filterEmpty")}</p>
              <Button asChild variant="outline" className="mt-3 min-h-11">
                <Link href="/events">{t("filterReset")}</Link>
              </Button>
            </div>
          ) : null}

          {serienGefiltert.length > 0 ? (
            <section aria-labelledby="regelmaessig" className="mb-8">
              <h2 id="regelmaessig" className="mb-3 font-heading text-lg font-bold tracking-[-0.5px]">
                {t("sectionRegular")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {serienGefiltert.map((serie) => (
                  <SerieKarte key={serie.id} serie={serie} />
                ))}
              </div>
            </section>
          ) : null}

          {events.length > 0 ? (
            <section aria-labelledby="besondere-events">
              <h2 id="besondere-events" className="mb-3 font-heading text-lg font-bold tracking-[-0.5px]">
                {t("sectionSpecial")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} isLoggedIn={!!user} hasMandate={!!mandateRes.data} />
                ))}
              </div>
            </section>
          ) : null}
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
