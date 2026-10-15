import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
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

/**
 * Ein Testkonto samt allem, was darauf verweist.
 *
 * Nur `deleteUser` genügt nicht: Laufpositionen, Rechnungen und Aufschläge
 * zeigen auf das Profil, und der Fremdschlüssel lässt es dann nicht löschen.
 * Beim ersten Anlauf stand deshalb das Konto des Vorlaufs noch da — und weil
 * der Fehler in einem `catch(() => {})` verschwand, meldete der Aufbau nur
 * „E-Mail-Adresse ist schon registriert". Fehler werden hier geprüft.
 */
async function kontoWeg(kennung: string): Promise<void> {
  const { data: abos } = await service.from("subscriptions").select("id").eq("customer_id", kennung);
  const aboIds = (abos ?? []).map((a) => a.id);
  if (aboIds.length > 0) {
    const { data: posten } = await service
      .from("sepa_collection_items")
      .select("id")
      .in("subscription_id", aboIds);
    const postenIds = (posten ?? []).map((p) => p.id);
    if (postenIds.length > 0) {
      await service.from("invoices").delete().in("collection_item_id", postenIds);
      await service.from("sepa_collection_items").delete().in("id", postenIds);
    }
  }
  await service.from("invoices").delete().eq("customer_id", kennung);
  await service.from("sepa_collection_items").delete().eq("customer_id", kennung);
  await service.from("subscription_surcharges").delete().eq("customer_id", kennung);
  await service.from("cash_payments").delete().eq("customer_id", kennung);
  await service.from("cash_entries").delete().eq("customer_id", kennung);
  await service.from("course_memberships").delete().eq("customer_id", kennung);
  await service.from("notification_queue").delete().eq("customer_id", kennung);
  await service.from("sepa_mandates").delete().eq("customer_id", kennung);
  await service.from("subscriptions").delete().eq("customer_id", kennung);

  const { error } = await service.auth.admin.deleteUser(kennung);
  if (error) throw new Error(`PROJ-87 Konto ${kennung} nicht entfernt: ${error.message}`);
}

async function kontoAnlegen(mail: string, name: string): Promise<string> {
  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === mail);
  if (alt) await kontoWeg(alt.id);
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

