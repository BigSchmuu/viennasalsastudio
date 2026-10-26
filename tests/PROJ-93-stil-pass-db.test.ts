import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";
import { ladeTestUmgebung } from "./env";

/**
 * PROJ-93: Der Pass für eine Stilrichtung.
 *
 * Geprüft wird die Grenze — und zwar von beiden Seiten. Dass ein Bachata-Pass
 * Bachata deckt, ist die halbe Aussage; die andere Hälfte ist, dass er den
 * Kunden **nicht** aus den Salsa-Kursen aussperrt. Genau das wäre der Fehler,
 * den die alte Annahme „wer eine Flatrate hat, hat alles" verursacht hätte.
 *
 * Braucht die Migration 20261026100000_proj93_stil_pass.sql.
 */

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen — unkritisch.
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";
const KUNDE = "proj93-kunde@viennasalsastudio.test";
const AGB = "2026-08";
const PASSPREIS = 85;
const PASSPREIS_STUD = 70;

let service: SupabaseClient;
let alsKunde: SupabaseClient;
let kundeId = "";
let stilMitPass = "";
let stilOhnePass = "";
let kursMitPass = "";
let kursOhnePass = "";
let kursOhneStil = "";

/** Ein Kurs mit Stilrichtung, Zeitplan und Einstiegstermin. */
async function kursAnlegen(name: string, stilId: string | null): Promise<string> {
  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data, error } = await service
    .from("courses")
    .insert({ name, room_id: raum!.id, price: 65, dance_style_id: stilId })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-93 Kurs ${name}: ${error.message}`);
  await service.from("course_schedule").insert({
    course_id: data!.id,
    weekday: 2,
    start_time: "18:00:00",
    end_time: "19:00:00",
  });
  return data!.id;
}

/** Ein kursloses Abo: mit Stilrichtung ein Pass, ohne die volle Flatrate. */
async function kurslosesAbo(stilId: string | null): Promise<string> {
  const { data, error } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: null,
      dance_style_id: stilId,
      status: "active",
      name: stilId ? "E2E93 Pass" : "E2E93 Flatrate",
      price: stilId ? PASSPREIS : 145,
      cycle_anchor_date: "2026-01-07",
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-93 Abo: ${error.message}`);
  return data!.id;
}

async function aboWeg(): Promise<void> {
  await service.from("course_memberships").delete().eq("customer_id", kundeId);
  await service.from("course_bookings").delete().eq("customer_id", kundeId);
  const { error } = await service.from("subscriptions").delete().eq("customer_id", kundeId);
  if (error) throw new Error(`PROJ-93 Aufräumen: ${error.message}`);
}

async function deckung(kursId: string): Promise<string | null> {
  const { data, error } = await alsKunde.rpc("deckt_abo_kurs", {
    p_customer_id: kundeId,
    p_course_id: kursId,
  });
  if (error) throw new Error(`PROJ-93 deckt_abo_kurs: ${error.message}`);
  return data as string | null;
}

async function preis(kursId: string, plan: string, student = false): Promise<number | null> {
  const { data, error } = await alsKunde.rpc("resolve_plan_price", {
    p_course_id: kursId,
    p_desired_plan: plan,
    p_wants_student_price: student,
  });
  if (error) throw new Error(`PROJ-93 resolve_plan_price: ${error.message}`);
  return data === null ? null : Number(data);
}

