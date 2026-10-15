import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-87: Upgrade auf die Flatrate.
 *
 * Geprüft wird der Vorgang in der Datenbank: Wer darf anfragen, was die
 * Bestätigung anrichtet, dass der Zyklus unberührt bleibt — und dass es
 * zurück keinen Weg gibt.
 *
 * Braucht die Migration 20261015160000_proj87_upgrade_auf_flatrate.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";
const ADMIN = "e2e8-admin@viennasalsastudio.test";
const KUNDE = "proj87-kunde@viennasalsastudio.test";
const FREMD = "proj87-fremd@viennasalsastudio.test";

const KURSPREIS = 75;
const ANKER = "2026-01-07";

let service: SupabaseClient;
let alsAdmin: SupabaseClient;
let alsKunde: SupabaseClient;
let alsFremder: SupabaseClient;

let kursId = "";
let zweiterKursId = "";
let kundeId = "";
let fremdId = "";
let aboId = "";
/** Die Preise, die in der Testdatenbank stehen — nicht erfundene. */
let flatrateNormal = 0;
let flatrateStudent = 0;
let preisErgaenzt = false;
/** Läufe, die diese Prüfungen angelegt haben — hinterher weg. */
const laeufe: string[] = [];

function heute(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(new Date());
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
  if (error || !data.user) throw new Error(`PROJ-87 Konto ${mail}: ${error?.message}`);
  await service.from("profiles").update({ full_name: name }).eq("id", data.user.id);
  return data.user.id;
}

/** Das Abo auf den Ausgangszustand zurücksetzen. */
async function zuruecksetzen() {
  await service.from("subscription_surcharges").delete().eq("customer_id", kundeId);
  await service.from("course_memberships").delete().eq("customer_id", kundeId);
  await service.from("notification_queue").delete().eq("customer_id", kundeId);
  // Zuerst die Laufpositionen: Sie verweisen auf das Abo, und der
  // Fremdschlüssel lässt es sonst nicht löschen.
  await service.from("sepa_collection_items").delete().eq("customer_id", kundeId);
  const { error: loeschFehler } = await service
    .from("subscriptions")
    .delete()
    .eq("customer_id", kundeId);
  // Geprüft, nicht gehofft: Blieb das alte Abo stehen, hätte der Kunde zwei —
  // und `flatrate_upgrade_moeglich` sagt dann zu Recht „nein". Genau so sind
  // zwei Prüfungen hier rot geworden, ohne dass die Ursache am Ergebnis zu
  // sehen war.
  if (loeschFehler) throw new Error(`PROJ-87 Aufräumen: ${loeschFehler.message}`);

  const { data, error } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: kursId,
      status: "active",
      name: "E2E87 Kursabo",
      price: KURSPREIS,
      cycle_anchor_date: ANKER,
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-87 Abo: ${error.message}`);
  aboId = data!.id;
}

async function abo() {
  const { data } = await service
    .from("subscriptions")
    .select("course_id, name, price, cycle_anchor_date, upgrade_requested_at")
    .eq("id", aboId)
    .single();
  return data!;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  kundeId = await kontoAnlegen(KUNDE, "E2E87 Upgrade-Kunde");
  fremdId = await kontoAnlegen(FREMD, "E2E87 Fremder");

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  for (const ziel of ["erster", "zweiter"] as const) {
    const { data: kurs, error } = await service
      .from("courses")
      .insert({ name: `E2E87 ${ziel} ${Date.now()}`, room_id: raum!.id, price: KURSPREIS })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-87 Kurs: ${error.message}`);
    if (ziel === "erster") kursId = kurs!.id;
    else zweiterKursId = kurs!.id;
  }

  // Die Preisliste gehört allen Tests. Deshalb wird gelesen, was dasteht, und
  // nur ergänzt, wenn nichts dasteht — hinterher wieder zurückgenommen.
  const { data: preise } = await service
    .from("dropin_pricing")
    .select("flatrate_price, flatrate_student_price")
    .limit(1)
    .single();
  if (preise?.flatrate_price === null || preise?.flatrate_price === undefined) {
    await service
      .from("dropin_pricing")
      .update({ flatrate_price: 120, flatrate_student_price: 95 })
      .not("id", "is", null);
    preisErgaenzt = true;
    flatrateNormal = 120;
    flatrateStudent = 95;
  } else {
    flatrateNormal = Number(preise.flatrate_price);
    flatrateStudent = Number(preise.flatrate_student_price ?? preise.flatrate_price);
  }

  // Ein Mandat: Ohne gueltiges Mandat gibt es keine Lastschrift, und der
  // Aufschlag bliebe liegen (was weiter unten eigens geprueft wird).
  await service.from("sepa_mandates").insert({
    customer_id: kundeId,
    iban: "AT611904300234573201",
    account_holder_name: "E2E87 Upgrade-Kunde",
    mandate_reference: `E2E87-${Date.now()}`,
    consented_at: new Date().toISOString(),
  });

  await zuruecksetzen();

  alsAdmin = await angemeldetAls(URL, ANON, ADMIN, PASSWORT);
  alsKunde = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
  alsFremder = await angemeldetAls(URL, ANON, FREMD, PASSWORT);
}, 120_000);

