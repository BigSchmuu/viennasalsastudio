import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-99: Die Auswahl beim Eintragen.
 *
 * Zwei Lücken in `get_course_cash_candidates`:
 *
 * 1. Sie fragte nur nach einem eingetragenen Kursplatz. Ein Pass-Inhaber ohne
 *    Kursplatz war deshalb nicht auswählbar — und die Lehrkraft legte ihn als
 *    Gast an, womit dieselbe Person zweimal im System stand. Geprüft wird hier
 *    die Deckungsregel: Pass der passenden Stilrichtung ja, fremder Stil nein,
 *    Flatrate überall.
 * 2. Nach einem Abschluss (PROJ-98) musste jeder Stammzahler neu gesucht
 *    werden. Jetzt nennt die Auswahl den Betrag aus dem vorigen Zyklus.
 *
 * Geprüft mit dem Zugang der **Lehrkraft**: Die Funktion ist `security
 * definer` und prüft selbst, wer fragt. Mit dem Dienstschlüssel geprüft wäre
 * der Rechteteil nie geprüft.
 *
 * Braucht die Migrationen 20261105160000_proj98_barzahlung_zyklen.sql und
 * 20261105180000_proj99_barzahler_auswahl.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";
const LEHRER = "e2e13-lehrer-a@viennasalsastudio.test";

const marke = Date.now();

const PASS_A_NAME = `E2E99 Paul PassA ${marke}`;
const PASS_B_NAME = `E2E99 Bea PassB ${marke}`;
const FLAT_NAME = `E2E99 Fritz Flat ${marke}`;
const KURS_NAME = `E2E99 Klara Kurs ${marke}`;
const DRAUF_NAME = `E2E99 Doris Drauf ${marke}`;
const BEENDET_NAME = `E2E99 Enzo Ende ${marke}`;

let service: SupabaseClient;
let alsLehrer: SupabaseClient;

let stilA = "";
let stilB = "";
let kursA = "";
let kursB = "";

const kunde: Record<string, string> = {};
const abo: Record<string, string> = {};
const konten: string[] = [];
const kurse: string[] = [];
const stile: string[] = [];
let zyklusId = "";

function tag(versatz: number): string {
  const jetzt = new Date();
  jetzt.setUTCDate(jetzt.getUTCDate() + versatz);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(jetzt);
}

