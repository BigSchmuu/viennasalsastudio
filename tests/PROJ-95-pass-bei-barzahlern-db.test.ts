import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-95: Der Pass in den Barzahler-Listen.
 *
 * Geprüft wird `get_course_cash_payers` — und zwar **mit dem Zugang der
 * Lehrkraft**, nicht mit dem Dienstschlüssel. Das ist hier keine Förmlichkeit:
 * Die Funktion läuft als `security definer` und prüft selbst, wer fragt; mit dem
 * Dienstschlüssel geprüft wäre der Rechteteil nie geprüft. Dieselbe Lehre wie
 * am 2026-10-26 bei PROJ-94 (siehe docs/troubleshooting-tests.md).
 *
 * Die Frage, um die es geht: Ein kursloses Abo ist in **jedem** Kurs erreichbar,
 * damit jemand, der vorbeikommt, hier zahlen kann. Seit PROJ-93 ist ein Pass
 * aber auch kurslos — und ein Bachata-Pass hat in einem Salsa-Kurs nichts zu
 * suchen. Die Regel steht in `deckt_abo_kurs` und wortgleich als
 * `where`-Bedingung in dieser Funktion.
 *
 * Braucht die Migration 20261028100000_proj95_pass_bei_barzahlern.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";
const LEHRER = "e2e13-lehrer-a@viennasalsastudio.test";

const marke = Date.now();
const PASS_KUNDE = `proj95-pass-${marke}@viennasalsastudio.test`;
const FLAT_KUNDE = `proj95-flat-${marke}@viennasalsastudio.test`;
const KANDIDAT = `proj95-kandidat-${marke}@viennasalsastudio.test`;

let service: SupabaseClient;
let alsLehrer: SupabaseClient;

let stilBachata = "";
let stilSalsa = "";
/** Bachata A: Hier hat der Pass-Kunde seinen Kursplatz. */
let bachataA = "";
/** Bachata B: Derselbe Stil, aber er ist hier nicht angemeldet. */
let bachataB = "";
/** Ein Salsa-Kurs — hier darf der Bachata-Pass nicht auftauchen. */
let salsaKurs = "";
/** Ein Kurs ganz ohne Stilrichtung. */
let ohneStil = "";

const kurse: string[] = [];
const abos: string[] = [];
const konten: string[] = [];
const stile: string[] = [];

async function konto(email: string, name: string): Promise<string> {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-95 Konto: ${error?.message}`);
  konten.push(data.user.id);
  await service.from("profiles").update({ full_name: name }).eq("id", data.user.id);
  return data.user.id;
}

async function kurs(name: string, stilId: string | null): Promise<string> {
  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data, error } = await service
    .from("courses")
    .insert({ name, room_id: raum!.id, price: 89, dance_style_id: stilId })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-95 Kurs: ${error.message}`);
  kurse.push(data!.id);
  // Die Lehrkraft muss ihn unterrichten, sonst weist die Funktion sie ab.
  const { data: lehrer } = await service
    .from("profiles")
    .select("id")
    .eq("full_name", "E2E13 Lehrer A")
    .single();
  await service.from("course_teachers").insert({ course_id: data!.id, teacher_id: lehrer!.id });
  return data!.id;
}

async function abo(kundeId: string, name: string, stilId: string | null): Promise<string> {
  const { data, error } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: null,
      dance_style_id: stilId,
      status: "active",
      name,
      price: 45,
      cycle_anchor_date: "2026-01-07",
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-95 Abo: ${error.message}`);
  abos.push(data!.id);
  return data!.id;
}

async function liste(kursId: string) {
  const { data, error } = await alsLehrer.rpc("get_course_cash_payers", { p_course_id: kursId });
  if (error) throw new Error(`PROJ-95 Liste: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

async function vorschlaege(kursId: string) {
  const { data, error } = await alsLehrer.rpc("get_course_cash_candidates", {
    p_course_id: kursId,
  });
  if (error) throw new Error(`PROJ-95 Vorschläge: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

function namen(zeilen: Record<string, unknown>[]): string[] {
  return zeilen.map((z) => String(z.full_name));
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  for (const [name, preis] of [
    [`E2E95 Bachata ${marke}`, 45],
    [`E2E95 Salsa ${marke}`, null],
  ] as const) {
    const { data, error } = await service
      .from("dance_styles")
      .insert({ name, pass_price: preis })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-95 Stil: ${error.message}`);
    stile.push(data!.id);
    if (preis !== null) stilBachata = data!.id;
    else stilSalsa = data!.id;
  }

  bachataA = await kurs(`E2E95 Bachata A ${marke}`, stilBachata);
  bachataB = await kurs(`E2E95 Bachata B ${marke}`, stilBachata);
  salsaKurs = await kurs(`E2E95 Salsa ${marke}`, stilSalsa);
  ohneStil = await kurs(`E2E95 Ohne Stil ${marke}`, null);

  // 1. Pass-Kunde: Kursplatz in Bachata A, Eintrag auf der Liste.
  const passKunde = await konto(PASS_KUNDE, "E2E95 Paula Pass");
  const passAbo = await abo(passKunde, "Bachata Pass", stilBachata);
  await service.from("course_memberships").insert({
    customer_id: passKunde,
    course_id: bachataA,
    subscription_id: passAbo,
    started_on: "2026-01-07",
  });
  await service
    .from("cash_entries")
    .insert({ customer_id: passKunde, subscription_id: passAbo, amount_due: 45 });

  // 2. Flatrate-Kunde ohne jeden Kursplatz — er muss überall auftauchen.
  const flatKunde = await konto(FLAT_KUNDE, "E2E95 Frida Flat");
  const flatAbo = await abo(flatKunde, "Flatrate", null);
  await service
    .from("cash_entries")
    .insert({ customer_id: flatKunde, subscription_id: flatAbo, amount_due: 120 });

  // 3. Ein Pass-Kunde **ohne** Eintrag: Er gehört in die Vorschlagsliste.
  const kandidat = await konto(KANDIDAT, "E2E95 Karl Kandidat");
  const kandidatAbo = await abo(kandidat, "Bachata Pass", stilBachata);
  await service.from("course_memberships").insert({
    customer_id: kandidat,
    course_id: bachataA,
    subscription_id: kandidatAbo,
    started_on: "2026-01-07",
  });

  alsLehrer = await angemeldetAls(URL, ANON, LEHRER, PASSWORT);
}, 120_000);