afterAll(async () => {
  for (const lauf of laeufe) {
    await service.from("sepa_collection_items").delete().eq("run_id", lauf);
    await service.from("sepa_collection_runs").delete().eq("id", lauf);
  }
  for (const id of [kundeId, fremdId].filter(Boolean)) {
    await service.from("sepa_mandates").delete().eq("customer_id", id);
    await service.from("subscription_surcharges").delete().eq("customer_id", id);
    await service.from("course_memberships").delete().eq("customer_id", id);
    await service.from("notification_queue").delete().eq("customer_id", id);
    await service.from("subscriptions").delete().eq("customer_id", id);
    await service.auth.admin.deleteUser(id).catch(() => {});
  }
  for (const kurs of [kursId, zweiterKursId].filter(Boolean)) {
    await service.from("courses").delete().eq("id", kurs);
  }
  if (preisErgaenzt) {
    await service
      .from("dropin_pricing")
      .update({ flatrate_price: null, flatrate_student_price: null })
      .not("id", "is", null);
  }
});

describe("PROJ-87: Wer darf upgraden", () => {
  it("lässt ein aktives Kursabo upgraden", async () => {
    await zuruecksetzen();
    const { data } = await alsKunde.rpc("flatrate_upgrade_moeglich", { p_subscription_id: aboId });
    expect(data).toBe(true);
  });

  it("lässt kein zweites Kursabo daneben zu", async () => {
    // Zwei Abos zu einer Flatrate zu verschmelzen ist eine Geldentscheidung.
    await zuruecksetzen();
    const { data: zweites } = await service
      .from("subscriptions")
      .insert({
        customer_id: kundeId,
        course_id: zweiterKursId,
        status: "active",
        name: "E2E87 Zweites",
        price: KURSPREIS,
        cycle_anchor_date: ANKER,
      })
      .select("id")
      .single();

    const { data } = await alsKunde.rpc("flatrate_upgrade_moeglich", { p_subscription_id: aboId });
    expect(data).toBe(false);
    await service.from("subscriptions").delete().eq("id", zweites!.id);
  });

  it("lässt kein Abo mit ausstehender Änderung upgraden", async () => {
    await zuruecksetzen();
    await service
      .from("subscriptions")
      .update({ pending_status: "cancelled", pending_effective_date: heute() })
      .eq("id", aboId);
    const { data } = await alsKunde.rpc("flatrate_upgrade_moeglich", { p_subscription_id: aboId });
    expect(data).toBe(false);
  });

  it("lässt eine Flatrate nicht noch einmal upgraden", async () => {
    await zuruecksetzen();
    await service.from("subscriptions").update({ course_id: null }).eq("id", aboId);
    const { data } = await alsKunde.rpc("flatrate_upgrade_moeglich", { p_subscription_id: aboId });
    expect(data).toBe(false);
  });
});

