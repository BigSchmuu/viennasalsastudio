import { cache } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";
import { Link, getPathname } from "@/i18n/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EventAktion } from "@/components/events/event-aktion";
import { EventPreis, EventVerfuegbarkeit } from "@/components/events/event-angaben";
import { SerienSeite, type SerienTermin } from "@/components/events/serien-seite";
import { eventEnde, eventZustand, freiePlaetze, stornierbar, type SalesMode } from "@/lib/events/event-zustand";
import { eventTermin } from "@/lib/events/termin";
import { ferienpauseBis, uhrzeitKurz, SERIEN_VORSCHAU_TAGE } from "@/lib/events/serie";
import { ladeFerien } from "@/lib/scheduling/ferien";
import { alsSkriptInhalt, eventDaten } from "@/lib/events/strukturierte-daten";
import { EventTitelbild } from "@/components/events/event-titelbild";
import { EventGalerie } from "@/components/events/event-galerie";
import { EventVideos } from "@/components/events/event-videos";
import { bildUrl } from "@/lib/events/medien";
import { BILD_SPALTEN, galerieAus, titelbildAus } from "@/lib/events/bild-zeilen";
import { VIDEO_SPALTEN, videosAus } from "@/lib/events/video-zeilen";
import { KAUF_SPALTEN, kaufAngaben } from "@/lib/events/kauf-laden";
import { EventProgramm, EventTicketarten } from "@/components/events/event-programm";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const GUELTIGE_TICKETS = ["reserved", "confirmed", "checked_in"];
const BESCHREIBUNG_LAENGE = 160;

type Props = {
  params: Promise<{ adresse: string }>;
};

const EVENT_SPALTEN = `id, name, description, location, starts_at, ends_at, capacity, price_normal, price_student, status, sales_mode, slug, event_types(name), ${BILD_SPALTEN}, ${VIDEO_SPALTEN}, ${KAUF_SPALTEN}`;

const SERIEN_SPALTEN = `id, name, slug, description, location, weekday, start_time, end_time, starts_on, ends_on, pause_in_holidays, capacity, price_normal, price_student, sales_mode, status, event_types(name), ${BILD_SPALTEN}, ${VIDEO_SPALTEN}`;

/**
 * Das Event zu einer Adresse — einmal je Anfrage, geteilt von Metadaten und Seite.
 */
const ladeEvent = cache(async (adresse: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select(EVENT_SPALTEN).eq("slug", adresse).maybeSingle();
  if (error) {
    console.error("Event konnte nicht geladen werden", error);
  }
  return data;
});

/** Dieselbe Adresse kann auch eine Serie meinen (PROJ-54). */
const ladeSerie = cache(async (adresse: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("event_series").select(SERIEN_SPALTEN).eq("slug", adresse).maybeSingle();
  if (error) {
    console.error("Serie konnte nicht geladen werden", error);
  }
  return data;
});

function seitenUrl(adresse: string, locale: string): string {
  return `${SITE_URL}${getPathname({ href: `/events/${adresse}`, locale })}`;
}