/** Einen Einzug für ein Abo vortäuschen — mit oder ohne Rückbuchung. */
async function einzug(abo: string, betrag: number, versatzTage: number, geplatzt = false) {
  const tag = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(
    new Date(Date.now() + versatzTage * 24 * 3_600_000)
  );
  // Einen bestehenden Lauf desselben Tages **mitbenutzen**, nicht löschen:
  // Zwei Einzüge am selben Tag gehören in denselben Lauf. Gelöscht nahm der
  // zweite Aufruf dem ersten die Position mit, und angerechnet wurde nur die
  // Hälfte.
  const { data: vorhanden } = await service
    .from("sepa_collection_runs")
    .select("id")
    .eq("due_date", tag)
    .maybeSingle();
  let laufId = vorhanden?.id ?? "";
  if (!laufId) {
    const { data: lauf, error: laufFehler } = await service
      .from("sepa_collection_runs")
      .insert({ due_date: tag })
      .select("id")
      .single();
    if (laufFehler) throw new Error(`PROJ-88 Lauf: ${laufFehler.message}`);
    laufId = lauf!.id;
    laeufe.push(laufId);
  }

  const { error } = await service.from("sepa_collection_items").insert({
    run_id: laufId,
    customer_id: kundeId,
    subscription_id: abo,
    amount: betrag,
    iban: "AT611904300234573201",
    account_holder_name: "E2E87 Upgrade-Kunde",
    mandate_reference: "E2E88",
    bounced_at: geplatzt ? new Date().toISOString() : null,
  });
  if (error) throw new Error(`PROJ-88 Position: ${error.message}`);
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
    const { data: posten } = await service
      .from("sepa_collection_items")
      .select("id")
      .eq("run_id", lauf);
    const ids = (posten ?? []).map((p) => p.id);
    if (ids.length > 0) await service.from("invoices").delete().in("collection_item_id", ids);
    await service.from("sepa_collection_items").delete().eq("run_id", lauf);
    await service.from("sepa_collection_runs").delete().eq("id", lauf);
  }
  for (const id of [kundeId, fremdId].filter(Boolean)) {
    // Geprüft, nicht gehofft: Bleibt das Konto stehen, scheitert der nächste
    // Lauf schon im Aufbau.
    await kontoWeg(id);
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

  // „Genau ein Kursabo" war bis PROJ-88 Bedingung. Seither ist das Gegenteil
  // richtig, und es steht als eigene Prüfung im PROJ-88-Block.

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

  it("hält die Differenz zum Bezahlten als Aufschlag fest — genau einen", async () => {
    // Seit PROJ-88 rechnet die Differenz gegen das, was im laufenden Zyklus
    // tatsächlich einging — hier ein Einzug über den Kursbeitrag.
    await zuruecksetzen();
    await einzug(aboId, KURSPREIS, -10);
    await alsKunde.rpc("request_flatrate_upgrade", { p_subscription_id: aboId });
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

  it("legt keinen Aufschlag an, wenn schon genug bezahlt wurde", async () => {
    await zuruecksetzen();
    // Mehr eingezogen als die Flatrate kostet — kommt bei Sonderabsprachen
    // vor. Was zählt, ist das Bezahlte, nicht der Listenpreis.
    await einzug(aboId, flatrateNormal + 10, -10);
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
    // Tagesweise weiterzählen statt monatsweise: Mit mehr als zwölf Läufen in
    // einer Datei entstand sonst „2027-14-15", und Postgres nimmt den dreizehnten
    // Monat nicht.
    const tag = new Date(Date.UTC(2027, 0, 1 + laeufe.length)).toISOString().slice(0, 10);
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
    // Ein Einzug über den Kursbeitrag: Damit ist die Differenz der Unterschied
    // zum Flatrate-Preis und nicht dessen voller Betrag (PROJ-88).
    await einzug(aboId, KURSPREIS, -10);
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

  it("nennt die Differenz auf der Rechnung", async () => {
    // Hier und nicht im Browser: Ein echter Lauf nimmt jedes fällige Abo der
    // Testdatenbank mit, und die Freigabe schreibt für alle Rechnungen. Dieser
    // Lauf enthält genau eine Position.
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
        mandate_reference: "E2E87-rechnung",
      })
      .select("id")
      .single();

    await alsAdmin.rpc("apply_surcharges_to_run", { p_run_id: laufId });
    const { error } = await alsAdmin.rpc("create_invoices_for_collection_run", {
      p_run_id: laufId,
    });
    expect(error, `Rechnung scheiterte: ${error?.message}`).toBeNull();

    const { data: rechnung } = await service
      .from("invoices")
      .select("description, gross_amount")
      .eq("collection_item_id", position!.id)
      .single();

    // Derselbe Satzbau wie beim verrechneten Guthaben (PROJ-44): Rechnungen
    // haben hier eine Beschreibung und einen Betrag, keine Positionen.
    expect(rechnung!.description).toContain("Upgrade-Differenz");
    expect(Number(rechnung!.gross_amount)).toBe(flatrateNormal + differenz);
  });

  it("weist einen Kunden ab, der selbst aufschlagen will", async () => {
    await mitAufschlag();
    const laufId = await lauf();
    const { error } = await alsKunde.rpc("apply_surcharges_to_run", { p_run_id: laufId });
    expect(error, "Ein Kunde konnte Aufschläge verbuchen").not.toBeNull();
  });
});

describe("PROJ-88: Mehrere Kursabos", () => {
  let zweitesAbo = "";

  /** Ein zweites aktives Kursabo im anderen Kurs. */
  async function zweitesAnlegen(preis = 60): Promise<string> {
    const { data, error } = await service
      .from("subscriptions")
      .insert({
        customer_id: kundeId,
        course_id: zweiterKursId,
        status: "active",
        name: "E2E88 Zweites Kursabo",
        price: preis,
        cycle_anchor_date: ANKER,
      })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-88 Zweitabo: ${error.message}`);
    zweitesAbo = data!.id;
    return zweitesAbo;
  }

  afterEach(async () => {
    if (zweitesAbo) {
      await service.from("sepa_collection_items").delete().eq("subscription_id", zweitesAbo);
      await service.from("course_memberships").delete().eq("subscription_id", zweitesAbo);
      await service.from("subscriptions").delete().eq("id", zweitesAbo);
      zweitesAbo = "";
    }
  });

  it("lässt jetzt auch mit zwei Kursabos upgraden", async () => {
    await zuruecksetzen();
    await zweitesAnlegen();
    const { data } = await alsKunde.rpc("flatrate_upgrade_moeglich", { p_subscription_id: aboId });
    expect(data, "Mit zwei Kursabos wurde abgewiesen").toBe(true);
  });

  it("rechnet nur an, was tatsächlich eingezogen wurde", async () => {
    await zuruecksetzen();
    await zweitesAnlegen();
    await einzug(aboId, KURSPREIS, -10);
    // Für das zweite Abo kam nichts — es wird nicht angerechnet.
    const { data } = await alsKunde.rpc("flatrate_upgrade_angerechnet", {
      p_customer_id: kundeId,
    });
    expect(Number(data)).toBe(KURSPREIS);
  });

  it("rechnet eine zurückgebuchte Lastschrift nicht an", async () => {
    await zuruecksetzen();
    await einzug(aboId, KURSPREIS, -10, true);
    const { data } = await alsKunde.rpc("flatrate_upgrade_angerechnet", {
      p_customer_id: kundeId,
    });
    expect(Number(data), "Zurückgebuchtes Geld wurde angerechnet").toBe(0);
  });

  it("rechnet eine Barzahlung an wie einen Einzug", async () => {
    await zuruecksetzen();
    const { error } = await service.from("cash_payments").insert({
      subscription_id: aboId,
      customer_id: kundeId,
      amount: 40,
      paid_on: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(new Date()),
    });
    expect(error, `Barzahlung nicht angelegt: ${error?.message}`).toBeNull();

    const { data } = await alsKunde.rpc("flatrate_upgrade_angerechnet", {
      p_customer_id: kundeId,
    });
    expect(Number(data)).toBe(40);
  });

  it("lässt einen Einzug außerhalb des Fensters liegen", async () => {
    // Die bekannte Ungenauigkeit: Ferien verlängern einen Zyklus, aber die
    // Anrechnung schaut 28 Tage zurück. Zu Lasten des Kunden und sichtbar.
    await zuruecksetzen();
    await einzug(aboId, KURSPREIS, -40);
    const { data } = await alsKunde.rpc("flatrate_upgrade_angerechnet", {
      p_customer_id: kundeId,
    });
    expect(Number(data)).toBe(0);
  });

  it("legt beim Bestätigen beide Kurse als Plätze an und beendet das zweite Abo", async () => {
    await zuruecksetzen();
    const zweites = await zweitesAnlegen();
    await einzug(aboId, KURSPREIS, -10);
    await einzug(zweites, 60, -10);
    await alsKunde.rpc("request_flatrate_upgrade", { p_subscription_id: aboId });

    const { error } = await alsAdmin.rpc("confirm_flatrate_upgrade", {
      p_subscription_id: aboId,
      p_student: false,
    });
    expect(error, `Bestätigen scheiterte: ${error?.message}`).toBeNull();

    // Das angefragte Abo ist die Flatrate, sein Zyklus unberührt.
    const stand = await abo();
    expect(stand.course_id).toBeNull();
    expect(stand.cycle_anchor_date).toBe(ANKER);

    // Das zweite ist gekündigt, nicht gelöscht.
    const { data: zweiterStand } = await service
      .from("subscriptions")
      .select("status, cancelled_at")
      .eq("id", zweites)
      .single();
    expect(zweiterStand!.status).toBe("cancelled");
    expect(zweiterStand!.cancelled_at).not.toBeNull();

    // Beide Kurse stehen als Plätze an der Flatrate.
    const { data: plaetze } = await service
      .from("course_memberships")
      .select("course_id")
      .eq("subscription_id", aboId);
    const kurse = (plaetze ?? []).map((p) => p.course_id).sort();
    expect(kurse).toEqual([kursId, zweiterKursId].sort());

    // Und der Aufschlag rechnet gegen beide Einzüge: Preis minus 135.
    const { data: aufschlaege } = await service
      .from("subscription_surcharges")
      .select("amount")
      .eq("subscription_id", aboId);
    const erwartet = Math.round((flatrateNormal - (KURSPREIS + 60)) * 100) / 100;
    if (erwartet > 0) {
      expect(aufschlaege).toHaveLength(1);
      expect(Number(aufschlaege![0].amount)).toBe(erwartet);
    } else {
      expect(aufschlaege).toHaveLength(0);
    }
  });

  it("zeigt die Aufstellung mit Betrag, Tag und Art", async () => {
    await zuruecksetzen();
    await einzug(aboId, KURSPREIS, -10);
    const { data, error } = await alsAdmin.rpc("flatrate_upgrade_anrechnung", {
      p_customer_id: kundeId,
    });
    expect(error, `Aufstellung scheiterte: ${error?.message}`).toBeNull();
    expect(data).toHaveLength(1);
    const zeile = data![0] as Record<string, unknown>;
    expect(Number(zeile.betrag)).toBe(KURSPREIS);
    expect(zeile.art).toBe("lastschrift");
    expect(zeile.eingang).toBeTruthy();
  });

  it("gibt die Aufstellung eines fremden Kunden nicht heraus", async () => {
    const { error } = await alsFremder.rpc("flatrate_upgrade_anrechnung", {
      p_customer_id: kundeId,
    });
    expect(error, "Eine fremde Aufstellung war lesbar").not.toBeNull();
  });
});