afterAll(async () => {
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

describe("PROJ-95: Wo ein Pass auf der Barzahler-Liste erscheint", () => {
  it("steht im eigenen Kurs als Teilnehmer dieses Kurses", async () => {
    const zeile = (await liste(bachataA)).find((z) => z.full_name === "E2E95 Paula Pass");
    expect(zeile).toBeDefined();
    expect(zeile!.eigener_kurs).toBe(true);
  });

  it("steht in einem anderen Kurs derselben Stilrichtung — eingeklappt", async () => {
    // Das ist der Grund für die ganze Gruppe: Wer vorbeikommt, soll hier
    // zahlen können, ohne dass die Verwaltung eingreifen muss.
    const zeile = (await liste(bachataB)).find((z) => z.full_name === "E2E95 Paula Pass");
    expect(zeile).toBeDefined();
    expect(zeile!.eigener_kurs).toBe(false);
  });

  it("steht in einem Kurs einer anderen Stilrichtung NICHT", async () => {
    // Der eigentliche Befund von PROJ-95. Vor der Migration erschien hier jedes
    // kurslose Abo, also auch ein Bachata-Pass in einem Salsa-Kurs.
    expect(namen(await liste(salsaKurs))).not.toContain("E2E95 Paula Pass");
  });

  it("steht in einem Kurs ohne Stilrichtung NICHT", async () => {
    // Der Vergleich mit NULL ist niemals wahr — und das ist hier die richtige
    // Antwort: Ein Kurs ohne Stil wird von keinem Pass gedeckt.
    expect(namen(await liste(ohneStil))).not.toContain("E2E95 Paula Pass");
  });

  it("nennt die Stilrichtung, damit die Zeile nicht „Flatrate“ sagt", async () => {
    const zeile = (await liste(bachataA)).find((z) => z.full_name === "E2E95 Paula Pass");
    expect(zeile!.pass_stil).toBe(`E2E95 Bachata ${marke}`);
    // `ist_flatrate` ist hier **auch** wahr, weil der Pass kurslos ist. Genau
    // deshalb braucht die Anzeige die Stilrichtung und nicht dieses Merkmal.
    expect(zeile!.ist_flatrate).toBe(true);
  });
});

describe("PROJ-95: Die Flatrate bleibt überall erreichbar", () => {
  it("steht im Bachata-Kurs", async () => {
    expect(namen(await liste(bachataA))).toContain("E2E95 Frida Flat");
  });

  it("steht im Salsa-Kurs", async () => {
    // Die Stilgrenze gilt nur für Pässe. Eine Flatrate deckt jeden Kurs, und
    // eine zu scharfe Bedingung hätte sie mit ausgeschlossen.
    expect(namen(await liste(salsaKurs))).toContain("E2E95 Frida Flat");
  });

  it("steht auch im Kurs ohne Stilrichtung", async () => {
    expect(namen(await liste(ohneStil))).toContain("E2E95 Frida Flat");
  });

  it("sagt an ihrer Zeile keine Stilrichtung", async () => {
    const zeile = (await liste(bachataA)).find((z) => z.full_name === "E2E95 Frida Flat");
    expect(zeile!.pass_stil).toBeNull();
    expect(zeile!.ist_flatrate).toBe(true);
  });
});

describe("PROJ-95: Die Vorschlagsliste", () => {
  it("nennt beim Pass-Kunden die Stilrichtung", async () => {
    // Vorher stand in der Auswahl „Flatrate" an einem Pass — dieselbe Ursache
    // wie in der Liste, eine andere Funktion.
    const zeile = (await vorschlaege(bachataA)).find(
      (k) => k.full_name === "E2E95 Karl Kandidat"
    );
    expect(zeile).toBeDefined();
    expect(zeile!.pass_stil).toBe(`E2E95 Bachata ${marke}`);
  });

  it("nennt niemanden, der schon auf der Liste steht", async () => {
    expect(namen(await vorschlaege(bachataA))).not.toContain("E2E95 Paula Pass");
  });
});

describe("PROJ-95: Die Rechteprüfung gilt weiter", () => {
  it("weist eine Lehrkraft ab, die diesen Kurs nicht unterrichtet", async () => {
    // Ein Kurs ohne Zuordnung zu dieser Lehrkraft. Angelegt und gleich wieder
    // entfernt, damit er keine Spur hinterlässt.
    const { data: raum } = await service.from("rooms").select("id").limit(1).single();
    const { data: fremd } = await service
      .from("courses")
      .insert({ name: `E2E95 Fremd ${marke}`, room_id: raum!.id, price: 89 })
      .select("id")
      .single();
    const { error } = await alsLehrer.rpc("get_course_cash_payers", {
      p_course_id: fremd!.id,
    });
    expect(error?.message).toContain("not authorized");
    await service.from("courses").delete().eq("id", fremd!.id);
  });
});
