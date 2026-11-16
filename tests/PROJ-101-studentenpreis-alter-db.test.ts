import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";
import { angemeldetAls } from "./anmeldung";

ladeTestUmgebung();

/**
 * PROJ-101: Der Studierendenpreis gilt bis einschliesslich 27.
 *
 * Geprueft wird hier die Regel selbst und die Stelle, an der sie greift. Das
 * ist bewusst **nicht** die Oberflaeche: Das Kennzeichen `wants_student_price`
 * kommt als Parameter an den Buchungsfunktionen an, ein verstecktes Kaestchen
 * haelt niemanden auf, der die Anfrage selbst schickt. Genau dieser Weg wird
 * unten gegangen — direkt in die Tabelle, am Dialog vorbei.
 *
 * Die erwarteten Preise werden **nicht** eingetippt, sondern aus
 * `resolve_plan_price` geholt — derselben Quelle, aus der die Anwendung sie
 * nimmt. Eingetippte Zahlen wuerden beim naechsten Preiswechsel rot, ohne dass
 * etwas kaputt ist. Zusaetzlich prueft jeder Fall, dass sich ermaessigter und
 * normaler Preis ueberhaupt unterscheiden: Waeren beide gleich, wuerde der Test
 * nichts belegen.
 *
 * Braucht die Migration 20261116100000_proj101_studentenpreis_alter.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";
const ADMIN = "e2e8-admin@viennasalsastudio.test";

const stempel = Date.now();

let service: SupabaseClient;
let alsAdmin: SupabaseClient;

let kursId = "";
let eventId = "";
const konten: Record<string, string> = {};
const abos: string[] = [];
const buchungen: string[] = [];
const tickets: string[] = [];

/** Wiener Kalendertag mit Versatz in Jahren und Tagen. */
function datum(jahre: number, tage = 0): string {
  const heute = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Vienna" }));
  heute.setFullYear(heute.getFullYear() - jahre);
  heute.setDate(heute.getDate() + tage);
  const m = String(heute.getMonth() + 1).padStart(2, "0");
  const t = String(heute.getDate()).padStart(2, "0");
  return `${heute.getFullYear()}-${m}-${t}`;
}

async function kontoAnlegen(kennung: string, geburtsdatum: string | null): Promise<string> {
  const mail = `proj101-${kennung}-${stempel}@viennasalsastudio.test`;
  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-101 Konto ${kennung}: ${error?.message}`);
  await service
    .from("profiles")
    .update({ full_name: `E2E101 ${kennung} ${stempel}`, birthdate: geburtsdatum })
    .eq("id", data.user.id);
  return data.user.id;
}

/** Was die Anwendung als Preis bekaeme — dieselbe Funktion, beide Stufen. */
async function planPreis(plan: string, student: boolean): Promise<number> {
  const { data, error } = await alsAdmin.rpc("resolve_plan_price", {
    p_course_id: kursId,
    p_desired_plan: plan,
    p_wants_student_price: student,
  });
  if (error) throw new Error(`PROJ-101 resolve_plan_price: ${error.message}`);
  return Number(data);
}

/** Eine Buchungsanfrage, direkt in die Tabelle — am Dialog vorbei. */
async function anfrageAnlegen(
  kundeId: string,
  opt: { typ?: string; plan?: string | null; preis: number }
) {
  const { data, error } = await service
    .from("course_bookings")
    .insert({
      customer_id: kundeId,
      course_id: kursId,
      type: opt.typ ?? "regular",
      status: "open",
      chosen_date: datum(0, 7),
      // `desired_plan`: single_course | flatrate | style_pass — oder leer,
      // wie beim Drop-in.
      desired_plan: opt.plan === undefined ? "single_course" : opt.plan,
      wants_student_price: true,
      price: opt.preis,
    })
    .select("id, price, wants_student_price")
    .single();
  if (error) throw new Error(`PROJ-101 Anfrage: ${error.message}`);
  buchungen.push(data!.id);
  return data!;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });
  alsAdmin = await angemeldetAls(URL, ANON, ADMIN, PASSWORT);

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error } = await service
    .from("courses")
    .insert({ name: `E2E101 Alterskurs ${stempel}`, room_id: raum!.id, price: 85 })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-101 Kurs: ${error.message}`);
  kursId = kurs!.id;

  // Eventart: die erste vorhandene genuegt — geprueft wird der Preis, nicht
  // die Art.
  const { data: art, error: artFehler } = await service
    .from("event_types")
    .select("id")
    .limit(1)
    .single();
  if (artFehler) throw new Error(`PROJ-101 Eventart: ${artFehler.message}`);

  const { data: event, error: eventFehler } = await service
    .from("events")
    .insert({
      event_type_id: art!.id,
      name: `E2E101 Altersevent ${stempel}`,
      slug: `e2e101-altersevent-${stempel}`,
      starts_at: `${datum(0, 14)}T20:00:00+01:00`,
      price_normal: 30,
      price_student: 18,
      capacity: 50,
      // `events.status` kennt nur 'geplant' und 'abgesagt' (PROJ-14).
      status: "geplant",
    })
    .select("id")
    .single();
  if (eventFehler) throw new Error(`PROJ-101 Event: ${eventFehler.message}`);
  eventId = event!.id;

  konten.jung = await kontoAnlegen("jung", datum(25));
  konten.genau28 = await kontoAnlegen("genau28", datum(28));
  konten.fast28 = await kontoAnlegen("fast28", datum(28, 1));
  konten.ohneDatum = await kontoAnlegen("ohnedatum", null);
}, 60000);

