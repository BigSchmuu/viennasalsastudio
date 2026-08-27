import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";
import { readStudioPricing, formatPrice } from "@/lib/pricing";
import { heuteInWien, STUDIO_TIMEZONE } from "@/lib/constants/zeitzone";
import { upcomingOccurrences, selfCheckinWindow, jsDayToWeekday } from "@/lib/scheduling/dates";
import { naechsteTermine, type AboEingabe, type BuchungEingabe } from "@/lib/dashboard/naechster-termin";
import { OpenItemsSection, type OffenerPunkt } from "@/components/dashboard/open-items-section";
import {
  NextCourseSection,
  type TerminAnzeige,
  type DanachAnzeige,
} from "@/components/dashboard/next-course-section";
import { GettingStartedSection, type Kursvorschlag } from "@/components/dashboard/getting-started-section";
import { PracticeSection, type Lektion } from "@/components/dashboard/practice-section";
import { ThisWeekSection, type WochenEvent } from "@/components/dashboard/this-week-section";
import { AttendanceSection } from "@/components/dashboard/attendance-section";
import { CreditReferralSection } from "@/components/dashboard/credit-referral-section";
import { levelValues } from "@/lib/constants/levels";

export const dynamic = "force-dynamic";

const EVENT_FENSTER_TAGE = 7;

type Zeitplan = {
  weekday: number;
  start_time: string;
  end_time: string;
  course_schedule_pauses: { pause_date: string }[];
};

type KursBezug = {
  id: string;
  name: string;
  level: string | null;
  video_set_id: string | null;
  course_schedule: Zeitplan | Zeitplan[] | null;
  rooms: { name: string; locations: { name: string } | null } | null;
  dance_styles: { name: string } | null;
};

/** Supabase liefert eingebettete 1:1-Beziehungen je nach Abfrage als Objekt oder als Liste. */
function ersterZeitplan(kurs: KursBezug | null): Zeitplan | null {
  if (!kurs?.course_schedule) return null;
  return Array.isArray(kurs.course_schedule) ? (kurs.course_schedule[0] ?? null) : kurs.course_schedule;
}