async function konto(name: string, kennung: string): Promise<string> {
  const { data, error } = await service.auth.admin.createUser({
    email: `proj99-${kennung}-${marke}@viennasalsastudio.test`,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-99 Konto: ${error?.message}`);
  konten.push(data.user.id);
  await service.from("profiles").update({ full_name: name }).eq("id", data.user.id);
  return data.user.id;
}

async function kurs(name: string, stil: string | null): Promise<string> {
  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data, error } = await service
    .from("courses")
    .insert({ name, room_id: raum!.id, price: 89, dance_style_id: stil })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-99 Kurs: ${error.message}`);
  kurse.push(data!.id);
  const { data: lehrer } = await service
    .from("profiles")
    .select("id")
    .eq("full_name", "E2E13 Lehrer A")
    .single();
  await service.from("course_teachers").insert({ course_id: data!.id, teacher_id: lehrer!.id });
  return data!.id;
}

async function abonnement(
  kundeId: string,
  name: string,
  felder: { kurs?: string | null; stil?: string | null; status?: string; preis?: number }
): Promise<string> {
  const { data, error } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: felder.kurs ?? null,
      dance_style_id: felder.stil ?? null,
      status: felder.status ?? "active",
      name,
      price: felder.preis ?? 45,
      cycle_anchor_date: "2026-01-07",
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-99 Abo (${name}): ${error.message}`);
  abo[name] = data!.id;
  return data!.id;
}

async function auswahl(kursId: string, client: SupabaseClient = alsLehrer) {
  const { data, error } = await client.rpc("get_course_cash_candidates", {
    p_course_id: kursId,
  });
  if (error) throw new Error(`PROJ-99 Auswahl: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

function namen(zeilen: Record<string, unknown>[]): string[] {
  return zeilen.map((z) => String(z.full_name));
}

/** Einen abgeschlossenen Zyklus samt Abschrift herstellen. */
async function zyklusMitAbschrift(
  eintraege: { aboName: string; betrag: number }[]
): Promise<void> {
  await service.from("cash_cycles").delete().not("id", "is", null);
  const { data, error } = await service
    .from("cash_cycles")
    .insert({ starts_on: tag(-30), ends_on: tag(-3) })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-99 Zyklus: ${error.message}`);
  zyklusId = data!.id;

  for (const e of eintraege) {
    const { error: zeilenFehler } = await service.from("cash_cycle_entries").insert({
      cycle_id: zyklusId,
      customer_id: kundeVonAbo(e.aboName),
      subscription_id: abo[e.aboName],
      amount_due: e.betrag,
    });
    if (zeilenFehler) throw new Error(`PROJ-99 Abschrift: ${zeilenFehler.message}`);
  }
}

function kundeVonAbo(aboName: string): string {
  const eintrag = Object.entries(zuordnung).find(([name]) => name === aboName);
  if (!eintrag) throw new Error(`PROJ-99: kein Kunde zu ${aboName}`);
  return kunde[eintrag[1]];
}

/** Welches Abo zu welchem Menschen gehört — für die Abschrift. */
const zuordnung: Record<string, string> = {};

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  for (const name of [`E2E99 StilA ${marke}`, `E2E99 StilB ${marke}`]) {
    const { data, error } = await service
      .from("dance_styles")
      .insert({ name, pass_price: 45 })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-99 Stil: ${error.message}`);
    stile.push(data!.id);
  }
  [stilA, stilB] = stile;

  kursA = await kurs(`E2E99 Kurs A ${marke}`, stilA);
  kursB = await kurs(`E2E99 Kurs B ${marke}`, stilB);

  // 1. Pass der Stilrichtung von Kurs A — **ohne** eingetragenen Kursplatz.
  //    Genau dieser Mensch war vorher nicht auswählbar.
  kunde.passA = await konto(PASS_A_NAME, "passa");
  await abonnement(kunde.passA, "PassA", { stil: stilA });
  zuordnung.PassA = "passA";

  // 2. Pass einer anderen Stilrichtung — er darf in Kurs A nicht erscheinen.
  kunde.passB = await konto(PASS_B_NAME, "passb");
  await abonnement(kunde.passB, "PassB", { stil: stilB });
  zuordnung.PassB = "passB";

  // 3. Volle Flatrate — sie deckt jeden Kurs.
  kunde.flat = await konto(FLAT_NAME, "flat");
  await abonnement(kunde.flat, "Flat", {});
  zuordnung.Flat = "flat";

  // 4. Kursteilnehmer von A — unverändert zu PROJ-84.
  kunde.kurs = await konto(KURS_NAME, "kurs");
  await abonnement(kunde.kurs, "Kursabo", { kurs: kursA, preis: 89 });
  zuordnung.Kursabo = "kurs";

  // 5. Pass von Stil A, steht aber schon auf der Liste.
  kunde.drauf = await konto(DRAUF_NAME, "drauf");
  const draufAbo = await abonnement(kunde.drauf, "Drauf", { stil: stilA });
  zuordnung.Drauf = "drauf";
  await service
    .from("cash_entries")
    .insert({ customer_id: kunde.drauf, subscription_id: draufAbo, amount_due: 45 });

  // 6. Pass von Stil A, Abo beendet — ohne aktives Abo gibt es nichts
  //    einzutragen, auch nicht aus dem vorigen Zyklus.
  kunde.beendet = await konto(BEENDET_NAME, "beendet");
  await abonnement(kunde.beendet, "Beendet", { stil: stilA, status: "cancelled" });
  zuordnung.Beendet = "beendet";

  alsLehrer = await angemeldetAls(URL, ANON, LEHRER, PASSWORT);
}, 180_000);

afterAll(async () => {
  await service.from("cash_cycles").delete().not("id", "is", null);
  const abos = Object.values(abo);
  if (abos.length > 0) {
    await service.from("cash_payments").delete().in("subscription_id", abos);
    await service.from("cash_entries").delete().in("subscription_id", abos);
    await service.from("course_memberships").delete().in("subscription_id", abos);
    await service.from("subscriptions").delete().in("id", abos);
  }
  for (const k of kurse) {
    await service.from("course_teachers").delete().eq("course_id", k);
    await service.from("courses").delete().eq("id", k);
  }
  for (const id of konten) await service.auth.admin.deleteUser(id).catch(() => {});
  for (const s of stile) await service.from("dance_styles").delete().eq("id", s);
});

describe("PROJ-99: Wer in der Auswahl steht", () => {
  it("führt einen Pass der passenden Stilrichtung ohne Kursplatz", async () => {
    // Der eigentliche Befund: Vorher stand hier nur, wer einen eingetragenen
    // Kursplatz hatte — und die Lehrkraft legte den Rest als Gast neu an.
    const zeile = (await auswahl(kursA)).find((k) => k.full_name === PASS_A_NAME);
    expect(zeile, "Der Pass-Inhaber ist nicht auswählbar").toBeDefined();
    expect(zeile!.pass_stil).toBe(`E2E99 StilA ${marke}`);
    expect(zeile!.ist_flatrate).toBe(true);
  });

  it("führt einen Pass einer anderen Stilrichtung nicht", async () => {
    expect(namen(await auswahl(kursA))).not.toContain(PASS_B_NAME);
  });

  it("führt die volle Flatrate in jedem Kurs", async () => {
    expect(namen(await auswahl(kursA))).toContain(FLAT_NAME);
    expect(namen(await auswahl(kursB))).toContain(FLAT_NAME);
  });

  it("führt den Kursteilnehmer weiterhin", async () => {
    const zeile = (await auswahl(kursA)).find((k) => k.full_name === KURS_NAME);
    expect(zeile).toBeDefined();
    expect(zeile!.ist_flatrate).toBe(false);
    expect(Number(zeile!.price)).toBe(89);
  });

  it("führt nicht, wer schon auf der Liste steht", async () => {
    expect(namen(await auswahl(kursA))).not.toContain(DRAUF_NAME);
  });

  it("führt kein beendetes Abo", async () => {
    expect(namen(await auswahl(kursA))).not.toContain(BEENDET_NAME);
  });
});

