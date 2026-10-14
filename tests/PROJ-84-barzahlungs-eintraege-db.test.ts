import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-84: Barzahlungen als Einträge von Hand.
 *
 * Geprüft werden die Funktionen, nicht die Oberfläche: wer einen Eintrag
 * anlegen, ändern, entfernen und bezahlen darf, dass Teilbeträge sich addieren,
 * dass eine Zahlung den offenen Betrag nicht übersteigen kann — und dass ein
 * Flatrate-Eintrag in **jedem** Kurs erreichbar ist, ein fremder Kursabo-Eintrag
 * aber nicht.
 *
 * Löst `PROJ-81-barzahlungen-db.test.ts` ab: Dort wurde geprüft, dass ein Kunde
 * mit Mandat nicht in der Liste steht und der Betrag aus dem Abo kommt. Beides
 * gilt bewusst nicht mehr.
 *
 * Braucht die Migration 20261014160000_proj84_barzahlungs_eintraege.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";
const ADMIN = "e2e8-admin@viennasalsastudio.test";
const LEHRER_A = "e2e13-lehrer-a@viennasalsastudio.test";
const LEHRER_B = "e2e13-lehrer-b@viennasalsastudio.test";
const KUNDE = "proj84-bar@viennasalsastudio.test";

const BEITRAG = 89;

let service: SupabaseClient;
let alsAdmin: SupabaseClient;
let alsLehrer: SupabaseClient;
let alsFremderLehrer: SupabaseClient | null = null;
let alsKunde: SupabaseClient;

let kursId = "";
let fremdKursId = "";
let kundeId = "";
let aboId = "";
let flatrateId = "";
let fremdAboId = "";

