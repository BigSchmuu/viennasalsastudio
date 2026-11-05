import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";
import { naechsteFaelligkeit } from "@/lib/sepa/faelligkeit";
import type { Ferienzeitraum } from "@/lib/scheduling/dates";

/**
 * PROJ-97: Das Upgrade rechnet mit Unterrichtswochen.
 *
 * Bis hierher fragten beide Teile der Rechnung __28 Tage zurueck__: die
 * Ja/Nein-Frage, ob der naechste Lauf den Zyklus noch voll abbucht, und die
 * Anrechnung, die den Betrag liefert. Ferien verlaengern einen Zyklus
 * (PROJ-70) -- ein deshalb aelterer Einzug fiel heraus.
 *
 * Geprueft wird deshalb immer __dieselbe Lage zweimal__: einmal ohne Ferien,
 * einmal mit einer Ferienwoche im Zyklus. Die Antwort muss kippen. Eine
 * Pruefung, die nur den Ferienfall ansieht, wuerde auch bestehen, wenn die
 * Funktion immer dasselbe sagt.
 *
 * Angemeldet wird als die Rolle, die auch im Betrieb fragt -- nicht mit dem
 * Dienstschluessel, der an Leseregeln und Spaltenrechten vorbeigeht (PROJ-94).
 *
 * Braucht die Migration 20261105100000_proj97_upgrade_ferienbewusst.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";
const ADMIN = "e2e8-admin@viennasalsastudio.test";
const KUNDE = "proj97-kunde@viennasalsastudio.test";

const KURSPREIS = 59;
const FERIEN_NAME = "E2E97 Ferien";
/** Zehn Tage, nicht sieben: Der Sprung am Rand kann groesser als ein Tag sein. */
const FERIEN_VON = -14;
const FERIEN_BIS = -5;

let service: SupabaseClient;
let alsAdmin: SupabaseClient;
let alsKunde: SupabaseClient;
let ohneAnmeldung: SupabaseClient;

let kundeId = "";
let kursId = "";
let aboId = "";
let flatratePreis = 0;
let preisErgaenzt = false;
const laeufe: string[] = [];

/** Der Tag, an dem der Zyklus eines Einzugs gerade abgelaufen ist. */
let abgelaufenTag = "";
/** Der Tag danach: ein Einzug, dessen Zyklus noch laeuft. */
let gedecktTag = "";
/**
 * Zwei Tage aelter als die Grenze -- auch dem alten 28-Tage-Fenster entgangen.
 *
 * Der Geldfall braucht genau das. An der Grenze selbst lag der Einzug noch im
 * alten Fenster, und die Pruefung haette auch mit dem alten Code bestanden:
 * richtig aus dem falschen Grund.
 */
let aelterTag = "";

function wienTag(versatz = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(
    new Date(Date.now() + versatz * 86_400_000)
  );
}

async function ferienLesen(): Promise<Ferienzeitraum[]> {
  const { data, error } = await service.from("studio_holidays").select("starts_on, ends_on");
  if (error) throw new Error(`PROJ-97 Ferien lesen: ${error.message}`);
  return (data ?? []).map((f) => ({ von: f.starts_on, bis: f.ends_on }));
}

async function ferienSetzen(): Promise<void> {
  const { error } = await service.from("studio_holidays").insert({
    name: FERIEN_NAME,
    starts_on: wienTag(FERIEN_VON),
    ends_on: wienTag(FERIEN_BIS),
  });
  if (error) throw new Error(`PROJ-97 Ferien anlegen: ${error.message}`);
}

async function ferienWeg(): Promise<void> {
  await service.from("studio_holidays").delete().eq("name", FERIEN_NAME);
}

/**
 * Die Grenze suchen, statt 28 Tage zu raten.
 *
 * Gesucht sind zwei __benachbarte__ Tage, an denen die Antwort kippt. In der
 * Testdatenbank koennen eigene Ferien stehen; ein festes `heute - 28` waere
 * dann die falsche Grenze, und die Pruefung schlug aus einem Grund fehl, der
 * nichts mit der Aenderung zu tun hat.
 */
async function grenzeFinden(): Promise<void> {
  const ferien = await ferienLesen();
  const heute = wienTag();
  for (let versatz = -60; versatz <= -1; versatz++) {
    const tag = wienTag(versatz);
    if (naechsteFaelligkeit(tag, ferien) <= heute && naechsteFaelligkeit(wienTag(versatz + 1), ferien) > heute) {
      abgelaufenTag = tag;
      gedecktTag = wienTag(versatz + 1);
      aelterTag = wienTag(versatz - 2);
      return;
    }
  }
  throw new Error("PROJ-97: keine Zyklusgrenze in den letzten 60 Tagen gefunden");
}