function kuerzen(text: string | null): string | null {
  if (!text) return null;
  const einzeilig = text.replace(/\s+/g, " ").trim();
  return einzeilig.length <= BESCHREIBUNG_LAENGE ? einzeilig : `${einzeilig.slice(0, BESCHREIBUNG_LAENGE - 1).trimEnd()}…`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { adresse } = await params;
  const [event, locale, t] = await Promise.all([ladeEvent(adresse), getLocale(), getTranslations("events")]);

  if (event) {
    const termin = eventTermin(event.starts_at, event.ends_at, locale);
    const url = seitenUrl(event.slug, locale);
    const beschreibung =
      kuerzen(event.description) ?? t("metaDescription", { type: event.event_types?.name ?? "Event", date: termin });

    return {
      title: `${event.name} · Vienna Salsa Studio`,
      description: beschreibung,
      alternates: { canonical: url },
      // Die Link-Vorschau (WhatsApp, Instagram) zeigt Name und Termin — das,
      // was jemand wissen will, bevor er den Link öffnet.
      openGraph: {
        title: event.name,
        description: [termin, event.location].filter(Boolean).join(" · "),
        url,
        type: "website",
        siteName: "Vienna Salsa Studio",
        locale: locale === "en" ? "en_IE" : "de_AT",
        images: vorschaubild(event.event_images),
      },
    };
  }

  const serie = await ladeSerie(adresse);
  if (!serie) return {};

  const wochentag = await getTranslations("weekdays");
  const rhythmus = serie.end_time
    ? t("rhythmWeekly", {
        day: wochentag(String(serie.weekday)),
        from: uhrzeitKurz(serie.start_time),
        to: uhrzeitKurz(serie.end_time),
      })
    : t("rhythmWeeklyOpen", { day: wochentag(String(serie.weekday)), from: uhrzeitKurz(serie.start_time) });
  const url = seitenUrl(serie.slug, locale);

  return {
    title: `${serie.name} · Vienna Salsa Studio`,
    description: kuerzen(serie.description) ?? `${rhythmus} · Vienna Salsa Studio`,
    alternates: { canonical: url },
    openGraph: {
      title: serie.name,
      description: [rhythmus, serie.location].filter(Boolean).join(" · "),
      url,
      type: "website",
      siteName: "Vienna Salsa Studio",
      locale: locale === "en" ? "en_IE" : "de_AT",
      images: vorschaubild(serie.event_images),
    },
  };
}

/** Das Titelbild für die Link-Vorschau — ohne Bild bleibt die Angabe weg. */
function vorschaubild(bilder: Parameters<typeof titelbildAus>[0]) {
  const titelbild = titelbildAus(bilder);
  if (!titelbild) return undefined;
  return [{ url: bildUrl(titelbild.pfad), width: titelbild.breite, height: titelbild.hoehe }];
}