describe("PROJ-99: Der Betrag aus dem vorigen Zyklus", () => {
  it("nennt ihn bei dem, der damals auf der Liste stand", async () => {
    await zyklusMitAbschrift([{ aboName: "PassA", betrag: 60 }]);

    const zeile = (await auswahl(kursA)).find((k) => k.full_name === PASS_A_NAME)!;
    expect(Number(zeile.voriger_betrag)).toBe(60);
  });

  it("lässt ihn bei allen anderen leer", async () => {
    await zyklusMitAbschrift([{ aboName: "PassA", betrag: 60 }]);

    const zeile = (await auswahl(kursA)).find((k) => k.full_name === FLAT_NAME)!;
    expect(zeile.voriger_betrag).toBeNull();
  });

  it("nennt niemanden aus dem vorigen Zyklus, dessen Abo beendet ist", async () => {
    await zyklusMitAbschrift([
      { aboName: "PassA", betrag: 60 },
      { aboName: "Beendet", betrag: 45 },
    ]);
    // Die Gruppe fügt niemanden hinzu: Ohne aktives Abo gibt es nichts
    // einzutragen.
    expect(namen(await auswahl(kursA))).not.toContain(BEENDET_NAME);
  });

  it("nennt niemanden aus dem vorigen Zyklus, der schon wieder auf der Liste steht", async () => {
    await zyklusMitAbschrift([
      { aboName: "PassA", betrag: 60 },
      { aboName: "Drauf", betrag: 45 },
    ]);
    expect(namen(await auswahl(kursA))).not.toContain(DRAUF_NAME);
  });

  it("lässt ohne abgeschlossenen Zyklus alle Beträge leer", async () => {
    await service.from("cash_cycles").delete().not("id", "is", null);
    const zeilen = await auswahl(kursA);
    expect(zeilen.length).toBeGreaterThan(0);
    expect(zeilen.every((z) => z.voriger_betrag === null)).toBe(true);
  });

  it("nennt den Betrag des jüngsten Zyklus, nicht den eines älteren", async () => {
    // Reihenfolge mit Absicht: `zyklusMitAbschrift` räumt alle Zyklen weg.
    // Der ältere kommt deshalb danach dazu — sonst prüfte dieser Test nichts.
    await zyklusMitAbschrift([{ aboName: "PassA", betrag: 60 }]);
    const { data: aelter, error } = await service
      .from("cash_cycles")
      .insert({ starts_on: tag(-60), ends_on: tag(-31) })
      .select("id")
      .single();
    expect(error, `Älterer Zyklus nicht anlegbar: ${error?.message}`).toBeNull();
    await service.from("cash_cycle_entries").insert({
      cycle_id: aelter!.id,
      customer_id: kunde.passA,
      subscription_id: abo.PassA,
      amount_due: 20,
    });

    const zeile = (await auswahl(kursA)).find((k) => k.full_name === PASS_A_NAME)!;
    expect(Number(zeile.voriger_betrag)).toBe(60);
  });
});

describe("PROJ-99: Die Rechteprüfung gilt weiter", () => {
  it("weist eine Lehrkraft ab, die diesen Kurs nicht unterrichtet", async () => {
    const { data: raum } = await service.from("rooms").select("id").limit(1).single();
    const { data: fremd } = await service
      .from("courses")
      .insert({ name: `E2E99 Fremd ${marke}`, room_id: raum!.id, price: 89 })
      .select("id")
      .single();

    const { error } = await alsLehrer.rpc("get_course_cash_candidates", {
      p_course_id: fremd!.id,
    });
    expect(error?.message).toContain("not authorized");

    await service.from("courses").delete().eq("id", fremd!.id);
  });

  it("gibt nur die acht Angaben heraus, die die Lehrkraft sehen darf", async () => {
    // Kein Mandat, keine IBAN, kein fremder Kurs, kein Geburtsdatum. Diese
    // Prüfung ist bewusst eine über die **Spaltenliste** und nicht über
    // einzelne Werte: Sie wird rot, sobald jemand der Funktion eine Angabe
    // hinzufügt, ohne sich zu fragen, wer sie lesen darf.
    const [zeile] = await auswahl(kursA);
    expect(Object.keys(zeile).sort()).toEqual([
      "customer_id",
      "full_name",
      "ist_flatrate",
      "pass_stil",
      "price",
      "subscription_id",
      "subscription_name",
      "voriger_betrag",
    ]);
  });

  it("weist nicht Angemeldete ab", async () => {
    const anonym = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error } = await anonym.rpc("get_course_cash_candidates", { p_course_id: kursA });
    expect(error, "Die Auswahl war ohne Anmeldung lesbar").not.toBeNull();
  });
});