export default async function MeinBereichPage() {
  const user = await getViewer();
  if (!user) {
    redirect("/login?redirect=/mein-bereich");
  }

  const supabase = await createClient();

  // Ein Zeitpunkt für die ganze Seite. Würde jeder Abschnitt selbst auf die
  // Uhr sehen, könnten zwei Abschnitte denselben Termin unterschiedlich
  // beurteilen — und beim Rendern die Uhr zu lesen macht die Ausgabe
  // ohnehin unvorhersehbar.
  const jetzt = new Date();
  const heute = heuteInWien(jetzt);
  const morgen = heuteInWien(new Date(jetzt.getTime() + 24 * 60 * 60 * 1000));
  const fensterEnde = new Date(jetzt.getTime() + EVENT_FENSTER_TAGE * 24 * 60 * 60 * 1000).toISOString();

  const kursAuswahl =
    "id, name, level, video_set_id, course_schedule(weekday, start_time, end_time, course_schedule_pauses(pause_date)), rooms(name, locations(name)), dance_styles(name)";

  const [
    { data: profil },
    { data: mandat },
    { data: abos },
    { data: buchungen },
    { data: wartelisteRows },
    { data: heutigeAnwesenheit },
    { data: events },
    { data: belegung },
    { data: meineTickets },
    { data: guthabenRows },
    { data: preisZeile },
    { data: alleKursnamen },
    { data: anwesenheitAnzahl },
  ] = await Promise.all([
    supabase.from("profiles").select("full_name, referral_code").eq("id", user.id).single(),
    supabase
      .from("sepa_mandates")
      .select("id")
      .eq("customer_id", user.id)
      .is("revoked_at", null)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select(`id, status, course_id, courses(${kursAuswahl})`)
      .eq("customer_id", user.id)
      .eq("status", "active"),
    supabase
      .from("course_bookings")
      .select(`id, type, status, chosen_date, course_id, courses(${kursAuswahl})`)
      .eq("customer_id", user.id)
      .in("status", ["open", "confirmed"]),
    supabase.rpc("list_my_waitlist"),
    supabase.rpc("get_my_todays_attendance"),
    supabase
      .from("events")
      .select("id, name, location, starts_at, capacity, price_normal, price_student")
      .eq("status", "geplant")
      .gt("starts_at", jetzt.toISOString())
      .lt("starts_at", fensterEnde)
      .order("starts_at", { ascending: true }),
    supabase.rpc("get_event_occupancy"),
    supabase
      .from("tickets")
      .select("event_id")
      .eq("customer_id", user.id)
      .in("status", ["reserved", "confirmed", "checked_in"]),
    supabase.from("customer_credits").select("amount").eq("customer_id", user.id),
    supabase.from("dropin_pricing").select("*").limit(1).maybeSingle(),
    supabase.from("courses").select("id, name"),
    // Anwesenheiten sind abgeschottet (RLS aktiv, keine Policy). Diese
    // Funktion liefert ausschließlich die eigene Zahl — siehe die Migration
    // 20260827154946.
    supabase.rpc("count_my_recent_attendance"),
  ]);

  const hatMandat = Boolean(mandat);
  const pricing = readStudioPricing(preisZeile);

  // --- Termine ---------------------------------------------------------

  const aboEingaben: AboEingabe[] = [];
  for (const abo of abos ?? []) {
    const kurs = abo.courses as KursBezug | null;
    const plan = ersterZeitplan(kurs);
    if (!kurs || !plan) continue;
    aboEingaben.push({
      kursId: kurs.id,
      kursName: kurs.name,
      wochentag: plan.weekday,
      startZeit: plan.start_time,
      endZeit: plan.end_time,
      raum: kurs.rooms?.name ?? null,
      standort: kurs.rooms?.locations?.name ?? null,
      pausenTage: (plan.course_schedule_pauses ?? []).map((p) => p.pause_date),
    });
  }

  const buchungsArtProKurs = new Map<string, "trial" | "dropin">();
  const buchungsEingaben: BuchungEingabe[] = [];
  for (const buchung of buchungen ?? []) {
    const kurs = buchung.courses as KursBezug | null;
    const plan = ersterZeitplan(kurs);
    if (!kurs || !plan) continue;
    if (buchung.status !== "confirmed" || !buchung.chosen_date) continue;
    if (buchung.type !== "trial" && buchung.type !== "dropin") continue;
    buchungsEingaben.push({
      kursId: kurs.id,
      kursName: kurs.name,
      datum: buchung.chosen_date,
      startZeit: plan.start_time,
      endZeit: plan.end_time,
      raum: kurs.rooms?.name ?? null,
      standort: kurs.rooms?.locations?.name ?? null,
    });
    buchungsArtProKurs.set(`${kurs.id}|${buchung.chosen_date}`, buchung.type);
  }

  const { naechste, danach } = naechsteTermine(aboEingaben, buchungsEingaben, jetzt);
  const aboKursIds = new Set(aboEingaben.map((a) => a.kursId));
  const eingechecktHeute = new Set(
    (heutigeAnwesenheit ?? [])
      .filter((a: { status: string }) => a.status === "present")
      .map((a: { course_id: string }) => a.course_id)
  );

  function wochentagVon(datum: string): number {
    return jsDayToWeekday(new Date(`${datum}T12:00:00Z`).getUTCDay());
  }

  const anzeigen: TerminAnzeige[] = naechste.map((termin) => {
    // Einchecken gibt es nur mit aktivem Abo und nur am Kurstag selbst.
    const darfEinchecken = aboKursIds.has(termin.kursId) && termin.datum === heute;
    const fenster = darfEinchecken
      ? selfCheckinWindow(termin.datum, termin.startZeit, termin.endZeit)
      : null;

    const laeuft = jetzt >= termin.beginn && jetzt < termin.ende;
    const zustand = laeuft
      ? ("laeuft" as const)
      : termin.datum === heute
        ? ("heute" as const)
        : termin.datum === morgen
          ? ("morgen" as const)
          : ("spaeter" as const);

    return {
      termin,
      zustand,
      wochentag: wochentagVon(termin.datum),
      checkin: fenster
        ? {
            opensAtIso: fenster.opensAt.toISOString(),
            endsAtIso: fenster.endsAt.toISOString(),
            checkedIn: eingechecktHeute.has(termin.kursId),
            nochGeschlossen: jetzt < fenster.opensAt,
            oeffnetUm: fenster.opensAt.toLocaleTimeString("de-AT", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: STUDIO_TIMEZONE,
            }),
          }
        : null,
      buchungsArt: buchungsArtProKurs.get(`${termin.kursId}|${termin.datum}`) ?? null,
    };
  });

  // „Danach" soll verhindern, dass ein zweiter Kurs verlorengeht. Bei nur
  // einem Kurs wäre es derselbe eine Woche später — eine Zeile, die nichts
  // sagt und am selben Wochentag sogar verwirrt („HEUTE" / „Danach:
  // Donnerstag", und heute ist Donnerstag).
  const bereitsGezeigt = new Set(naechste.map((t) => t.kursId));
  const danachAnzeige: DanachAnzeige | null =
    danach && !bereitsGezeigt.has(danach.kursId)
      ? { kursName: danach.kursName, wochentag: wochentagVon(danach.datum), startZeit: danach.startZeit }
      : null;

  // --- Offene Punkte ---------------------------------------------------

  const offenePunkte: OffenerPunkt[] = [];
  if (!hatMandat) offenePunkte.push({ art: "mandat" });
  for (const buchung of buchungen ?? []) {
    if (buchung.status !== "open") continue;
    const kurs = buchung.courses as KursBezug | null;
    offenePunkte.push({ art: "buchung", kursName: kurs?.name ?? "—" });
  }
  // list_my_waitlist liefert nur die Kurs-Id, nicht den Namen.
  const kursnameZuId = new Map((alleKursnamen ?? []).map((k) => [k.id, k.name]));
  for (const eintrag of (wartelisteRows ?? []) as { course_id: string }[]) {
    offenePunkte.push({ art: "warteliste", kursName: kursnameZuId.get(eintrag.course_id) ?? "—" });
  }

  // --- Videolektionen --------------------------------------------------

  // Der Kurs des nächsten Termins bestimmt, welche Lektionen gezeigt werden.
  //
  // Gesucht wird in Abos *und* Buchungen. Nur in den Abos zu suchen war ein
  // Fehler: ein Flatrate-Abo steht dort mit `courses = null`, der Vergleich
  // greift also nie — und ein Flatrate-Kunde mit gebuchtem Drop-in sah gar
  // keine Videos, obwohl die Zugriffsregel der Datenbank sie ihm ausdrücklich
  // gibt (PROJ-11: `s.course_id is null` zählt für jeden Videosatz).
  //
  // Wer welchen Satz sehen darf, entscheidet ohnehin die Datenbank. Hier
  // genügt die Frage, ob überhaupt ein aktives Abo besteht — alles Weitere
  // liefert die Abfrage von selbst leer zurück.
  const uebeKurs = naechste.length > 0
    ? [...(abos ?? []), ...(buchungen ?? [])]
        .map((z) => z.courses as KursBezug | null)
        .find((k) => k?.id === naechste[0].kursId) ?? null
    : null;

  const hatAktivesAbo = (abos ?? []).length > 0;

  let lektionen: Lektion[] = [];
  if (uebeKurs?.video_set_id && hatAktivesAbo) {
    const { data: lektionRows } = await supabase
      .from("video_set_lessons")
      .select("id, title, customer_video_url, position")
      .eq("video_set_id", uebeKurs.video_set_id)
      .not("customer_video_url", "is", null)
      .order("position", { ascending: true });
    lektionen = (lektionRows ?? [])
      .filter((l) => Boolean(l.customer_video_url))
      .map((l) => ({ id: l.id, titel: l.title, videoUrl: l.customer_video_url as string }));
  }

  // --- Einstieg (Leerzustand) ------------------------------------------

  // Ausschlaggebend ist, ob der Kunde überhaupt etwas laufen hat — nicht, ob
  // sich daraus ein Termin errechnen ließ. Ein Flatrate-Abo ohne Kursbindung
  // liefert keinen nächsten Termin, macht seinen Inhaber aber zum zahlenden
  // Mitglied. Ihm den Neukunden-Bildschirm zu zeigen wäre eine Ohrfeige.
  const istMitglied = (abos ?? []).length > 0 || (buchungen ?? []).length > 0;
  const hatNichts = !istMitglied;
  let vorschlaege: Kursvorschlag[] = [];
  if (hatNichts) {
    const einstiegsLevel = levelValues.slice(0, 2);
    const [{ data: kursRows }, { data: auslastung }] = await Promise.all([
      supabase
        .from("courses")
        .select(`${kursAuswahl}, max_participants, price, prerequisite_note, role_query_enabled, course_entry_dates(entry_date)`)
        .in("level", einstiegsLevel)
        .limit(6),
      supabase.rpc("get_course_occupancy"),
    ]);
    const belegtProKurs = new Map(
      (auslastung ?? []).map((o) => [o.course_id, o.occupied_count])
    );
    const tw = await getTranslations("weekdays");

    vorschlaege = (kursRows ?? [])
      .map((row): Kursvorschlag | null => {
        const kurs = row as unknown as KursBezug & {
          max_participants: number | null;
          price: number | null;
          prerequisite_note: string | null;
          role_query_enabled: boolean;
          course_entry_dates: { entry_date: string }[] | null;
        };
        const plan = ersterZeitplan(kurs);
        if (!plan) return null;
        const termine = upcomingOccurrences(plan.weekday, {
          count: 1,
          pauseDates: (plan.course_schedule_pauses ?? []).map((p) => p.pause_date),
        });
        const belegt = belegtProKurs.get(kurs.id) ?? 0;
        return {
          kurs: {
            id: kurs.id,
            name: kurs.name,
            entryDates: (kurs.course_entry_dates ?? []).map((d) => d.entry_date),
            nextOccurrenceDates: upcomingOccurrences(plan.weekday, {
              count: 4,
              pauseDates: (plan.course_schedule_pauses ?? []).map((p) => p.pause_date),
            }),
            hasOpenRegularBooking: false,
            hasActiveSubscription: false,
            price: kurs.price,
            isFull: kurs.max_participants !== null && belegt >= kurs.max_participants,
            isOnWaitlist: false,
            prerequisiteNote: kurs.prerequisite_note,
            roleQueryEnabled: kurs.role_query_enabled,
          },
          level: kurs.level,
          tanzstil: kurs.dance_styles?.name ?? null,
          wochentag: tw(String(plan.weekday)),
          startZeit: plan.start_time,
          naechsterTermin: termine[0] ?? null,
        };
      })
      .filter((v): v is Kursvorschlag => v !== null)
      .filter((v) => !v.kurs.isFull)
      .slice(0, 3);
  }

  // --- Events ----------------------------------------------------------

  const belegtProEvent = new Map(
    ((belegung ?? []) as { event_id: string; ticket_count: number }[]).map((o) => [o.event_id, o.ticket_count])
  );
  const meineEventIds = new Set((meineTickets ?? []).map((t) => t.event_id));
  const wochenEvents: WochenEvent[] = (events ?? []).map((e) => ({
    event: { id: e.id, name: e.name, priceNormal: e.price_normal, priceStudent: e.price_student },
    startsAt: e.starts_at,
    location: e.location,
    ausgebucht: (belegtProEvent.get(e.id) ?? 0) >= e.capacity,
    hatTicket: meineEventIds.has(e.id),
  }));

  // --- Guthaben --------------------------------------------------------

  const guthaben = (guthabenRows ?? []).reduce((summe, z) => summe + Number(z.amount), 0);
  const empfehlungAktiv = pricing.referral.referrer > 0 || pricing.referral.referee > 0;

  // --- Ausgabe ---------------------------------------------------------

  const [t, locale] = await Promise.all([getTranslations("dashboard"), getLocale()]);
  const vorname = profil?.full_name?.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <h1 className="font-heading text-2xl font-bold tracking-[-0.5px] sm:text-3xl">
        {vorname ? t("greeting", { name: vorname }) : t("greetingNoName")}
      </h1>

      <div className="mt-6 space-y-8">
        <OpenItemsSection punkte={offenePunkte} />

        <NextCourseSection anzeigen={anzeigen} danach={danachAnzeige} />

        {hatNichts ? (
          <GettingStartedSection
            vorschlaege={vorschlaege}
            hasMandate={hatMandat}
            hasReferralSource={false}
            pricing={pricing}
          />
        ) : null}

        {lektionen.length > 0 && uebeKurs ? (
          <PracticeSection kursId={uebeKurs.id} kursName={uebeKurs.name} lektionen={lektionen} />
        ) : null}

        {istMitglied && anzeigen.length === 0 ? (
          <section>
            <h2 className="font-heading text-lg font-bold tracking-[-0.5px]">
              {t("nextCourse.heading")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noUpcoming")}{" "}
              <Link href="/stundenplan" className="font-medium text-primary hover:underline">
                {t("toSchedule")}
              </Link>
            </p>
          </section>
        ) : null}

        <ThisWeekSection events={wochenEvents} hasMandate={hatMandat} />

        <AttendanceSection anzahl={anwesenheitAnzahl ?? 0} />

        <CreditReferralSection
          guthaben={guthaben}
          empfehlungscode={empfehlungAktiv ? (profil?.referral_code ?? null) : null}
          waehrungsformat={formatPrice(guthaben, locale)}
        />

        <p className="border-t border-border/60 pt-6 text-sm text-muted-foreground">
          {t("profileHint")}{" "}
          <Link href="/profil" className="font-medium text-primary hover:underline">
            {t("profileCta")}
          </Link>
        </p>
      </div>
    </div>
  );
}