export default async function EventSeite({ params }: Props) {
  const { adresse } = await params;
  const [event, locale] = await Promise.all([ladeEvent(adresse), getLocale()]);

  if (!event) {
    const serie = await ladeSerie(adresse);
    if (serie) return <SerienAnsichtLaden serie={serie} locale={locale} />;

    // Nach einer Umbenennung führt die alte Adresse dauerhaft auf die neue —
    // geteilte Links bleiben gültig, und Suchmaschinen übernehmen die neue.
    const supabase = await createClient();
    const { data: frueher, error } = await supabase
      .from("event_previous_slugs")
      .select("events(slug)")
      .eq("slug", adresse)
      .maybeSingle();
    if (error) {
      console.error("Frühere Event-Adresse konnte nicht geprüft werden", error);
    }
    if (frueher?.events?.slug) {
      permanentRedirect(getPathname({ href: `/events/${frueher.events.slug}`, locale }));
    }
    notFound();
  }

  const supabase = await createClient();
  const viewer = await getViewer();
  const jetzt = new Date();

  const [belegungRes, ticketRes, mandatRes, t] = await Promise.all([
    supabase.rpc("get_event_occupancy"),
    viewer
      ? supabase
          .from("tickets")
          .select("id")
          .eq("event_id", event.id)
          .eq("customer_id", viewer.id)
          .in("status", GUELTIGE_TICKETS)
          .limit(1)
      : Promise.resolve({ data: [] as { id: string }[] }),
    viewer
      ? supabase.from("sepa_mandates").select("id").eq("customer_id", viewer.id).is("revoked_at", null).maybeSingle()
      : Promise.resolve({ data: null }),
    getTranslations("events"),
  ]);

  const lage = {
    status: event.status,
    salesMode: event.sales_mode as SalesMode,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    capacity: event.capacity,
    occupied: (belegungRes.data ?? []).find((b) => b.event_id === event.id)?.ticket_count ?? 0,
    hatTicket: (ticketRes.data ?? []).length > 0,
  };
  const zustand = eventZustand(lage, jetzt);
  // Für Suchmaschinen ohne das persönliche Ticket — die Daten stehen für alle
  // gleich im Quelltext.
  const zustandFuerAlle = eventZustand({ ...lage, hatTicket: false }, jetzt);
  const termin = eventTermin(event.starts_at, event.ends_at, locale);
  const titelbild = titelbildAus(event.event_images);

  // PROJ-56: Wie viele Plätze in jeder Einheit belegt sind. Über eine eigene
  // Funktion, weil die Tickets selbst niemanden etwas angehen — dieselbe
  // Überlegung wie bei get_event_occupancy (PROJ-12).
  const belegtProEinheit = new Map<string, number>();
  if ((event.event_units ?? []).length > 0) {
    const { data: belegung } = await supabase.rpc("get_event_unit_occupancy", { p_event_id: event.id });
    for (const zeile of belegung ?? []) belegtProEinheit.set(zeile.unit_id, zeile.ticket_count);
  }

  const kauf = kaufAngaben(event, { belegtJeEinheit: belegtProEinheit });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: alsSkriptInhalt(
            eventDaten({
              name: event.name,
              description: event.description,
              location: event.location,
              startsAt: event.starts_at,
              endsAt: event.ends_at,
              priceNormal: event.price_normal,
              zustand: zustandFuerAlle === "ticketVorhanden" ? "kaufen" : zustandFuerAlle,
              url: seitenUrl(event.slug, locale),
              siteUrl: SITE_URL,
              imageUrl: titelbild ? bildUrl(titelbild.pfad) : null,
            })
          ),
        }}
      />

      <Link
        href="/events"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("backToOverview")}
      </Link>

      {zustand === "abgesagt" || zustand === "vorbei" ? (
        <Alert variant={zustand === "abgesagt" ? "destructive" : "default"} className="mt-4">
          <AlertDescription>{zustand === "abgesagt" ? t("cancelledHint") : t("pastHint")}</AlertDescription>
        </Alert>
      ) : null}

      <article className="mt-4 rounded-card border border-border/60 bg-card/80 p-5 shadow-soft backdrop-blur sm:p-8">
        {titelbild ? (
          <div className="mb-6">
            <EventTitelbild
              bild={titelbild}
              eventName={event.name}
              typeName={event.event_types?.name ?? null}
              variante="seite"
              prioritaet
            />
          </div>
        ) : null}
        {event.event_types?.name ? <Badge variant="secondary">{event.event_types.name}</Badge> : null}
        <h1 className="mt-3 font-heading text-2xl font-bold tracking-[-0.5px] sm:text-3xl">{event.name}</h1>

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <dt className="sr-only">{t("when")}</dt>
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <dd>{termin}</dd>
          </div>
          {event.location ? (
            <div className="flex items-start gap-2">
              <dt className="sr-only">{t("where")}</dt>
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <dd>{event.location}</dd>
            </div>
          ) : null}
        </dl>

        {event.description ? (
          <p className="mt-6 whitespace-pre-line leading-relaxed">{event.description}</p>
        ) : null}

        <div className="mt-8 flex flex-col gap-4 border-t border-border/60 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <EventPreis priceNormal={event.price_normal} priceStudent={event.price_student} />
            <EventVerfuegbarkeit zustand={zustand} plaetze={freiePlaetze(lage)} />
          </div>
          <EventAktion
            event={{ ...kauf, slug: event.slug }}
            zustand={zustand}
            isLoggedIn={!!viewer}
            hasMandate={!!mandatRes.data}
            stornierbar={stornierbar(event.starts_at, jetzt)}
            className="w-full sm:w-auto"
          />
        </div>

        <EventProgramm einheiten={kauf.einheiten} />
        <EventTicketarten arten={kauf.ticketarten} einheiten={kauf.einheiten} />

        <EventGalerie bilder={galerieAus(event.event_images)} eventName={event.name} />
        <EventVideos videos={videosAus(event.event_videos)} eventName={event.name} />
      </article>
    </div>
  );
}

type SerieZeile = NonNullable<Awaited<ReturnType<typeof ladeSerie>>>;

/**
 * Die Serienseite: dieselbe Adresse, andere Sicht (PROJ-54).
 *
 * Die Termine kommen aus den angelegten Events, nicht aus der Regel — nur sie
 * kennen Kapazität, Absagen und Verlegungen.
 */
