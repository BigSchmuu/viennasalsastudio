import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveContent } from "@/lib/notifications/dispatch";

/**
 * PROJ-67: Steht der Standort wirklich in der Kursstart-Erinnerung?
 *
 * Geprüft wird die Verknüpfung, nicht die Formulierung: Aus einer Buchung
 * müssen Kurs, Termin **und** der Standort samt Anschrift werden. Das lässt
 * sich nur gegen die Datenbank zeigen — die Kette geht über Buchung, Kurs,
 * Raum und Standort, und eine falsch geschriebene Stufe fiele sonst erst dem
 * Kunden auf, der vor dem falschen Haus steht.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const KENNUNG = `E2E67-${Date.now()}`;
const STANDORT = `${KENNUNG} Standort`;
const ANSCHRIFT = "Musterstraße 1, 1020 Wien";
/** PROJ-77: die Beschreibung des Standorts — wie man hinfindet. */
const WEGBESCHREIBUNG = "Eingang über den Hof, zweiter Stock.";

let service: SupabaseClient;
let kundeId = "";
let standortId = "";
let raumId = "";
let kursId = "";
let buchungId = "";

function morgen(): string {
  const d = new Date(Date.now() + 24 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(d);
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: nutzer } = await service.auth.admin.listUsers({ perPage: 200 });
  const kunde = nutzer?.users.find((u) => u.email === "e2e8-customer@viennasalsastudio.test");
  if (!kunde) throw new Error("Testkunde fehlt — Seed nicht gelaufen?");
  kundeId = kunde.id;

  const { data: standort, error: standortFehler } = await service
    .from("locations")
    .insert({ name: STANDORT, address: ANSCHRIFT, description: WEGBESCHREIBUNG })
    .select("id")
    .single();
  if (standortFehler) throw new Error(`Standort: ${standortFehler.message}`);
  standortId = standort.id;

  const { data: raum, error: raumFehler } = await service
    .from("rooms")
    .insert({ name: `${KENNUNG} Saal`, location_id: standortId })
    .select("id")
    .single();
  if (raumFehler) throw new Error(`Raum: ${raumFehler.message}`);
  raumId = raum.id;

  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({ name: `${KENNUNG} Kurs`, room_id: raumId, price: 50 })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`Kurs: ${kursFehler.message}`);
  kursId = kurs.id;

  const { data: buchung, error: buchungFehler } = await service
    .from("course_bookings")
    .insert({
      customer_id: kundeId,
      course_id: kursId,
      type: "dropin",
      status: "confirmed",
      chosen_date: morgen(),
    })
    .select("id")
    .single();
  if (buchungFehler) throw new Error(`Buchung: ${buchungFehler.message}`);
  buchungId = buchung.id;
});

afterAll(async () => {
  if (buchungId) await service.from("course_bookings").delete().eq("id", buchungId);
  if (kursId) await service.from("courses").delete().eq("id", kursId);
  if (raumId) await service.from("rooms").delete().eq("id", raumId);
  if (standortId) await service.from("locations").delete().eq("id", standortId);
});

describe("PROJ-67: Der Standort in der Kursstart-Erinnerung", () => {
  it("nennt Standort und Anschrift in der E-Mail", async () => {
    const inhalt = await resolveContent(service, {
      id: "probe",
      customer_id: kundeId,
      event_type: "kursstart_erinnerung",
      payload: { booking_id: buchungId },
    });

    expect(inhalt, "Kein Inhalt erzeugt").toBeTruthy();
    expect(inhalt!.emailHtml).toContain(STANDORT);
    expect(inhalt!.emailHtml).toContain(ANSCHRIFT);
  });

  // PROJ-77: Die Beschreibung des Standorts steht in der E-Mail — und *nicht*
  // in der Push-Nachricht, dort wäre eine Wegbeschreibung zu lang.
  it("nennt die Wegbeschreibung in der E-Mail, nicht am Handy", async () => {
    const inhalt = await resolveContent(service, {
      id: "probe",
      customer_id: kundeId,
      event_type: "kursstart_erinnerung",
      payload: { booking_id: buchungId },
    });

    expect(inhalt!.emailHtml).toContain("So findest du uns");
    expect(inhalt!.emailHtml).toContain("Eingang über den Hof");
    expect(inhalt!.pushBody).not.toContain("Eingang über den Hof");
  });

  it("lässt die Wegbeschreibung weg, wenn der Standort keine hat", async () => {
    await service.from("locations").update({ description: null }).eq("id", standortId);
    try {
      const inhalt = await resolveContent(service, {
        id: "probe",
        customer_id: kundeId,
        event_type: "kursstart_erinnerung",
        payload: { booking_id: buchungId },
      });

      // Kein Satzanfang ohne Fortsetzung: Die Einleitung entsteht im Code und
      // bleibt damit ganz weg.
      expect(inhalt!.emailHtml).not.toContain("So findest du uns");
      // Der Standort selbst steht weiterhin da.
      expect(inhalt!.emailHtml).toContain(STANDORT);
    } finally {
      await service.from("locations").update({ description: WEGBESCHREIBUNG }).eq("id", standortId);
    }
  });

  it("nennt ihn auch in der Mitteilung aufs Handy", async () => {
    const inhalt = await resolveContent(service, {
      id: "probe",
      customer_id: kundeId,
      event_type: "kursstart_erinnerung",
      payload: { booking_id: buchungId },
    });

    expect(inhalt!.pushBody).toContain(STANDORT);
  });

  it("nennt weiterhin Kurs und Art der Buchung", async () => {
    // Die alte Auskunft darf durch die neue nicht verdrängt werden.
    const inhalt = await resolveContent(service, {
      id: "probe",
      customer_id: kundeId,
      event_type: "kursstart_erinnerung",
      payload: { booking_id: buchungId },
    });

    expect(inhalt!.subject).toContain(`${KENNUNG} Kurs`);
    expect(inhalt!.subject).toContain("Drop-in");
  });

  it("fällt auf den Raumnamen zurück, wenn der Standort keine Anschrift hat", async () => {
    await service.from("locations").update({ address: null }).eq("id", standortId);
    try {
      const inhalt = await resolveContent(service, {
        id: "probe",
        customer_id: kundeId,
        event_type: "kursstart_erinnerung",
        payload: { booking_id: buchungId },
      });

      expect(inhalt!.emailHtml).toContain(STANDORT);
      // Kein Komma, hinter dem nichts mehr kommt.
      expect(inhalt!.emailHtml).not.toContain(`${STANDORT},`);
    } finally {
      await service.from("locations").update({ address: ANSCHRIFT }).eq("id", standortId);
    }
  });
});