/** Einen freigegebenen Einzug vortaeuschen. */
async function einzug(tag: string, betrag = KURSPREIS): Promise<void> {
  const { data: vorhanden } = await service
    .from("sepa_collection_runs")
    .select("id")
    .eq("due_date", tag)
    .maybeSingle();
  let laufId = vorhanden?.id ?? "";
  if (!laufId) {
    const { data: lauf, error } = await service
      .from("sepa_collection_runs")
      .insert({ due_date: tag })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-97 Lauf: ${error.message}`);
    laufId = lauf!.id;
    laeufe.push(laufId);
  }
  // Einer freigegebenen Position etwas hinzuzufuegen verbietet PROJ-47 -- also
  // kurz zurueck in den Entwurf, Position anlegen, dann freigeben.
  await service.from("sepa_collection_runs").update({ released_at: null }).eq("id", laufId);
  const { error } = await service.from("sepa_collection_items").insert({
    run_id: laufId,
    customer_id: kundeId,
    subscription_id: aboId,
    amount: betrag,
    iban: "AT611904300234573201",
    account_holder_name: "E2E97 Upgrade-Kunde",
    mandate_reference: "E2E97",
  });
  if (error) throw new Error(`PROJ-97 Position: ${error.message}`);
  const { error: freigabe } = await service
    .from("sepa_collection_runs")
    .update({ released_at: new Date().toISOString() })
    .eq("id", laufId);
  if (freigabe) throw new Error(`PROJ-97 Freigabe: ${freigabe.message}`);
}

async function barzahlung(tag: string, betrag = KURSPREIS): Promise<void> {
  const { error } = await service.from("cash_payments").insert({
    subscription_id: aboId,
    customer_id: kundeId,
    amount: betrag,
    paid_on: tag,
  });
  if (error) throw new Error(`PROJ-97 Barzahlung: ${error.message}`);
}

async function kontoWeg(kennung: string): Promise<void> {
  const { data: abos } = await service.from("subscriptions").select("id").eq("customer_id", kennung);
  const aboIds = (abos ?? []).map((a) => a.id);
  if (aboIds.length > 0) {
    const { data: posten } = await service
      .from("sepa_collection_items")
      .select("id")
      .in("subscription_id", aboIds);
    const ids = (posten ?? []).map((p) => p.id);
    if (ids.length > 0) {
      await service.from("invoices").delete().in("collection_item_id", ids);
      await service.from("sepa_collection_items").delete().in("id", ids);
    }
  }
  await service.from("invoices").delete().eq("customer_id", kennung);
  await service.from("sepa_collection_items").delete().eq("customer_id", kennung);
  await service.from("subscription_surcharges").delete().eq("customer_id", kennung);
  await service.from("cash_payments").delete().eq("customer_id", kennung);
  await service.from("course_memberships").delete().eq("customer_id", kennung);
  await service.from("notification_queue").delete().eq("customer_id", kennung);
  await service.from("sepa_mandates").delete().eq("customer_id", kennung);
  await service.from("subscriptions").delete().eq("customer_id", kennung);
  const { error } = await service.auth.admin.deleteUser(kennung);
  if (error) throw new Error(`PROJ-97 Konto ${kennung} nicht entfernt: ${error.message}`);
}

/** Zurueck auf ein aktives Kursabo ohne Zahlungen und ohne Aufschlag. */
async function aufraeumen(): Promise<void> {
  await service.from("subscription_surcharges").delete().eq("customer_id", kundeId);
  await service.from("course_memberships").delete().eq("customer_id", kundeId);
  await service.from("notification_queue").delete().eq("customer_id", kundeId);
  await service.from("cash_payments").delete().eq("customer_id", kundeId);
  const { data: posten } = await service
    .from("sepa_collection_items")
    .select("id")
    .eq("customer_id", kundeId);
  const ids = (posten ?? []).map((p) => p.id);
  if (ids.length > 0) await service.from("invoices").delete().in("collection_item_id", ids);
  await service.from("sepa_collection_items").delete().eq("customer_id", kundeId);
  const { error: weg } = await service.from("subscriptions").delete().eq("customer_id", kundeId);
  // Geprueft, nicht gehofft: Bleibt ein altes Abo stehen, hat der Kunde zwei --
  // und `flatrate_upgrade_moeglich` sagt dann zu Recht nein.
  if (weg) throw new Error(`PROJ-97 Aufraeumen: ${weg.message}`);

  const { data, error } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: kursId,
      status: "active",
      name: "E2E97 Kursabo",
      price: KURSPREIS,
      cycle_anchor_date: wienTag(-60),
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-97 Abo: ${error.message}`);
  aboId = data!.id;
}

