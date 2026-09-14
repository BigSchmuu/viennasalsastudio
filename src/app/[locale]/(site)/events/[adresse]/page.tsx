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
import { eventZustand, freiePlaetze, stornierbar, type SalesMode } from "@/lib/events/event-zustand";
import { eventTermin } from "@/lib/events/termin";
import { alsSkriptInhalt, eventDaten } from "@/lib/events/strukturierte-daten";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const GUELTIGE_TICKETS = ["reserved", "confirmed", "checked_in"];
const BESCHREIBUNG_LAENGE = 160;

type Props = {
  params: Promise<{ adresse: string }>;
};

/**
 * Das Event zu einer Adresse — einmal je Anfrage, geteilt von Metadaten und Seite.
 */
const ladeEvent = cache(async (adresse: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, name, description, location, starts_at, ends_at, capacity, price_normal, price_student, status, sales_mode, slug, event_types(name)"
    )
    .eq("slug", adresse)
    .maybeSingle();
  if (error) {
    console.error("Event konnte nicht geladen werden", error);
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
  const event = await ladeEvent(adresse);
  if (!event) return {};

  const [locale, t] = await Promise.all([getLocale(), getTranslations("events")]);
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
    },
  };
}

export default async function EventSeite({ params }: Props) {
  const { adresse } = await params;
  const [event, locale] = await Promise.all([ladeEvent(adresse), getLocale()]);

  if (!event) {
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
            event={{
              id: event.id,
              name: event.name,
              slug: event.slug,
              // Wer Tickets verkauft, hat Preise — das Formular verlangt sie.
              priceNormal: event.price_normal ?? 0,
              priceStudent: event.price_student ?? 0,
            }}
            zustand={zustand}
            isLoggedIn={!!viewer}
            hasMandate={!!mandatRes.data}
            stornierbar={stornierbar(event.starts_at, jetzt)}
            className="w-full sm:w-auto"
          />
        </div>
      </article>
    </div>
  );
}