async function buche(kursId: string, plan: string) {
  return alsKunde.rpc("create_regular_course_booking", {
    p_course_id: kursId,
    p_desired_plan: plan,
    p_chosen_date: "2026-11-03",
    p_note: "",
    p_terms_accepted: true,
    p_terms_version: AGB,
  });
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === KUNDE);
  if (alt) {
    await service.from("course_memberships").delete().eq("customer_id", alt.id);
    await service.from("course_bookings").delete().eq("customer_id", alt.id);
    await service.from("subscriptions").delete().eq("customer_id", alt.id);
    await service.from("sepa_mandates").delete().eq("customer_id", alt.id);
    await service.auth.admin.deleteUser(alt.id);
  }
  const { data, error } = await service.auth.admin.createUser({
    email: KUNDE,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-93 Konto: ${error?.message}`);
  kundeId = data.user.id;
  await service.from("profiles").update({ full_name: "E2E93 Passkunde", referral_source: "google" }).eq("id", kundeId);
  await service.from("sepa_mandates").insert({
    customer_id: kundeId,
    iban: "AT611904300234573201",
    account_holder_name: "E2E93 Passkunde",
    mandate_reference: `E2E93-${Date.now()}`,
    consented_at: new Date().toISOString(),
  });

  const marke = Date.now();
  const { data: stile, error: stilFehler } = await service
    .from("dance_styles")
    .insert([
      { name: `E2E93 MitPass ${marke}`, pass_price: PASSPREIS, pass_student_price: PASSPREIS_STUD },
      { name: `E2E93 OhnePass ${marke}` },
    ])
    .select("id, pass_price");
  if (stilFehler) throw new Error(`PROJ-93 Tanzstile: ${stilFehler.message}`);
  stilMitPass = stile!.find((s) => s.pass_price !== null)!.id;
  stilOhnePass = stile!.find((s) => s.pass_price === null)!.id;

  kursMitPass = await kursAnlegen(`E2E93 Kurs mit Pass ${marke}`, stilMitPass);
  kursOhnePass = await kursAnlegen(`E2E93 Kurs ohne Pass ${marke}`, stilOhnePass);
  kursOhneStil = await kursAnlegen(`E2E93 Kurs ohne Stil ${marke}`, null);

  alsKunde = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
}, 120_000);

afterAll(async () => {
  await aboWeg().catch(() => {});
  for (const kurs of [kursMitPass, kursOhnePass, kursOhneStil].filter(Boolean)) {
    await service.from("course_schedule").delete().eq("course_id", kurs);
    await service.from("courses").delete().eq("id", kurs);
  }
  for (const stil of [stilMitPass, stilOhnePass].filter(Boolean)) {
    await service.from("dance_styles").delete().eq("id", stil);
  }
  if (kundeId) {
    await service.from("sepa_mandates").delete().eq("customer_id", kundeId);
    await service.auth.admin.deleteUser(kundeId).catch(() => {});
  }
});

describe("PROJ-93: Deckt das Abo diesen Kurs?", () => {
  it("deckt ohne kursloses Abo gar nichts", async () => {
    await aboWeg();
    expect(await deckung(kursMitPass)).toBeNull();
  });

  it("deckt mit der vollen Flatrate jeden Kurs — auch einen ohne Stilrichtung", async () => {
    await aboWeg();
    const abo = await kurslosesAbo(null);
    expect(await deckung(kursMitPass)).toBe(abo);
    expect(await deckung(kursOhnePass)).toBe(abo);
    expect(await deckung(kursOhneStil)).toBe(abo);
  });

  it("deckt mit einem Pass nur Kurse seiner Stilrichtung", async () => {
    await aboWeg();
    const abo = await kurslosesAbo(stilMitPass);
    expect(await deckung(kursMitPass)).toBe(abo);
    expect(await deckung(kursOhnePass)).toBeNull();
  });

  // Sonst käme ein Kurs ohne Zuordnung versehentlich in jeden Pass.
  it("deckt mit einem Pass keinen Kurs ohne Stilrichtung", async () => {
    await aboWeg();
    await kurslosesAbo(stilMitPass);
    expect(await deckung(kursOhneStil)).toBeNull();
  });
});

describe("PROJ-93: Der Preis hängt am Stil", () => {
  it("nimmt den Passpreis der Stilrichtung", async () => {
    expect(await preis(kursMitPass, "style_pass")).toBe(PASSPREIS);
  });

  it("nimmt den ermäßigten Passpreis", async () => {
    expect(await preis(kursMitPass, "style_pass", true)).toBe(PASSPREIS_STUD);
  });

  it("gibt keinen Preis, wo es keinen Pass gibt", async () => {
    expect(await preis(kursOhnePass, "style_pass")).toBeNull();
    expect(await preis(kursOhneStil, "style_pass")).toBeNull();
  });

  it("lässt Kursabo und Flatrate unberührt", async () => {
    expect(await preis(kursMitPass, "single_course")).toBe(65);
    expect(await preis(kursMitPass, "flatrate")).not.toBeNull();
  });
});

describe("PROJ-93: Einen Pass buchen", () => {
  it("legt die Anfrage mit Tarif und Passpreis an", async () => {
    await aboWeg();
    const { data, error } = await buche(kursMitPass, "style_pass");
    expect(error, `Buchen scheiterte: ${error?.message}`).toBeNull();
    expect(data!.desired_plan).toBe("style_pass");
    expect(Number(data!.price)).toBe(PASSPREIS);
  });

  it("weist einen Pass ab, wo die Stilrichtung keinen hat", async () => {
    await aboWeg();
    const { error } = await buche(kursOhnePass, "style_pass");
    expect(error?.message).toContain("no pass for this style");
  });

  it("weist einen Pass ab, wenn der Kurs keine Stilrichtung hat", async () => {
    await aboWeg();
    const { error } = await buche(kursOhneStil, "style_pass");
    expect(error?.message).toContain("course has no dance style");
  });

  // Zwei Pässe wären teurer als die Flatrate — und die Frage „welches Abo
  // deckt diesen Kurs" bliebe nicht mehr eindeutig. Hergestellt wird der Fall
  // mit einem **zweiten** Pass-Stil: Bei einem Kurs, den der laufende Pass
  // schon deckt, greift zu Recht die frühere Meldung „flatrate covers this".
  it("lässt kein zweites kursloses Abo zu", async () => {
    await aboWeg();
    await kurslosesAbo(stilMitPass);
    await service.from("dance_styles").update({ pass_price: 60 }).eq("id", stilOhnePass);
    try {
      const { error } = await buche(kursOhnePass, "style_pass");
      expect(error?.message).toContain("already has open plan");
    } finally {
      await service.from("dance_styles").update({ pass_price: null }).eq("id", stilOhnePass);
    }
  });

  it("weist eine Flatrate ab, solange ein Pass läuft", async () => {
    await aboWeg();
    await kurslosesAbo(stilMitPass);
    // Ein Kurs, den der Pass **nicht** deckt — sonst käme die Deckungsmeldung
    // zuerst, und geprüft wäre etwas anderes.
    const { error } = await buche(kursOhnePass, "flatrate");
    expect(error?.message).toContain("already has open plan");
  });

  // Die eigentliche Pointe: Der Pass darf den Kunden nicht aus den anderen
  // Stilrichtungen aussperren. Vorher hätte „flatrate covers this" gegriffen.
  it("lässt mit einem Pass einen Kurs der anderen Stilrichtung einzeln buchen", async () => {
    await aboWeg();
    await kurslosesAbo(stilMitPass);
    const { data, error } = await buche(kursOhnePass, "single_course");
    expect(error, `Einzelbuchung scheiterte: ${error?.message}`).toBeNull();
    expect(data!.desired_plan).toBe("single_course");
  });

  it("weist eine Buchung ab, die der Pass schon deckt", async () => {
    await aboWeg();
    await kurslosesAbo(stilMitPass);
    const { error } = await buche(kursMitPass, "single_course");
    expect(error?.message).toContain("flatrate covers this");
  });
});

describe("PROJ-93: Kurse zum Pass hinzufügen", () => {
  async function hinzufuegen(kursId: string) {
    return alsKunde.rpc("add_course_to_flatrate", {
      p_course_id: kursId,
      p_dance_role: null,
      p_prerequisite_confirmed: false,
    });
  }

  it("nimmt einen Kurs der eigenen Stilrichtung auf", async () => {
    await aboWeg();
    const abo = await kurslosesAbo(stilMitPass);
    const { data, error } = await hinzufuegen(kursMitPass);
    expect(error, `Hinzufügen scheiterte: ${error?.message}`).toBeNull();
    expect(data!.subscription_id).toBe(abo);
  });

  it("weist einen Kurs einer anderen Stilrichtung ab — mit eigener Begründung", async () => {
    await aboWeg();
    await kurslosesAbo(stilMitPass);
    const { error } = await hinzufuegen(kursOhnePass);
    // Nicht „no flatrate": Er hat eine, nur eine engere.
    expect(error?.message).toContain("pass does not cover");
  });

  it("sagt ohne kursloses Abo weiterhin „no flatrate“", async () => {
    await aboWeg();
    const { error } = await hinzufuegen(kursMitPass);
    expect(error?.message).toContain("no flatrate");
  });
});