describe("PROJ-87: Anfragen", () => {
  it("merkt die Anfrage am Abo, ohne es zu ändern", async () => {
    await zuruecksetzen();
    const { error } = await alsKunde.rpc("request_flatrate_upgrade", { p_subscription_id: aboId });
    expect(error, `Anfrage abgewiesen: ${error?.message}`).toBeNull();

    const stand = await abo();
    expect(stand.upgrade_requested_at).not.toBeNull();
    // Unberührt: Kurs, Preis, Zyklus.
    expect(stand.course_id).toBe(kursId);
    expect(Number(stand.price)).toBe(KURSPREIS);
    expect(stand.cycle_anchor_date).toBe(ANKER);
  });

  it("zieht die eigene Anfrage zurück", async () => {
    await zuruecksetzen();
    await alsKunde.rpc("request_flatrate_upgrade", { p_subscription_id: aboId });
    const { error } = await alsKunde.rpc("withdraw_flatrate_upgrade", { p_subscription_id: aboId });
    expect(error, `Zurückziehen scheiterte: ${error?.message}`).toBeNull();
    expect((await abo()).upgrade_requested_at).toBeNull();
  });

  it("lässt niemanden für ein fremdes Abo anfragen", async () => {
    await zuruecksetzen();
    const { error } = await alsFremder.rpc("request_flatrate_upgrade", {
      p_subscription_id: aboId,
    });
    expect(error, "Ein fremdes Abo ließ sich anfragen").not.toBeNull();
    expect((await abo()).upgrade_requested_at).toBeNull();
  });
});

describe("PROJ-87: Bestätigen", () => {
  async function angefragt() {
    await zuruecksetzen();
    await alsKunde.rpc("request_flatrate_upgrade", { p_subscription_id: aboId });
  }

  it("stellt das Abo um und legt den Kursplatz daneben", async () => {
    await angefragt();
    const { error } = await alsAdmin.rpc("confirm_flatrate_upgrade", {
      p_subscription_id: aboId,
      p_student: false,
    });
    expect(error, `Bestätigen scheiterte: ${error?.message}`).toBeNull();

    const stand = await abo();
    expect(stand.course_id).toBeNull();
    expect(stand.name).toBe("Flatrate");
    expect(Number(stand.price)).toBe(flatrateNormal);
    expect(stand.upgrade_requested_at).toBeNull();
    // Der Rhythmus bleibt: Ein neues Abo wäre nach PROJ-70 sofort fällig.
    expect(stand.cycle_anchor_date).toBe(ANKER);

    const { data: plaetze } = await service
      .from("course_memberships")
      .select("course_id, started_on, ended_on")
      .eq("subscription_id", aboId);
    expect(plaetze).toHaveLength(1);
    expect(plaetze![0].course_id).toBe(kursId);
    expect(plaetze![0].started_on).toBe(heute());
    expect(plaetze![0].ended_on).toBeNull();
  });

  it("hält die ganze Differenz als Aufschlag fest — genau einen", async () => {
    await angefragt();
    await alsAdmin.rpc("confirm_flatrate_upgrade", { p_subscription_id: aboId, p_student: false });

    const { data: aufschlaege } = await service
      .from("subscription_surcharges")
      .select("amount, reason, collection_item_id")
      .eq("subscription_id", aboId);
    expect(aufschlaege).toHaveLength(1);
    expect(Number(aufschlaege![0].amount)).toBe(flatrateNormal - KURSPREIS);
    expect(aufschlaege![0].collection_item_id, "Der Aufschlag gilt als offen").toBeNull();
  });

  it("nimmt den Studierendentarif, wenn er gewählt ist", async () => {
    await angefragt();
    await alsAdmin.rpc("confirm_flatrate_upgrade", { p_subscription_id: aboId, p_student: true });
    expect(Number((await abo()).price)).toBe(flatrateStudent);
  });

  it("legt keinen Aufschlag an, wenn die Flatrate nicht teurer ist", async () => {
    await zuruecksetzen();
    // Ein Kursabo, das mehr kostet als die Flatrate — kommt bei
    // Sonderabsprachen vor.
    await service
      .from("subscriptions")
      .update({ price: flatrateNormal + 10 })
      .eq("id", aboId);
    await alsKunde.rpc("request_flatrate_upgrade", { p_subscription_id: aboId });
    await alsAdmin.rpc("confirm_flatrate_upgrade", { p_subscription_id: aboId, p_student: false });

    const { count } = await service
      .from("subscription_surcharges")
      .select("id", { count: "exact", head: true })
      .eq("subscription_id", aboId);
    expect(count).toBe(0);
  });

  it("benachrichtigt den Kunden", async () => {
    await angefragt();
    await alsAdmin.rpc("confirm_flatrate_upgrade", { p_subscription_id: aboId, p_student: false });

    const { data: zeilen } = await service
      .from("notification_queue")
      .select("event_type, payload")
      .eq("customer_id", kundeId)
      .eq("event_type", "abo_upgrade");
    expect(zeilen).toHaveLength(1);
    expect((zeilen![0].payload as Record<string, unknown>).entscheidung).toBe("bestaetigt");
  });

  it("lehnt ab, ohne das Abo anzufassen", async () => {
    await angefragt();
    const { error } = await alsAdmin.rpc("decline_flatrate_upgrade", { p_subscription_id: aboId });
    expect(error, `Ablehnen scheiterte: ${error?.message}`).toBeNull();

    const stand = await abo();
    expect(stand.upgrade_requested_at).toBeNull();
    expect(stand.course_id).toBe(kursId);
    expect(Number(stand.price)).toBe(KURSPREIS);

    const { data: zeilen } = await service
      .from("notification_queue")
      .select("payload")
      .eq("customer_id", kundeId)
      .eq("event_type", "abo_upgrade");
    expect(zeilen).toHaveLength(1);
    expect((zeilen![0].payload as Record<string, unknown>).entscheidung).toBe("abgelehnt");
  });

  it("lässt den Kunden nicht selbst bestätigen", async () => {
    await angefragt();
    const { error } = await alsKunde.rpc("confirm_flatrate_upgrade", {
      p_subscription_id: aboId,
      p_student: false,
    });
    expect(error, "Ein Kunde konnte sein Upgrade selbst bestätigen").not.toBeNull();
    expect((await abo()).course_id).toBe(kursId);
  });

  it("bestätigt nichts ohne offene Anfrage", async () => {
    await zuruecksetzen();
    const { error } = await alsAdmin.rpc("confirm_flatrate_upgrade", {
      p_subscription_id: aboId,
      p_student: false,
    });
    expect(error, "Ohne Anfrage wurde bestätigt").not.toBeNull();
  });
});

