import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-83: Teilbeträge und der Saldo.
 *
 * Geprüft wird die Rechnung, nicht die Oberfläche: Soll minus Haben, der Rest
 * der mitwandert, das Guthaben aus einer Überzahlung — und die Grenzen, die
 * nicht in der Oberfläche stehen dürfen, weil eine Oberfläche keine Zusicherung
 * ist.
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
const KUNDE = "proj83-bar@viennasalsastudio.test";

const BEITRAG = 89;

let service: SupabaseClient;
let alsAdmin: SupabaseClient;
let alsLehrer: SupabaseClient;
let alsKunde: SupabaseClient;
let kursId = "";
let kundeId = "";
let aboId = "";
/** Eine Flatrate ohne jeden Kursplatz — der Fall ohne Knopf vor PROJ-83. */
let flatrateId = "";

function wienerDatum(versatzTage = 0): string {
  const ziel = new Date(Date.now() + versatzTage * 24 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(ziel);
}

/** Den Stand zurücksetzen und ein frisches Soll setzen. */
async function stand(sollBetraege: number[]) {
  await service.from("cash_payments").delete().eq("subscription_id", aboId);
  await service.from("cash_dues").delete().eq("subscription_id", aboId);
  if (sollBetraege.length === 0) return;
  const zeilen = sollBetraege.map((betrag, i) => ({
    subscription_id: aboId,
    customer_id: kundeId,
    amount: betrag,
    due_on: wienerDatum(-28 * (sollBetraege.length - 1 - i) - 1),
  }));
  const { error } = await service.from("cash_dues").insert(zeilen);
  if (error) throw new Error(`PROJ-83 Soll: ${error.message}`);
}

/** Die Zeile dieses Abos aus der Lehreransicht. */
async function zeile(client: SupabaseClient = alsLehrer) {
  const { data, error } = await client.rpc("get_course_cash_payers", { p_course_id: kursId });
  if (error) throw new Error(`PROJ-83 Liste: ${error.message}`);
  const gefunden = (data ?? []).find(
    (z: Record<string, unknown>) => z.subscription_id === aboId
  ) as Record<string, unknown> | undefined;
  if (!gefunden) throw new Error("PROJ-83: Der Barzahler fehlt in der Liste");
  return {
    soll: Number(gefunden.soll),
    haben: Number(gefunden.haben),
    preis: Number(gefunden.price),
    letzteZahlung: gefunden.letzte_zahlung as string | null,
  };
}

async function saldo(abo = aboId): Promise<number> {
  const { data } = await service.from("cash_ledger").select("saldo").eq("subscription_id", abo).maybeSingle();
  return Number(data?.saldo ?? 0);
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === KUNDE);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data: neu, error: kontoFehler } = await service.auth.admin.createUser({
    email: KUNDE,
    password: PASSWORT,
    email_confirm: true,
  });
  if (kontoFehler || !neu.user) throw new Error(`PROJ-83 Konto: ${kontoFehler?.message}`);
  kundeId = neu.user.id;
  await service.from("profiles").update({ full_name: "E2E83 Barzahler" }).eq("id", kundeId);

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({ name: `E2E83 Barkurs ${Date.now()}`, room_id: raum!.id, price: BEITRAG })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-83 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  const { data: lehrerProfil } = await service
    .from("profiles")
    .select("id")
    .eq("full_name", "E2E13 Lehrer A")
    .single();
  await service.from("course_teachers").insert({ course_id: kursId, teacher_id: lehrerProfil!.id });

  const { data: abo, error: aboFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: kursId,
      status: "active",
      name: "E2E83 Kursabo",
      price: BEITRAG,
      cycle_anchor_date: wienerDatum(-60),
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-83 Abo: ${aboFehler.message}`);
  aboId = abo!.id;

  // Dieselbe Person mit einer Flatrate ohne Kursplatz: Vor PROJ-83 stand sie
  // dauerhaft auf „offen" und ließ sich nirgends abhaken.
  const { data: flat, error: flatFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: null,
      status: "active",
      name: "E2E83 Flatrate ohne Kurs",
      price: 120,
      cycle_anchor_date: wienerDatum(-60),
    })
    .select("id")
    .single();
  if (flatFehler) throw new Error(`PROJ-83 Flatrate: ${flatFehler.message}`);
  flatrateId = flat!.id;

  alsAdmin = await angemeldetAls(URL, ANON, ADMIN, PASSWORT);
  alsLehrer = await angemeldetAls(URL, ANON, LEHRER, PASSWORT);
  alsKunde = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
}, 120_000);

afterAll(async () => {
  const abos = [aboId, flatrateId].filter(Boolean);
  if (abos.length > 0) {
    await service.from("cash_payments").delete().in("subscription_id", abos);
    await service.from("cash_dues").delete().in("subscription_id", abos);
    await service.from("subscriptions").delete().in("id", abos);
  }
  if (kursId) {
    await service.from("course_teachers").delete().eq("course_id", kursId);
    await service.from("courses").delete().eq("id", kursId);
  }
  if (kundeId) await service.auth.admin.deleteUser(kundeId).catch(() => {});
});

describe("PROJ-83: Teilbeträge", () => {
  it("bleibt nach einem Teilbetrag offen — über den Rest", async () => {
    await stand([BEITRAG]);
    const { error } = await alsLehrer.rpc("record_cash_payment", {
      p_subscription_id: aboId,
      p_amount: 40,
    });
    expect(error, `Teilbetrag abgewiesen: ${error?.message}`).toBeNull();

    const stand1 = await zeile();
    expect(stand1.haben).toBe(40);
    expect(stand1.soll).toBe(BEITRAG);
    expect(await saldo()).toBe(49);
  });

  it("addiert zwei Teilbeträge am selben Tag", async () => {
    await stand([BEITRAG]);
    await alsLehrer.rpc("record_cash_payment", { p_subscription_id: aboId, p_amount: 40 });
    const { error } = await alsLehrer.rpc("record_cash_payment", {
      p_subscription_id: aboId,
      p_amount: 49,
    });
    expect(error, `Der zweite Teilbetrag wurde abgewiesen: ${error?.message}`).toBeNull();
    expect(await saldo()).toBe(0);
  });

  it("lässt den Rest zum nächsten Beitrag wandern", async () => {
    // Der Kern der Entscheidung: zwei fällige Beiträge, 40 Euro bezahlt.
    await stand([BEITRAG, BEITRAG]);
    await alsLehrer.rpc("record_cash_payment", { p_subscription_id: aboId, p_amount: 40 });
    expect(await saldo()).toBe(138);
  });

  it("erfasst ohne Betrag den gesamten offenen Rest, nicht einen Zyklusbeitrag", async () => {
    await stand([BEITRAG, BEITRAG]);
    const { data, error } = await alsLehrer.rpc("record_cash_payment", {
      p_subscription_id: aboId,
    });
    expect(error, `Erfassen scheiterte: ${error?.message}`).toBeNull();
    expect(Number((data as Record<string, unknown>).amount)).toBe(178);
    expect(await saldo()).toBe(0);
  });

  it("macht aus einer Überzahlung ein Guthaben", async () => {
    await stand([BEITRAG]);
    await alsLehrer.rpc("record_cash_payment", { p_subscription_id: aboId, p_amount: 178 });
    expect(await saldo()).toBe(-89);
  });

  it("verrechnet das Guthaben mit dem nächsten fälligen Beitrag", async () => {
    await stand([BEITRAG]);
    await alsLehrer.rpc("record_cash_payment", { p_subscription_id: aboId, p_amount: 178 });
    // Der nächste Beitrag wird fällig — das Guthaben deckt ihn ab.
    await service
      .from("cash_dues")
      .insert({ subscription_id: aboId, customer_id: kundeId, amount: BEITRAG, due_on: wienerDatum(0) });
    expect(await saldo()).toBe(0);
  });

  it("weist einen zweiten gleichen Betrag im selben Augenblick ab", async () => {
    // Der Doppeltipp. Zwei *verschiedene* Teilbeträge am selben Tag bleiben
    // erlaubt — das prüft der Test weiter oben.
    await stand([BEITRAG, BEITRAG]);
    await alsLehrer.rpc("record_cash_payment", { p_subscription_id: aboId, p_amount: 40 });
    const { error } = await alsLehrer.rpc("record_cash_payment", {
      p_subscription_id: aboId,
      p_amount: 40,
    });
    expect(error, "Derselbe Betrag wurde zweimal verbucht").not.toBeNull();
    expect(await saldo()).toBe(138);
  });

  it("nimmt einen Betrag über der Obergrenze nicht an", async () => {
    await stand([BEITRAG]);
    const { error } = await alsLehrer.rpc("record_cash_payment", {
      p_subscription_id: aboId,
      p_amount: 10001,
    });
    expect(error, "Ein Vertipper um drei Nullen wurde angenommen").not.toBeNull();
  });

  it("nimmt null und negative Beträge nicht an", async () => {
    await stand([BEITRAG]);
    for (const betrag of [0, -50]) {
      const { error } = await alsLehrer.rpc("record_cash_payment", {
        p_subscription_id: aboId,
        p_amount: betrag,
      });
      expect(error, `Der Betrag ${betrag} wurde angenommen`).not.toBeNull();
    }
  });

  it("erfasst ohne offenen Betrag nichts", async () => {
    await stand([]);
    const { error } = await alsLehrer.rpc("record_cash_payment", { p_subscription_id: aboId });
    expect(error, "Ohne Soll wurde eine Zahlung verbucht").not.toBeNull();
  });

  it("gibt den Rest nach einer Rücknahme wieder frei", async () => {
    await stand([BEITRAG]);
    const { data } = await alsLehrer.rpc("record_cash_payment", {
      p_subscription_id: aboId,
      p_amount: 40,
    });
    const id = (data as Record<string, unknown>).id as string;
    const { error } = await alsLehrer.rpc("undo_cash_payment", { p_payment_id: id });
    expect(error, `Zurücknehmen scheiterte: ${error?.message}`).toBeNull();
    expect(await saldo()).toBe(BEITRAG);
  });
});

describe("PROJ-83: Wer darf was", () => {
  it("lässt die Verwaltung eine Flatrate ohne Kursplatz abhaken", async () => {
    // Genau die Lücke, die PROJ-83 schließt.
    await service.from("cash_dues").delete().eq("subscription_id", flatrateId);
    await service
      .from("cash_dues")
      .insert({ subscription_id: flatrateId, customer_id: kundeId, amount: 120, due_on: wienerDatum(-1) });

    const { error } = await alsAdmin.rpc("record_cash_payment", {
      p_subscription_id: flatrateId,
    });
    expect(error, `Der Verwaltung wurde es verwehrt: ${error?.message}`).toBeNull();
    expect(await saldo(flatrateId)).toBe(0);
  });

  it("lässt eine Lehrkraft ein Abo ohne ihren Kurs nicht abhaken", async () => {
    await service.from("cash_payments").delete().eq("subscription_id", flatrateId);
    const { error } = await alsLehrer.rpc("record_cash_payment", {
      p_subscription_id: flatrateId,
      p_amount: 10,
    });
    expect(error, "Eine fremde Lehrkraft konnte abhaken").not.toBeNull();
  });

  it("verbirgt Soll und Saldo vor der Lehrkraft — sie bekommt sie nur über die Funktion", async () => {
    // Die Tabellen tragen Beträge; für die Lehrkraft sind sie gesperrt. Eine
    // Regel, die leer liefert statt zu scheitern, wäre hier das Gefährlichere
    // (.claude/rules/backend.md).
    const { data } = await alsLehrer.from("cash_dues").select("id").eq("subscription_id", aboId);
    expect(data ?? []).toHaveLength(0);

    const { data: ledger } = await alsLehrer
      .from("cash_ledger")
      .select("saldo")
      .eq("subscription_id", aboId);
    expect(ledger ?? []).toHaveLength(0);

    // Über die Funktion sieht sie dieselbe Zahl.
    await stand([BEITRAG]);
    expect((await zeile()).soll).toBe(BEITRAG);
  });

  it("zeigt dem Kunden seinen eigenen Stand", async () => {
    await stand([BEITRAG]);
    const { data } = await alsKunde.from("cash_ledger").select("saldo, subscription_id");
    const eigene = (data ?? []).find((z) => z.subscription_id === aboId);
    expect(eigene, "Der Kunde sieht seinen eigenen Stand nicht").toBeTruthy();
    expect(Number(eigene!.saldo)).toBe(BEITRAG);
  });

  it("weist nicht Angemeldete ab", async () => {
    const anonym = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error } = await anonym.rpc("record_cash_payment", {
      p_subscription_id: aboId,
      p_amount: 10,
    });
    expect(error, "Ohne Anmeldung ließ sich abhaken").not.toBeNull();

    const { data } = await anonym.from("cash_ledger").select("saldo");
    expect(data ?? []).toHaveLength(0);
  });
});