async function eintragAnlegen(abo: string, betrag: number): Promise<string> {
  // Auch die Zahlungen weg, nicht nur der Eintrag: Der Doppeltipp-Waechter
  // sieht Abo, Tag und Betrag der letzten zwei Minuten. Mehrere Pruefungen
  // hintereinander zahlen auf dasselbe Abo denselben Betrag -- ohne dieses
  // Aufraeumen wiese er die zweite Pruefung ab, und zwar zu Recht.
  await service.from("cash_payments").delete().eq("subscription_id", abo);
  await service.from("cash_entries").delete().eq("subscription_id", abo);
  const { data, error } = await service
    .from("cash_entries")
    .insert({ customer_id: kundeId, subscription_id: abo, amount_due: betrag })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-84 Eintrag: ${error.message}`);
  return data!.id;
}

async function offen(entryId: string): Promise<number> {
  const { data: eintrag } = await service
    .from("cash_entries")
    .select("amount_due")
    .eq("id", entryId)
    .maybeSingle();
  if (!eintrag) return 0;
  const { data: zahlungen } = await service
    .from("cash_payments")
    .select("amount")
    .eq("entry_id", entryId);
  const bezahlt = (zahlungen ?? []).reduce((s, z) => s + Number(z.amount), 0);
  return Math.round((Number(eintrag.amount_due) - bezahlt) * 100) / 100;
}

async function liste(client: SupabaseClient, kurs = kursId) {
  const { data, error } = await client.rpc("get_course_cash_payers", { p_course_id: kurs });
  if (error) throw new Error(`PROJ-84 Liste: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
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
  if (kontoFehler || !neu.user) throw new Error(`PROJ-84 Konto: ${kontoFehler?.message}`);
  kundeId = neu.user.id;
  await service.from("profiles").update({ full_name: "E2E84 Barzahler" }).eq("id", kundeId);

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();

  for (const ziel of ["eigen", "fremd"] as const) {
    const { data: kurs, error } = await service
      .from("courses")
      .insert({ name: `E2E84 ${ziel} ${Date.now()}`, room_id: raum!.id, price: BEITRAG })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-84 Kurs: ${error.message}`);
    if (ziel === "eigen") kursId = kurs!.id;
    else fremdKursId = kurs!.id;
  }

  const { data: lehrerA } = await service
    .from("profiles")
    .select("id")
    .eq("full_name", "E2E13 Lehrer A")
    .single();
  await service.from("course_teachers").insert({ course_id: kursId, teacher_id: lehrerA!.id });

  // Kursabo im eigenen Kurs, Flatrate ohne Kursplatz, Kursabo im fremden Kurs.
  const { data: abo } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: kursId,
      status: "active",
      name: "E2E84 Kursabo",
      price: BEITRAG,
      cycle_anchor_date: "2026-01-07",
    })
    .select("id")
    .single();
  aboId = abo!.id;

  const { data: flat } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: null,
      status: "active",
      name: "E2E84 Flatrate",
      price: 120,
      cycle_anchor_date: "2026-01-07",
    })
    .select("id")
    .single();
  flatrateId = flat!.id;

  const { data: fremd } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: fremdKursId,
      status: "active",
      name: "E2E84 Fremdabo",
      price: 75,
      cycle_anchor_date: "2026-01-07",
    })
    .select("id")
    .single();
  fremdAboId = fremd!.id;

  alsAdmin = await angemeldetAls(URL, ANON, ADMIN, PASSWORT);
  alsLehrer = await angemeldetAls(URL, ANON, LEHRER_A, PASSWORT);
  alsKunde = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
  // Eine zweite Lehrkraft gibt es in den Testdaten; fehlt sie, bleibt der
  // betreffende Fall ungeprüft statt den ganzen Lauf zu stoppen.
  alsFremderLehrer = await angemeldetAls(URL, ANON, LEHRER_B, PASSWORT).catch(() => null);
}, 120_000);

afterAll(async () => {
  const abos = [aboId, flatrateId, fremdAboId].filter(Boolean);
  if (abos.length > 0) {
    await service.from("cash_payments").delete().in("subscription_id", abos);
    await service.from("cash_entries").delete().in("subscription_id", abos);
    await service.from("subscriptions").delete().in("id", abos);
  }
  for (const kurs of [kursId, fremdKursId].filter(Boolean)) {
    await service.from("course_teachers").delete().eq("course_id", kurs);
    await service.from("courses").delete().eq("id", kurs);
  }
  if (kundeId) await service.auth.admin.deleteUser(kundeId).catch(() => {});
});

describe("PROJ-84: Einträge führen", () => {
  it("legt einen Eintrag mit dem Betrag an, der angegeben wird", async () => {
    await service.from("cash_entries").delete().eq("subscription_id", aboId);
    const { data, error } = await alsLehrer.rpc("add_cash_entry", {
      p_subscription_id: aboId,
      p_amount: 55,
    });
    expect(error, `Eintrag abgewiesen: ${error?.message}`).toBeNull();
    // Der Betrag kommt aus der Eingabe, nicht aus dem Abo (das trägt 89).
    expect(Number((data as Record<string, unknown>).amount_due)).toBe(55);
  });

  it("nimmt für dasselbe Abo keinen zweiten Eintrag", async () => {
    await eintragAnlegen(aboId, BEITRAG);
    const { error } = await alsLehrer.rpc("add_cash_entry", {
      p_subscription_id: aboId,
      p_amount: 50,
    });
    expect(error, "Ein zweiter Eintrag wurde angenommen").not.toBeNull();
  });

  it("weist Beträge außerhalb der Grenzen ab", async () => {
    await service.from("cash_entries").delete().eq("subscription_id", aboId);
    for (const betrag of [0, -50, 10001]) {
      const { error } = await alsLehrer.rpc("add_cash_entry", {
        p_subscription_id: aboId,
        p_amount: betrag,
      });
      expect(error, `Der Betrag ${betrag} wurde angenommen`).not.toBeNull();
    }
  });

  it("ändert den Betrag nachträglich, aber nie unter das Bezahlte", async () => {
    const id = await eintragAnlegen(aboId, BEITRAG);
    await alsLehrer.rpc("record_cash_payment", { p_entry_id: id, p_amount: 40 });

    const { error: hoch } = await alsLehrer.rpc("update_cash_entry", {
      p_entry_id: id,
      p_amount: 138,
    });
    expect(hoch, `Erhöhen scheiterte: ${hoch?.message}`).toBeNull();
    expect(await offen(id)).toBe(98);

    const { error: zuTief } = await alsLehrer.rpc("update_cash_entry", {
      p_entry_id: id,
      p_amount: 30,
    });
    expect(zuTief, "Ein Betrag unter dem Bezahlten wurde angenommen").not.toBeNull();
  });

  it("entfernt einen Eintrag und lässt die Zahlungen stehen", async () => {
    const id = await eintragAnlegen(aboId, BEITRAG);
    const { data: zahlung } = await alsLehrer.rpc("record_cash_payment", {
      p_entry_id: id,
      p_amount: 40,
    });
    const zahlungId = (zahlung as Record<string, unknown>).id as string;

    const { error } = await alsLehrer.rpc("remove_cash_entry", { p_entry_id: id });
    expect(error, `Entfernen scheiterte: ${error?.message}`).toBeNull();

    const { count: eintraege } = await service
      .from("cash_entries")
      .select("id", { count: "exact", head: true })
      .eq("id", id);
    expect(eintraege).toBe(0);

    // Ein Eintrag ist eine Absicht, eine Zahlung eine Tatsache.
    const { data: geblieben } = await service
      .from("cash_payments")
      .select("amount, entry_id")
      .eq("id", zahlungId)
      .single();
    expect(Number(geblieben!.amount)).toBe(40);
    expect(geblieben!.entry_id).toBeNull();
  });

  it("leert mit „Zyklus abschließen“ die ganze Liste — nur für die Verwaltung", async () => {
    await eintragAnlegen(aboId, BEITRAG);
    await eintragAnlegen(flatrateId, 120);

    const { error: lehrerFehler } = await alsLehrer.rpc("close_cash_cycle");
    expect(lehrerFehler, "Eine Lehrkraft konnte die ganze Liste leeren").not.toBeNull();

    const { data: anzahl, error } = await alsAdmin.rpc("close_cash_cycle");
    expect(error, `Abschließen scheiterte: ${error?.message}`).toBeNull();
    expect(Number(anzahl)).toBeGreaterThanOrEqual(2);

    const { count } = await service
      .from("cash_entries")
      .select("id", { count: "exact", head: true });
    expect(count).toBe(0);
  });
});

describe("PROJ-84: Zahlungen", () => {
  it("addiert Teilbeträge und bleibt bis zum Rest offen", async () => {
    const id = await eintragAnlegen(aboId, BEITRAG);
    await alsLehrer.rpc("record_cash_payment", { p_entry_id: id, p_amount: 40 });
    expect(await offen(id)).toBe(49);

    const { error } = await alsLehrer.rpc("record_cash_payment", {
      p_entry_id: id,
      p_amount: 49,
    });
    expect(error, `Der zweite Teilbetrag wurde abgewiesen: ${error?.message}`).toBeNull();
    expect(await offen(id)).toBe(0);
  });

  it("erfasst ohne Betrag den gesamten offenen Rest", async () => {
    const id = await eintragAnlegen(aboId, BEITRAG);
    await alsLehrer.rpc("record_cash_payment", { p_entry_id: id, p_amount: 40 });

    const { data, error } = await alsLehrer.rpc("record_cash_payment", { p_entry_id: id });
    expect(error, `Erfassen scheiterte: ${error?.message}`).toBeNull();
    expect(Number((data as Record<string, unknown>).amount)).toBe(49);
    expect(await offen(id)).toBe(0);
  });

  it("nimmt nicht mehr an, als offen ist", async () => {
    // Ohne Zyklus gibt es kein „nächstes Mal", mit dem ein Guthaben verrechnet
    // würde — und die Grenze fängt den Vertipper um drei Nullen.
    const id = await eintragAnlegen(aboId, BEITRAG);
    const { error } = await alsLehrer.rpc("record_cash_payment", {
      p_entry_id: id,
      p_amount: 890,
    });
    expect(error, "Mehr als offen wurde angenommen").not.toBeNull();
    expect(await offen(id)).toBe(BEITRAG);
  });

  it("erfasst nichts, wenn nichts offen ist", async () => {
    const id = await eintragAnlegen(aboId, BEITRAG);
    await alsLehrer.rpc("record_cash_payment", { p_entry_id: id });
    const { error } = await alsLehrer.rpc("record_cash_payment", { p_entry_id: id, p_amount: 10 });
    expect(error, "Eine Zahlung auf einen bezahlten Eintrag wurde angenommen").not.toBeNull();
  });

  it("weist denselben Betrag im selben Augenblick ab, zwei verschiedene nicht", async () => {
    const id = await eintragAnlegen(aboId, 200);
    await alsLehrer.rpc("record_cash_payment", { p_entry_id: id, p_amount: 40 });

    const { error: doppelt } = await alsLehrer.rpc("record_cash_payment", {
      p_entry_id: id,
      p_amount: 40,
    });
    expect(doppelt, "Derselbe Betrag wurde zweimal verbucht").not.toBeNull();

    const { error: anders } = await alsLehrer.rpc("record_cash_payment", {
      p_entry_id: id,
      p_amount: 41,
    });
    expect(anders, `Ein anderer Betrag wurde abgewiesen: ${anders?.message}`).toBeNull();
  });

  it("gibt den Betrag nach einer Rücknahme wieder frei", async () => {
    const id = await eintragAnlegen(aboId, BEITRAG);
    const { data } = await alsLehrer.rpc("record_cash_payment", { p_entry_id: id, p_amount: 40 });
    const zahlungId = (data as Record<string, unknown>).id as string;

    const { error } = await alsLehrer.rpc("undo_cash_payment", { p_payment_id: zahlungId });
    expect(error, `Zurücknehmen scheiterte: ${error?.message}`).toBeNull();
    expect(await offen(id)).toBe(BEITRAG);
  });
});

describe("PROJ-84: Flatrater in jedem Kurs", () => {
  it("zeigt der Lehrkraft den Eintrag ihres Kurses als eigenen", async () => {
    await service.from("cash_entries").delete().in("subscription_id", [flatrateId, fremdAboId]);
    const id = await eintragAnlegen(aboId, BEITRAG);

    const zeilen = await liste(alsLehrer);
    const eigen = zeilen.find((z) => z.entry_id === id);
    expect(eigen, "Der Eintrag des eigenen Kurses fehlt").toBeTruthy();
    expect(eigen!.eigener_kurs).toBe(true);
    expect(Number(eigen!.amount_due)).toBe(BEITRAG);
  });

  it("zeigt einen Flatrate-Eintrag auch ohne Kursplatz — als fremden", async () => {
    await service.from("cash_entries").delete().eq("subscription_id", aboId);
    const id = await eintragAnlegen(flatrateId, 120);

    const zeilen = await liste(alsLehrer);
    const flat = zeilen.find((z) => z.entry_id === id);
    expect(flat, "Der Flatrate-Eintrag fehlt in diesem Kurs").toBeTruthy();
    expect(flat!.eigener_kurs).toBe(false);
    expect(flat!.ist_flatrate).toBe(true);
  });

  it("zeigt einen Kursabo-Eintrag eines fremden Kurses nicht", async () => {
    await service.from("cash_entries").delete().in("subscription_id", [aboId, flatrateId]);
    const id = await eintragAnlegen(fremdAboId, 75);

    const zeilen = await liste(alsLehrer);
    expect(zeilen.find((z) => z.entry_id === id)).toBeUndefined();
  });

  it("lässt die Lehrkraft bei einem Flatrater kassieren, der nicht in ihrem Kurs ist", async () => {
    const id = await eintragAnlegen(flatrateId, 120);
    const { error } = await alsLehrer.rpc("record_cash_payment", { p_entry_id: id, p_amount: 60 });
    expect(error, `Kassieren beim Flatrater scheiterte: ${error?.message}`).toBeNull();
    expect(await offen(id)).toBe(60);
  });

  it("lässt sie bei einem fremden Kursabo nicht kassieren", async () => {
    const id = await eintragAnlegen(fremdAboId, 75);
    const { error } = await alsLehrer.rpc("record_cash_payment", { p_entry_id: id, p_amount: 10 });
    expect(error, "Ein fremdes Kursabo ließ sich bezahlen").not.toBeNull();
  });
});

describe("PROJ-84: Wer darf was", () => {
  it("lässt die Verwaltung jedes Abo führen", async () => {
    const id = await eintragAnlegen(fremdAboId, 75);
    const { error } = await alsAdmin.rpc("record_cash_payment", { p_entry_id: id, p_amount: 75 });
    expect(error, `Der Verwaltung wurde es verwehrt: ${error?.message}`).toBeNull();
  });

  it("verbirgt die Liste vor einer fremden Lehrkraft", async () => {
    if (!alsFremderLehrer) return;
    const { error } = await alsFremderLehrer.rpc("get_course_cash_payers", {
      p_course_id: kursId,
    });
    expect(error, "Eine fremde Lehrkraft konnte die Liste lesen").not.toBeNull();
  });

  it("verbirgt die Einträge vor der Lehrkraft in der Tabelle — nur die Funktion antwortet", async () => {
    // Die Tabelle trägt Beträge; für eine Lehrkraft ist sie gesperrt. Eine
    // Regel, die leer liefert statt zu scheitern, wäre hier das Gefährlichere
    // (.claude/rules/backend.md) — deshalb wird beides geprüft.
    const id = await eintragAnlegen(aboId, BEITRAG);
    const { data } = await alsLehrer.from("cash_entries").select("id").eq("id", id);
    expect(data ?? []).toHaveLength(0);

    const zeilen = await liste(alsLehrer);
    expect(zeilen.find((z) => z.entry_id === id)).toBeTruthy();
  });

  it("zeigt dem Kunden seinen eigenen Eintrag", async () => {
    const id = await eintragAnlegen(aboId, BEITRAG);
    const { data } = await alsKunde.from("cash_entries").select("id, amount_due").eq("id", id);
    expect(data ?? [], "Der Kunde sieht seinen eigenen Eintrag nicht").toHaveLength(1);
  });

  it("weist nicht Angemeldete ab", async () => {
    const id = await eintragAnlegen(aboId, BEITRAG);
    const anonym = createClient(URL, ANON, { auth: { persistSession: false } });

    const { error: leseFehler } = await anonym.rpc("get_course_cash_payers", {
      p_course_id: kursId,
    });
    expect(leseFehler, "Die Liste war ohne Anmeldung lesbar").not.toBeNull();

    const { error: schreibFehler } = await anonym.rpc("record_cash_payment", {
      p_entry_id: id,
      p_amount: 10,
    });
    expect(schreibFehler, "Ohne Anmeldung ließ sich bezahlen").not.toBeNull();

    const { data } = await anonym.from("cash_entries").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