describe("PROJ-87: Zurück geht es nicht", () => {
  it("lässt eine Flatrate nicht in einen Kurs zurückwechseln", async () => {
    // Die Sperre ist älter als dieses Feature (`course_id is not null` in
    // `self_switch_subscription_course`) — geprüft wird, dass sie hält.
    await zuruecksetzen();
    await alsKunde.rpc("request_flatrate_upgrade", { p_subscription_id: aboId });
    await alsAdmin.rpc("confirm_flatrate_upgrade", { p_subscription_id: aboId, p_student: false });

    const { error } = await alsKunde.rpc("self_switch_subscription_course", {
      p_subscription_id: aboId,
      p_new_course_id: zweiterKursId,
    });
    expect(error, "Die Flatrate ließ sich in einen Kurs zurücktauschen").not.toBeNull();
    expect((await abo()).course_id).toBeNull();
  });

  it("gibt dem Kunden seinen Aufschlag zu lesen, aber keinen fremden", async () => {
    await zuruecksetzen();
    await alsKunde.rpc("request_flatrate_upgrade", { p_subscription_id: aboId });
    await alsAdmin.rpc("confirm_flatrate_upgrade", { p_subscription_id: aboId, p_student: false });

    const { data: eigene } = await alsKunde.from("subscription_surcharges").select("amount");
    expect((eigene ?? []).length).toBeGreaterThan(0);

    const { data: fremde } = await alsFremder.from("subscription_surcharges").select("amount");
    expect(fremde ?? []).toHaveLength(0);
  });
});