async function SerienAnsichtLaden({ serie, locale }: { serie: SerieZeile; locale: string }) {
  const supabase = await createClient();
  const viewer = await getViewer();
  const jetzt = new Date();
  const fensterEnde = new Date(jetzt.getTime() + SERIEN_VORSCHAU_TAGE * 24 * 60 * 60 * 1000).toISOString();
  const vorEinemTag = new Date(jetzt.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [termineRes, belegungRes, ticketsRes, mandatRes, ferien, t] = await Promise.all([
    supabase
      .from("events")
      .select("id, slug, starts_at, ends_at, status, overridden, capacity, sales_mode")
      .eq("series_id", serie.id)
      .gt("starts_at", vorEinemTag)
      .lt("starts_at", fensterEnde)
      .order("starts_at", { ascending: true }),
    supabase.rpc("get_event_occupancy"),
    viewer
      ? supabase.from("tickets").select("event_id").eq("customer_id", viewer.id).in("status", GUELTIGE_TICKETS)
      : Promise.resolve({ data: [] as { event_id: string }[] }),
    viewer
      ? supabase.from("sepa_mandates").select("id").eq("customer_id", viewer.id).is("revoked_at", null).maybeSingle()
      : Promise.resolve({ data: null }),
    ladeFerien(supabase),
    getTranslations("events"),
  ]);

  if (termineRes.error) {
    console.error("Serientermine konnten nicht geladen werden", termineRes.error);
  }

  const belegt = new Map((belegungRes.data ?? []).map((o) => [o.event_id, o.ticket_count]));
  const meineEvents = new Set((ticketsRes.data ?? []).map((ticket) => ticket.event_id));

  const termine: SerienTermin[] = (termineRes.data ?? [])
    .filter((termin) => eventEnde(termin.starts_at, termin.ends_at) > jetzt)
    .map((termin) => {
      const lage = {
        status: termin.status,
        salesMode: termin.sales_mode as SalesMode,
        startsAt: termin.starts_at,
        endsAt: termin.ends_at,
        capacity: termin.capacity,
        occupied: belegt.get(termin.id) ?? 0,
        hatTicket: meineEvents.has(termin.id),
      };
      return {
        id: termin.id,
        slug: termin.slug,
        startsAt: termin.starts_at,
        endsAt: termin.ends_at,
        abgesagt: termin.status === "abgesagt",
        verlegt: termin.overridden,
        zustand: eventZustand(lage, jetzt),
        freiePlaetze: freiePlaetze(lage),
        stornierbar: stornierbar(termin.starts_at, jetzt),
      };
    });

  const pause = ferienpauseBis(
    {
      weekday: serie.weekday,
      startsOn: serie.starts_on,
      endsOn: serie.ends_on,
      pausiertInFerien: serie.pause_in_holidays,
    },
    { ferien, jetzt }
  );

  const titelbild = titelbildAus(serie.event_images);

  // Für Google: jeder kommende Termin ein eigener Eintrag — eine Serie als
  // solche kennt schema.org nicht.
  const daten = termine
    .filter((termin) => !termin.abgesagt)
    .slice(0, 5)
    .map((termin) =>
      eventDaten({
        name: serie.name,
        description: serie.description,
        location: serie.location,
        startsAt: termin.startsAt,
        endsAt: termin.endsAt,
        priceNormal: serie.price_normal,
        zustand: termin.zustand === "ticketVorhanden" ? "kaufen" : termin.zustand,
        url: seitenUrl(termin.slug, locale),
        siteUrl: SITE_URL,
        imageUrl: titelbild ? bildUrl(titelbild.pfad) : null,
      })
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      {daten.length > 0 ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: alsSkriptInhalt(daten) }} />
      ) : null}

      <Link
        href="/events"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t("backToOverview")}
      </Link>

      <SerienSeite
        serie={{
          id: serie.id,
          name: serie.name,
          slug: serie.slug,
          typeName: serie.event_types?.name ?? null,
          description: serie.description,
          location: serie.location,
          titelbild,
          galerie: galerieAus(serie.event_images),
          videos: videosAus(serie.event_videos),
          weekday: serie.weekday,
          startTime: serie.start_time,
          endTime: serie.end_time,
          priceNormal: serie.price_normal,
          priceStudent: serie.price_student,
          ferienpauseBis: pause,
        }}
        termine={termine}
        isLoggedIn={!!viewer}
        hasMandate={!!mandatRes.data}
      />
    </div>
  );
}