async function lage(): Promise<boolean> {
  const { data, error } = await alsAdmin.rpc("flatrate_upgrade_zyklus_wird_abgebucht", {
    p_subscription_id: aboId,
  });
  if (error) throw new Error(`PROJ-97 Lage: ${error.message}`);
  return data as boolean;
}

async function angerechnet(): Promise<number> {
  const { data, error } = await alsKunde.rpc("flatrate_upgrade_angerechnet", {
    p_customer_id: kundeId,
  });
  if (error) throw new Error(`PROJ-97 Anrechnung: ${error.message}`);
  return Number(data);
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });
  ohneAnmeldung = createClient(URL, ANON, { auth: { persistSession: false } });

  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === KUNDE);
  if (alt) await kontoWeg(alt.id);
  const { data: neu, error: kontoFehler } = await service.auth.admin.createUser({
    email: KUNDE,
    password: PASSWORT,
    email_confirm: true,
  });
  if (kontoFehler || !neu.user) throw new Error(`PROJ-97 Konto: ${kontoFehler?.message}`);
  kundeId = neu.user.id;
  await service.from("profiles").update({ full_name: "E2E97 Upgrade-Kunde" }).eq("id", kundeId);

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({ name: `E2E97 Kurs ${Date.now()}`, room_id: raum!.id, price: KURSPREIS })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-97 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  // Die Preisliste gehoert allen Tests: lesen, was dasteht, und nur ergaenzen,
  // wenn nichts dasteht -- hinterher zurueckgenommen.
  const { data: preise } = await service
    .from("dropin_pricing")
    .select("flatrate_price")
    .limit(1)
    .single();
  if (preise?.flatrate_price === null || preise?.flatrate_price === undefined) {
    await service.from("dropin_pricing").update({ flatrate_price: 145 }).not("id", "is", null);
    preisErgaenzt = true;
    flatratePreis = 145;
  } else {
    flatratePreis = Number(preise.flatrate_price);
  }

  await service.from("sepa_mandates").insert({
    customer_id: kundeId,
    iban: "AT611904300234573201",
    account_holder_name: "E2E97 Upgrade-Kunde",
    mandate_reference: `E2E97-${Date.now()}`,
    consented_at: new Date().toISOString(),
  });

  await ferienWeg();
  await grenzeFinden();
  await aufraeumen();

  alsAdmin = await angemeldetAls(URL, ANON, ADMIN, PASSWORT);
  alsKunde = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
}, 120_000);

afterEach(async () => {
  // Ferien in der jüngeren Vergangenheit verschieben jede Faelligkeitsrechnung
  // im Projekt. Sie verlassen diesen Test nicht.
  await ferienWeg();
});

afterAll(async () => {
  await ferienWeg();
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
  if (kundeId) await kontoWeg(kundeId);
  if (kursId) await service.from("courses").delete().eq("id", kursId);
  if (preisErgaenzt) {
    await service.from("dropin_pricing").update({ flatrate_price: null }).not("id", "is", null);
  }
});