afterAll(async () => {
  if (tickets.length) await service.from("tickets").delete().in("id", tickets);
  if (buchungen.length) await service.from("course_bookings").delete().in("id", buchungen);
  if (abos.length) await service.from("subscriptions").delete().in("id", abos);
  if (eventId) await service.from("events").delete().eq("id", eventId);
  if (kursId) {
    await service.from("course_memberships").delete().eq("course_id", kursId);
    await service.from("courses").delete().eq("id", kursId);
  }
  for (const id of Object.values(konten)) {
    await service.from("subscription_surcharges").delete().eq("customer_id", id);
    await service.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe("PROJ-101: Die Regel selbst", () => {
  async function erlaubt(kundeId: string, stichtag?: string): Promise<boolean> {
    const { data, error } = await alsAdmin.rpc("studentenpreis_erlaubt", {
      p_customer_id: kundeId,
      ...(stichtag ? { p_stichtag: stichtag } : {}),
    });
    if (error) throw new Error(`PROJ-101 erlaubt: ${error.message}`);
    return data === true;
  }

  it("erlaubt es bis einschliesslich 27", async () => {
    expect(await erlaubt(konten.jung)).toBe(true);
    // Wer morgen 28 wird, ist heute 27 — und damit noch dabei.
    expect(await erlaubt(konten.fast28)).toBe(true);
  });

  it("beendet es am 28. Geburtstag", async () => {
    expect(await erlaubt(konten.genau28)).toBe(false);
    // Einen Tag vorher galt es noch.
    expect(await erlaubt(konten.genau28, datum(0, -1))).toBe(true);
  });

  it("verweigert es ohne hinterlegtes Geburtsdatum", async () => {
    // Sonst traefe die Regel genau die, die nichts angegeben haben.
    expect(await erlaubt(konten.ohneDatum)).toBe(false);
  });

  it("rechnet mit dem Stichtag, nicht mit heute", async () => {
    // Derselbe Kunde, zwei Stichtage: Die Grenze liegt dazwischen.
    expect(await erlaubt(konten.fast28, datum(0, 1))).toBe(false);
    expect(await erlaubt(konten.fast28, datum(0))).toBe(true);
  });

  it("antwortet fuer einen unbekannten Kunden mit nein, nicht mit nichts", async () => {
    expect(await erlaubt("00000000-0000-0000-0000-000000000000")).toBe(false);
  });
});

describe("PROJ-101: Die Buchungsanfrage", () => {
  it("laesst die ermaessigte Anfrage eines 25-Jaehrigen in Ruhe", async () => {
    const ermaessigt = await planPreis("single_course", true);
    const normal = await planPreis("single_course", false);
    // Ohne Unterschied wuerde dieser Test nichts belegen.
    expect(ermaessigt).toBeLessThan(normal);

    const zeile = await anfrageAnlegen(konten.jung, { preis: ermaessigt });
    expect(zeile.wants_student_price).toBe(true);
    expect(Number(zeile.price)).toBe(ermaessigt);
  });

  it("macht aus der Anfrage eines 28-Jaehrigen den Normalpreis", async () => {
    const ermaessigt = await planPreis("single_course", true);
    const normal = await planPreis("single_course", false);

    // Der Weg am Dialog vorbei: Kennzeichen gesetzt, ermaessigter Preis
    // mitgeschickt. Genau so kaeme der Angriff.
    const zeile = await anfrageAnlegen(konten.genau28, { preis: ermaessigt });
    expect(zeile.wants_student_price).toBe(false);
    expect(Number(zeile.price)).toBe(normal);
  });

  it("tut dasselbe ohne hinterlegtes Geburtsdatum", async () => {
    const normal = await planPreis("single_course", false);
    const zeile = await anfrageAnlegen(konten.ohneDatum, { preis: await planPreis("single_course", true) });
    expect(zeile.wants_student_price).toBe(false);
    expect(Number(zeile.price)).toBe(normal);
  });

  it("greift auch bei der Flatrate", async () => {
    const ermaessigt = await planPreis("flatrate", true);
    const normal = await planPreis("flatrate", false);
    expect(ermaessigt).toBeLessThan(normal);

    const zeile = await anfrageAnlegen(konten.genau28, { plan: "flatrate", preis: ermaessigt });
    expect(zeile.wants_student_price).toBe(false);
    expect(Number(zeile.price)).toBe(normal);
  });

  it("greift beim Drop-in mit dem Drop-in-Preis", async () => {
    const { data: preise } = await service.from("dropin_pricing").select("normal_price, student_price").limit(1).single();
    expect(Number(preise!.student_price)).toBeLessThan(Number(preise!.normal_price));

    const zeile = await anfrageAnlegen(konten.genau28, {
      typ: "dropin",
      plan: null,
      preis: Number(preise!.student_price),
    });
    expect(zeile.wants_student_price).toBe(false);
    expect(Number(zeile.price)).toBe(Number(preise!.normal_price));
  });

  it("laesst eine Anfrage ohne Kennzeichen unberuehrt", async () => {
    // Der Trigger darf nur anfassen, was den Rabatt verlangt. Ein Preis, den
    // die Verwaltung von Hand setzt, bleibt stehen.
    const { data, error } = await service
      .from("course_bookings")
      .insert({
        customer_id: konten.genau28,
        course_id: kursId,
        type: "regular",
        status: "open",
        chosen_date: datum(0, 7),
        desired_plan: "single_course",
        wants_student_price: false,
        price: 1,
      })
      .select("id, price, wants_student_price")
      .single();
    if (error) throw new Error(`PROJ-101 Anfrage ohne Kennzeichen: ${error.message}`);
    buchungen.push(data!.id);
    expect(Number(data!.price)).toBe(1);
    expect(data!.wants_student_price).toBe(false);
  });
});

describe("PROJ-101: Das Event-Ticket", () => {
  async function ticketAnlegen(kundeId: string, preis: number) {
    const { data, error } = await service
      .from("tickets")
      .insert({
        customer_id: kundeId,
        event_id: eventId,
        payment_method: "onsite",
        price: preis,
        // `tickets.status`: reserved | confirmed | checked_in | cancelled.
        status: "confirmed",
        wants_student_price: true,
      })
      .select("id, price, wants_student_price")
      .single();
    if (error) throw new Error(`PROJ-101 Ticket: ${error.message}`);
    tickets.push(data!.id);
    return data!;
  }

  it("laesst den ermaessigten Preis eines 25-Jaehrigen stehen", async () => {
    const zeile = await ticketAnlegen(konten.jung, 18);
    expect(zeile.wants_student_price).toBe(true);
    expect(Number(zeile.price)).toBe(18);
  });

  it("macht aus dem ermaessigten Ticket eines 28-Jaehrigen das normale", async () => {
    const zeile = await ticketAnlegen(konten.genau28, 18);
    expect(zeile.wants_student_price).toBe(false);
    expect(Number(zeile.price)).toBe(30);
  });
});

describe("PROJ-101: Das Flatrate-Upgrade", () => {
  async function upgradeVorbereiten(kundeId: string): Promise<string> {
    const { data, error } = await service
      .from("subscriptions")
      .insert({
        customer_id: kundeId,
        course_id: kursId,
        status: "active",
        name: `E2E101 Kursabo ${stempel}`,
        price: 85,
        cycle_anchor_date: datum(0, -14),
        upgrade_requested_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-101 Abo: ${error.message}`);
    abos.push(data!.id);
    return data!.id;
  }

  it("gibt dem 25-Jaehrigen die Studierenden-Flatrate", async () => {
    const { data: preise } = await service
      .from("dropin_pricing")
      .select("flatrate_price, flatrate_student_price")
      .limit(1)
      .single();
    expect(Number(preise!.flatrate_student_price)).toBeLessThan(Number(preise!.flatrate_price));

    const aboId = await upgradeVorbereiten(konten.jung);
    const { error } = await alsAdmin.rpc("confirm_flatrate_upgrade", {
      p_subscription_id: aboId,
      p_student: true,
      p_differenz: 0,
    });
    expect(error).toBeNull();

    const { data: abo } = await service.from("subscriptions").select("price").eq("id", aboId).single();
    expect(Number(abo!.price)).toBe(Number(preise!.flatrate_student_price));
  });

  it("gibt dem 28-Jaehrigen die normale Flatrate, auch wenn der Haken gesetzt ist", async () => {
    const { data: preise } = await service
      .from("dropin_pricing")
      .select("flatrate_price")
      .limit(1)
      .single();

    const aboId = await upgradeVorbereiten(konten.genau28);
    // Der Betreiber hat sich geirrt. Das Upgrade entsteht trotzdem — nur zum
    // richtigen Preis.
    const { error } = await alsAdmin.rpc("confirm_flatrate_upgrade", {
      p_subscription_id: aboId,
      p_student: true,
      p_differenz: 0,
    });
    expect(error).toBeNull();

    const { data: abo } = await service.from("subscriptions").select("price").eq("id", aboId).single();
    expect(Number(abo!.price)).toBe(Number(preise!.flatrate_price));
  });
});

describe("PROJ-101: Die Auskunft fuer die Oberflaeche", () => {
  it("sagt einem nicht angemeldeten Besucher, dass sie ihn nicht kennt", async () => {
    const anonym = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data, error } = await anonym.rpc("studentenpreis_auskunft");
    // Mit `anon` darf die Funktion gar nicht laufen: revoke all … from anon.
    if (!error) {
      expect((data ?? [])[0]).toMatchObject({ moeglich: false, grund: "nicht_angemeldet" });
    } else {
      expect(error.message).toMatch(/permission denied|not exist/i);
    }
  });

  it("nennt dem 28-Jaehrigen den Grund", async () => {
    const alsAlter = await angemeldetAls(
      URL,
      ANON,
      `proj101-genau28-${stempel}@viennasalsastudio.test`,
      PASSWORT
    );
    const { data, error } = await alsAlter.rpc("studentenpreis_auskunft");
    expect(error).toBeNull();
    expect((data ?? [])[0]).toMatchObject({ moeglich: false, grund: "zu_alt" });
  });

  it("nennt dem Kunden ohne Geburtsdatum den anderen Grund", async () => {
    const ohne = await angemeldetAls(
      URL,
      ANON,
      `proj101-ohnedatum-${stempel}@viennasalsastudio.test`,
      PASSWORT
    );
    const { data, error } = await ohne.rpc("studentenpreis_auskunft");
    expect(error).toBeNull();
    expect((data ?? [])[0]).toMatchObject({ moeglich: false, grund: "kein_geburtsdatum" });
  });

  it("sagt dem 25-Jaehrigen ja", async () => {
    const jung = await angemeldetAls(
      URL,
      ANON,
      `proj101-jung-${stempel}@viennasalsastudio.test`,
      PASSWORT
    );
    const { data, error } = await jung.rpc("studentenpreis_auskunft");
    expect(error).toBeNull();
    expect((data ?? [])[0]).toMatchObject({ moeglich: true, grund: "ok" });
  });
});
