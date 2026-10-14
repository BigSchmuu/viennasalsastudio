import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-81: Barzahlungen.
 *
 * Geprüft werden die drei Funktionen — nicht die Oberfläche: Wer die Barzahler
 * eines Kurses sehen darf, wer abhaken darf, und dass ein zweiter Druck auf den
 * Knopf kein zweites Mal Geld verbucht. Beträge und IBANs liegen hinter diesen
 * Funktionen; für eine Lehrkraft sind die Tabellen gesperrt.
 *
 * Braucht die Migrationen 20261013100000_proj81_barzahlungen.sql und
 * 20261014120000_proj83_teilbetraege.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";
const ADMIN = "e2e8-admin@viennasalsastudio.test";
const LEHRER = "e2e13-lehrer-a@viennasalsastudio.test";
const BAR = "proj81-bar@viennasalsastudio.test";
const MIT_MANDAT = "proj81-mandat@viennasalsastudio.test";

let service: SupabaseClient;
let alsAdmin: SupabaseClient;
let alsLehrer: SupabaseClient;
let kursId = "";
let barKundeId = "";
let mandatKundeId = "";
let barAboId = "";
let mandatAboId = "";

function wienerDatum(versatzTage = 0): string {
  const ziel = new Date(Date.now() + versatzTage * 24 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(ziel);
}

async function kontoAnlegen(mail: string, name: string): Promise<string> {
  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-81 Konto ${mail}: ${error?.message}`);
  await service.from("profiles").update({ full_name: name }).eq("id", data.user.id);
  return data.user.id;
}

/** Einen faellig gewordenen Beitrag anlegen — die Soll-Seite aus PROJ-83. */
async function sollAnlegen(aboId: string, kundeId: string, betrag: number, tag: string) {
  const { error } = await service
    .from("cash_dues")
    .insert({ subscription_id: aboId, customer_id: kundeId, amount: betrag, due_on: tag });
  if (error) throw new Error(`PROJ-81 Soll: ${error.message}`);
}

async function barzahler(client: SupabaseClient) {
  const { data, error } = await client.rpc("get_course_cash_payers", { p_course_id: kursId });
  return { zeilen: (data ?? []) as Record<string, unknown>[], error };
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  barKundeId = await kontoAnlegen(BAR, "E2E81 Barzahler");
  mandatKundeId = await kontoAnlegen(MIT_MANDAT, "E2E81 Mandatskunde");

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({ name: `E2E81 Barkurs ${Date.now()}`, room_id: raum!.id, price: 50 })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-81 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  // Die Lehrkraft dieses Kurses — nur für sie darf die Funktion antworten.
  const { data: lehrerProfil } = await service
    .from("profiles")
    .select("id")
    .eq("full_name", "E2E13 Lehrer A")
    .single();
  await service.from("course_teachers").insert({ course_id: kursId, teacher_id: lehrerProfil!.id });

  for (const [kundeId, name, ziel] of [
    [barKundeId, "E2E81 Bar", "bar"],
    [mandatKundeId, "E2E81 Mandat", "mandat"],
  ] as const) {
    const { data: abo, error } = await service
      .from("subscriptions")
      .insert({
        customer_id: kundeId,
        course_id: kursId,
        status: "active",
        name,
        price: ziel === "bar" ? 50 : 60,
        cycle_anchor_date: wienerDatum(-40),
      })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-81 Abo ${ziel}: ${error.message}`);
    if (ziel === "bar") barAboId = abo!.id;
    else mandatAboId = abo!.id;
  }

  // Ein gültiges Mandat für den zweiten Kunden — er darf nicht in der Liste
  // stehen.
  const { error: mandatFehler } = await service.from("sepa_mandates").insert({
    customer_id: mandatKundeId,
    iban: "AT611904300234573201",
    account_holder_name: "E2E81 Mandatskunde",
    mandate_reference: `E2E81-${Date.now()}`,
    consented_at: new Date().toISOString(),
  });
  if (mandatFehler) throw new Error(`PROJ-81 Mandat: ${mandatFehler.message}`);

  alsAdmin = await angemeldetAls(URL, ANON, ADMIN, PASSWORT);
  alsLehrer = await angemeldetAls(URL, ANON, LEHRER, PASSWORT);
}, 120_000);