describe("PROJ-97: Die Ja/Nein-Frage", () => {
  it("sieht den Zyklus als abgelaufen, sobald die naechste Faelligkeit erreicht ist", async () => {
    await aufraeumen();
    await einzug(abgelaufenTag);
    // Genau der Randfall aus Befund 2: Ist die Faelligkeit erreicht, nimmt der
    // naechste Lauf das Abo regulaer mit. Ein Aufschlag daneben waere derselbe
    // Zyklus zum zweiten Mal -- der Fehler, gegen den PROJ-91 angetreten ist.
    expect(await lage()).toBe(true);
  });

  it("sieht ihn als gedeckt, solange die Faelligkeit noch aussteht", async () => {
    await aufraeumen();
    await einzug(gedecktTag);
    expect(await lage()).toBe(false);
  });

  it("liegt die Grenze genau einen Tag auseinander", () => {
    // Der Beleg, dass oben zwei benachbarte Tage geprueft wurden und nicht
    // irgendein Abstand.
    const naechster = new Date(Date.parse(`${abgelaufenTag}T00:00:00Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(naechster).toBe(gedecktTag);
  });

  it("dreht die Antwort, wenn eine Ferienwoche im Zyklus liegt", async () => {
    await aufraeumen();
    await einzug(abgelaufenTag);
    expect(await lage(), "ohne Ferien muesste der Zyklus abgelaufen sein").toBe(true);

    await ferienSetzen();
    const mitFerien = await ferienLesen();
    expect(
      naechsteFaelligkeit(abgelaufenTag, mitFerien) > wienTag(),
      "Die gesetzten Ferien verlaengern den Zyklus nicht bis ueber heute -- Pruefung waere ohne Aussage"
    ).toBe(true);

    expect(await lage(), "mit Ferien muesste der Zyklus gedeckt sein").toBe(false);
  });
});

describe("PROJ-97: Die Anrechnung", () => {
  it("rechnet einen Einzug erst dann nicht mehr an, wenn der Zyklus wirklich vorbei ist", async () => {
    await aufraeumen();
    await einzug(abgelaufenTag);
    expect(await angerechnet()).toBe(0);

    await ferienSetzen();
    expect(await angerechnet(), "Der Einzug liegt im verlaengerten Zyklus").toBe(KURSPREIS);
  });

  it("rechnet eine Barzahlung im verlaengerten Zyklus an", async () => {
    await aufraeumen();
    await barzahlung(abgelaufenTag);
    expect(await angerechnet()).toBe(0);

    await ferienSetzen();
    expect(await angerechnet()).toBe(KURSPREIS);
  });

  it("nennt in der Aufstellung alle fuenf Angaben", async () => {
    // PROJ-95: `returns table` ist positionsbasiert, und PL/pgSQL prueft die
    // Struktur erst beim Aufruf. Eine verlorene Spalte faellt nur hier auf.
    await aufraeumen();
    await einzug(abgelaufenTag);
    await ferienSetzen();

    const { data, error } = await alsKunde.rpc("flatrate_upgrade_anrechnung", {
      p_customer_id: kundeId,
    });
    if (error) throw new Error(`PROJ-97 Aufstellung: ${error.message}`);
    expect(data).toHaveLength(1);
    const zeile = data![0] as Record<string, unknown>;
    expect(Object.keys(zeile).sort()).toEqual(
      ["art", "betrag", "bezeichnung", "eingang", "subscription_id"].sort()
    );
    expect(zeile.art).toBe("lastschrift");
    expect(Number(zeile.betrag)).toBe(KURSPREIS);
    expect(zeile.eingang).toBe(abgelaufenTag);
    expect(zeile.subscription_id).toBe(aboId);
  });
});

describe("PROJ-97: Beides zusammen", () => {
  it("schlaegt die Differenz auf, nicht den ganzen Preis", async () => {
    expect(
      flatratePreis > KURSPREIS,
      `Flatrate (${flatratePreis}) muss ueber dem Kurspreis (${KURSPREIS}) liegen`
    ).toBe(true);

    await aufraeumen();
    // Bewusst der aeltere Tag: Dem alten Fenster waere dieser Einzug entgangen,
    // die Lage haette "wird noch voll abgebucht" gelautet und es gaebe gar
    // keinen Aufschlag. Genau Befund 1.
    await einzug(aelterTag);
    await ferienSetzen();
    const mitFerien = await ferienLesen();
    expect(
      naechsteFaelligkeit(aelterTag, mitFerien) > wienTag(),
      "Die gesetzten Ferien decken diesen Einzug nicht bis heute -- Pruefung waere ohne Aussage"
    ).toBe(true);
    expect(await lage(), "Der Zyklus ist bezahlt, der Lauf bucht ihn nicht erneut ab").toBe(false);

    await alsKunde.rpc("request_flatrate_upgrade", { p_subscription_id: aboId });
    const { error } = await alsAdmin.rpc("confirm_flatrate_upgrade", {
      p_subscription_id: aboId,
      p_student: false,
    });
    expect(error, `Bestaetigen scheiterte: ${error?.message}`).toBeNull();

    const { data } = await service
      .from("subscription_surcharges")
      .select("amount")
      .eq("subscription_id", aboId)
      .maybeSingle();
    // Die halbe Korrektur waere hier der ganze Preis: richtige Ja/Nein-Antwort,
    // altes Anrechnungsfenster -- und der Kunde zahlt den Kurspreis zweimal.
    expect(Number(data?.amount), "Erwartet: Flatrate minus Angerechnetes").toBe(
      Math.round((flatratePreis - KURSPREIS) * 100) / 100
    );
  });
});

describe("PROJ-97: Rechte", () => {
  it("gibt beiden Funktionen kein Ausfuehrungsrecht fuer anon", async () => {
    // `create or replace function` setzt die Rechte zurueck, und Supabase
    // vergibt EXECUTE per Default-Privileg neu an `anon`.
    for (const [name, argumente] of [
      ["flatrate_upgrade_zyklus_wird_abgebucht", { p_subscription_id: aboId }],
      ["flatrate_upgrade_anrechnung", { p_customer_id: kundeId }],
    ] as const) {
      const { error } = await ohneAnmeldung.rpc(name, argumente);
      expect(error, `${name} war fuer anon aufrufbar`).not.toBeNull();
    }
  });
});