describe("PROJ-87: Der Aufschlag im Lauf", () => {
  /** Einen Lauf anlegen, der nur dieser Prüfung gehört. */
  async function lauf(): Promise<string> {
    const tag = `2027-${String(1 + laeufe.length).padStart(2, "0")}-15`;
    await service.from("sepa_collection_runs").delete().eq("due_date", tag);
    const { data, error } = await service
      .from("sepa_collection_runs")
      .insert({ due_date: tag })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-87 Lauf: ${error.message}`);
    laeufe.push(data!.id);
    return data!.id;
  }

  /** Ein bestätigtes Upgrade und damit ein offener Aufschlag. */
  async function mitAufschlag(): Promise<number> {
    await zuruecksetzen();
    await alsKunde.rpc("request_flatrate_upgrade", { p_subscription_id: aboId });
    await alsAdmin.rpc("confirm_flatrate_upgrade", { p_subscription_id: aboId, p_student: false });
    return flatrateNormal - KURSPREIS;
  }

  async function aufschlag() {
    const { data } = await service
      .from("subscription_surcharges")
      .select("amount, collection_item_id")
      .eq("subscription_id", aboId)
      .single();
    return data!;
  }

  it("schlägt auf eine bestehende Position auf und stempelt sie", async () => {
    const differenz = await mitAufschlag();
    const laufId = await lauf();
    const { data: position } = await service
      .from("sepa_collection_items")
      .insert({
        run_id: laufId,
        customer_id: kundeId,
        subscription_id: aboId,
        amount: flatrateNormal,
        iban: "AT611904300234573201",
        account_holder_name: "E2E87 Upgrade-Kunde",
        mandate_reference: "E2E87-vorhanden",
      })
      .select("id")
      .single();

    const { data: anzahl, error } = await alsAdmin.rpc("apply_surcharges_to_run", {
      p_run_id: laufId,
    });
    expect(error, `Aufschlag scheiterte: ${error?.message}`).toBeNull();
    expect(Number(anzahl)).toBe(1);

    const { data: nachher } = await service
      .from("sepa_collection_items")
      .select("amount")
      .eq("id", position!.id)
      .single();
    expect(Number(nachher!.amount)).toBe(flatrateNormal + differenz);
    expect((await aufschlag()).collection_item_id).toBe(position!.id);
  });

  it("nimmt denselben Aufschlag nicht zweimal", async () => {
    await mitAufschlag();
    const laufId = await lauf();
    await service.from("sepa_collection_items").insert({
      run_id: laufId,
      customer_id: kundeId,
      subscription_id: aboId,
      amount: flatrateNormal,
      iban: "AT611904300234573201",
      account_holder_name: "E2E87 Upgrade-Kunde",
      mandate_reference: "E2E87-vorhanden",
    });

    await alsAdmin.rpc("apply_surcharges_to_run", { p_run_id: laufId });
    const { data: zweiteRunde } = await alsAdmin.rpc("apply_surcharges_to_run", {
      p_run_id: laufId,
    });
    expect(Number(zweiteRunde), "Der Aufschlag kam ein zweites Mal").toBe(0);
  });

  it("legt eine eigene Position an, wenn das Abo nicht im Lauf ist", async () => {
    // Der Fall, der die Lücke sichtbar gemacht hat: gekündigt zum nächsten
    // Fälligkeitstag, also kein Beitrag in diesem Lauf — die Differenz ist
    // trotzdem geschuldet.
    const differenz = await mitAufschlag();
    await service
      .from("subscriptions")
      .update({ pending_status: "cancelled", pending_effective_date: "2027-01-15" })
      .eq("id", aboId);

    const laufId = await lauf();
    const { data: anzahl, error } = await alsAdmin.rpc("apply_surcharges_to_run", {
      p_run_id: laufId,
    });
    expect(error, `Aufschlag scheiterte: ${error?.message}`).toBeNull();
    expect(Number(anzahl)).toBe(1);

    const { data: positionen } = await service
      .from("sepa_collection_items")
      .select("id, amount, subscription_id")
      .eq("run_id", laufId);
    expect(positionen).toHaveLength(1);
    expect(Number(positionen![0].amount)).toBe(differenz);
    expect(positionen![0].subscription_id).toBe(aboId);
    expect((await aufschlag()).collection_item_id).toBe(positionen![0].id);
  });

  it("lässt einen Aufschlag ohne Mandat liegen, statt ihn abzubuchen", async () => {
    const differenz = await mitAufschlag();
    await service
      .from("sepa_mandates")
      .update({ revoked_at: new Date().toISOString() })
      .eq("customer_id", kundeId);

    try {
      const laufId = await lauf();
      const { data: anzahl } = await alsAdmin.rpc("apply_surcharges_to_run", {
        p_run_id: laufId,
      });
      expect(Number(anzahl)).toBe(0);

      const { count } = await service
        .from("sepa_collection_items")
        .select("id", { count: "exact", head: true })
        .eq("run_id", laufId);
      expect(count).toBe(0);

      // Offen geblieben — er steht in der Barzahler-Übersicht.
      const stand = await aufschlag();
      expect(stand.collection_item_id).toBeNull();
      expect(Number(stand.amount)).toBe(differenz);
    } finally {
      await service
        .from("sepa_mandates")
        .update({ revoked_at: null })
        .eq("customer_id", kundeId);
    }
  });

  it("weist einen Kunden ab, der selbst aufschlagen will", async () => {
    await mitAufschlag();
    const laufId = await lauf();
    const { error } = await alsKunde.rpc("apply_surcharges_to_run", { p_run_id: laufId });
    expect(error, "Ein Kunde konnte Aufschläge verbuchen").not.toBeNull();
  });
});