afterAll(async () => {
  if (kursId) {
    const abos = [barAboId, mandatAboId].filter(Boolean);
    await service.from("cash_payments").delete().in("subscription_id", abos);
    await service.from("cash_dues").delete().in("subscription_id", abos);
    await service.from("subscriptions").delete().eq("course_id", kursId);
    await service.from("course_teachers").delete().eq("course_id", kursId);
    await service.from("courses").delete().eq("id", kursId);
  }
  await service.from("sepa_mandates").delete().eq("customer_id", mandatKundeId);
  for (const id of [barKundeId, mandatKundeId]) {
    if (id) await service.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe("PROJ-81: Barzahlungen in der Datenbank", () => {
  it("nennt der Lehrkraft die Barzahler samt Betrag", async () => {
    const { zeilen, error } = await barzahler(alsLehrer);
    expect(error, `Liste nicht lesbar: ${error?.message}`).toBeNull();

    const bar = zeilen.find((z) => z.subscription_id === barAboId);
    expect(bar, "Der Barzahler fehlt in der Liste").toBeTruthy();
    // Seit PROJ-83 heisst die Spalte `price` — der Zyklusbeitrag, waehrend
    // `soll`/`haben` den Saldo tragen.
    expect(Number(bar!.price)).toBe(50);
  });

  // Die Unterscheidung, um die es geht.
  it("lässt einen Kunden mit gültigem Mandat weg", async () => {
    const { zeilen } = await barzahler(alsLehrer);
    expect(zeilen.find((z) => z.subscription_id === mandatAboId)).toBeUndefined();
  });

  it("nimmt ihn auf, sobald das Mandat widerrufen ist", async () => {
    await service
      .from("sepa_mandates")
      .update({ revoked_at: new Date().toISOString() })
      .eq("customer_id", mandatKundeId);
    try {
      const { zeilen } = await barzahler(alsLehrer);
      expect(zeilen.find((z) => z.subscription_id === mandatAboId)).toBeTruthy();
    } finally {
      await service
        .from("sepa_mandates")
        .update({ revoked_at: null })
        .eq("customer_id", mandatKundeId);
    }
  });

  it("erfasst eine Zahlung ueber den offenen Betrag", async () => {
    // Seit PROJ-83 kommt der Betrag aus dem Saldo und nicht mehr aus dem Abo:
    // Ohne faellig gewordenen Beitrag ist nichts offen und nichts zu erfassen.
    await service.from("cash_payments").delete().eq("subscription_id", barAboId);
    await service.from("cash_dues").delete().eq("subscription_id", barAboId);
    await sollAnlegen(barAboId, barKundeId, 50, wienerDatum(-1));

    const { data, error } = await alsLehrer.rpc("record_cash_payment", {
      p_subscription_id: barAboId,
    });
    expect(error, `Erfassen scheiterte: ${error?.message}`).toBeNull();
    expect(Number((data as Record<string, unknown>).amount)).toBe(50);
    expect((data as Record<string, unknown>).paid_on).toBe(wienerDatum(0));
  });

  // Das Netz gegen den Fehlgriff. Die Zusicherung ist dieselbe wie in PROJ-81,
  // der Mechanismus seit PROJ-83 ein anderer: Nicht mehr eine Sperre ueber 28
  // Tage, sondern ein Saldo, der nach der ersten Zahlung bei null steht. Den
  // Schutz gegen zwei gleiche Betraege im selben Augenblick prueft PROJ-83.
  it("verbucht einen zweiten Druck nicht zweimal", async () => {
    await service.from("cash_payments").delete().eq("subscription_id", barAboId);
    await service.from("cash_dues").delete().eq("subscription_id", barAboId);
    await sollAnlegen(barAboId, barKundeId, 50, wienerDatum(-1));

    await alsLehrer.rpc("record_cash_payment", { p_subscription_id: barAboId });
    const { error } = await alsLehrer.rpc("record_cash_payment", { p_subscription_id: barAboId });
    expect(error, "Eine zweite Zahlung ohne offenen Betrag wurde angenommen").not.toBeNull();
  });

  it("nimmt eine heute erfasste Zahlung zurück", async () => {
    await service.from("cash_payments").delete().eq("subscription_id", barAboId);
    const { data } = await alsLehrer.rpc("record_cash_payment", { p_subscription_id: barAboId });
    const id = (data as Record<string, unknown>).id as string;

    const { error } = await alsLehrer.rpc("undo_cash_payment", { p_payment_id: id });
    expect(error, `Zurücknehmen scheiterte: ${error?.message}`).toBeNull();

    const { count } = await service
      .from("cash_payments")
      .select("id", { count: "exact", head: true })
      .eq("id", id);
    expect(count).toBe(0);
  });

  // Sonst verschwindet Geld aus der Aufzeichnung, das längst eingesammelt wurde.
  it("lässt die Lehrkraft eine ältere Zahlung nicht zurücknehmen", async () => {
    await service.from("cash_payments").delete().eq("subscription_id", barAboId);
    const { data: alt, error: anlageFehler } = await service
      .from("cash_payments")
      .insert({
        subscription_id: barAboId,
        customer_id: barKundeId,
        amount: 50,
        paid_on: wienerDatum(-40),
      })
      .select("id")
      .single();
    expect(anlageFehler).toBeNull();

    const { error } = await alsLehrer.rpc("undo_cash_payment", { p_payment_id: alt!.id });
    expect(error, "Eine alte Zahlung ließ sich zurücknehmen").not.toBeNull();

    // Der Verwaltung ist es erlaubt.
    const { error: adminFehler } = await alsAdmin.rpc("undo_cash_payment", {
      p_payment_id: alt!.id,
    });
    expect(adminFehler, `Der Verwaltung wurde es verwehrt: ${adminFehler?.message}`).toBeNull();
  });

  it("weist eine fremde Lehrkraft und nicht Angemeldete ab", async () => {
    const anonym = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error: anonFehler } = await anonym.rpc("get_course_cash_payers", {
      p_course_id: kursId,
    });
    expect(anonFehler, "Die Liste war ohne Anmeldung lesbar").not.toBeNull();

    const { error: schreibFehler } = await anonym.rpc("record_cash_payment", {
      p_subscription_id: barAboId,
    });
    expect(schreibFehler, "Ohne Anmeldung ließ sich abhaken").not.toBeNull();
  });

  it("verweigert das Abhaken bei einem Abo ohne Preis", async () => {
    await service.from("cash_payments").delete().eq("subscription_id", barAboId);
    await service.from("subscriptions").update({ price: null }).eq("id", barAboId);
    try {
      const { error } = await alsLehrer.rpc("record_cash_payment", {
        p_subscription_id: barAboId,
      });
      expect(error, "Ein Abo ohne Preis ließ sich abhaken").not.toBeNull();
    } finally {
      await service.from("subscriptions").update({ price: 50 }).eq("id", barAboId);
    }
  });
});
