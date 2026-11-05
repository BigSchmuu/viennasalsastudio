import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-98: Zahlungszyklen bei den Barzahlern.
 *
 * Geprüft wird die **eine Regel**: Beim Abschließen verlässt die Liste genau,
 * wer bis einschließlich Enddatum voll bezahlt hat. Alles andere bleibt stehen
 * — die Offenen und die, die nach dem Enddatum gezahlt haben. Dazu das Archiv,
 * das Zurücknehmen und die Rechte.
 *
 * Die Prüfungen laufen mit den Zugängen, die es im Betrieb gibt: Abschließen
 * als Verwaltung (und als Lehrkraft, die abgewiesen werden muss), die
 * Kursliste als **Lehrkraft**. Mit dem Dienstschlüssel geprüft wäre der
 * Rechteteil nie geprüft — dieselbe Lehre wie bei PROJ-94/95.
 *
 * **Der Zyklus ist globaler Zustand.** `cash_entries` ist eine Liste für das
 * ganze Studio, und `close_cash_cycle` schreibt sie ganz ab. Diese Datei räumt
 * deshalb vor jeder Lage auf und löscht am Ende jeden Zyklus, den sie angelegt
 * hat: Ein liegengelassener Zyklus würde in anderen Testdateien still
 * entscheiden, welche Zahlung zum laufenden Zyklus gehört.
 *
 * Braucht die Migration 20261105160000_proj98_barzahlung_zyklen.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";
const ADMIN = "e2e8-admin@viennasalsastudio.test";
const LEHRER = "e2e13-lehrer-a@viennasalsastudio.test";

const marke = Date.now();

/** Vier Lagen, vier Menschen — und vier verschiedene Beträge. */
const LAGEN = [
  { schluessel: "voll", name: `E2E98 Vera Voll ${marke}`, betrag: 89 },
  { schluessel: "spaet", name: `E2E98 Sepp Spaet ${marke}`, betrag: 91 },
  { schluessel: "teil", name: `E2E98 Tina Teil ${marke}`, betrag: 93 },
  { schluessel: "nichts", name: `E2E98 Nora Nichts ${marke}`, betrag: 95 },
] as const;

type Schluessel = (typeof LAGEN)[number]["schluessel"];

let service: SupabaseClient;
let alsAdmin: SupabaseClient;
let alsLehrer: SupabaseClient;
let alsKunde: SupabaseClient;

let kursId = "";
const kunde: Record<string, string> = {};
const abo: Record<string, string> = {};
const konten: string[] = [];

/** Ein Wiener Kalendertag, um `versatz` Tage verschoben. */
function tag(versatz: number): string {
  const jetzt = new Date();
  jetzt.setUTCDate(jetzt.getUTCDate() + versatz);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(jetzt);
}

const T5 = tag(-5);
const ENDE = tag(-3);
const T1 = tag(-1);

async function konto(email: string, name: string): Promise<string> {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-98 Konto: ${error?.message}`);
  konten.push(data.user.id);
  await service.from("profiles").update({ full_name: name }).eq("id", data.user.id);
  return data.user.id;
}

/**
 * Die Liste und das Archiv leeren.
 *
 * Auch fremde Einträge gehen weg: Abgeschlossen wird die ganze Liste, und ein
 * Eintrag aus einer anderen Testdatei würde die Zahlen verschieben, die hier
 * geprüft werden.
 */
async function leereAlles(): Promise<void> {
  await service.from("cash_payments").delete().in("subscription_id", Object.values(abo));
  await service.from("cash_entries").delete().not("id", "is", null);
  await service.from("cash_cycles").delete().not("id", "is", null);
}

async function eintragAnlegen(schluessel: Schluessel, betrag: number): Promise<string> {
  const { data, error } = await service
    .from("cash_entries")
    .insert({
      customer_id: kunde[schluessel],
      subscription_id: abo[schluessel],
      amount_due: betrag,
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-98 Eintrag (${schluessel}): ${error.message}`);
  return data!.id;
}

async function zahlungAnlegen(
  schluessel: Schluessel,
  eintragId: string,
  betrag: number,
  paidOn: string
): Promise<void> {
  const { error } = await service.from("cash_payments").insert({
    subscription_id: abo[schluessel],
    customer_id: kunde[schluessel],
    entry_id: eintragId,
    amount: betrag,
    paid_on: paidOn,
  });
  if (error) throw new Error(`PROJ-98 Zahlung (${schluessel}): ${error.message}`);
}

/**
 * Die vier Lagen herstellen: voll bezahlt vor dem Enddatum, bezahlt **nach**
 * dem Enddatum, teilweise bezahlt, nichts bezahlt.
 */
async function lageHerstellen(): Promise<Record<Schluessel, string>> {
  await leereAlles();
  const ids = {} as Record<Schluessel, string>;
  for (const lage of LAGEN) {
    ids[lage.schluessel] = await eintragAnlegen(lage.schluessel, lage.betrag);
  }
  await zahlungAnlegen("voll", ids.voll, 89, T5);
  await zahlungAnlegen("spaet", ids.spaet, 91, T1);
  await zahlungAnlegen("teil", ids.teil, 40, T5);
  return ids;
}

async function abschliessen(ende: string, client: SupabaseClient = alsAdmin) {
  return client.rpc("close_cash_cycle", { p_ends_on: ende });
}

async function zyklen(client: SupabaseClient = alsAdmin) {
  const { data, error } = await client.rpc("get_cash_cycles");
  if (error) throw new Error(`PROJ-98 Zyklen: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

async function archiv(client: SupabaseClient = alsAdmin, kundeId?: string) {
  const { data, error } = await client.rpc("get_cash_archive_entries", {
    p_customer_id: kundeId ?? null,
  });
  if (error) throw new Error(`PROJ-98 Archiv: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

async function kursliste() {
  const { data, error } = await alsLehrer.rpc("get_course_cash_payers", { p_course_id: kursId });
  if (error) throw new Error(`PROJ-98 Kursliste: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

function zeileVon(zeilen: Record<string, unknown>[], schluessel: Schluessel) {
  return zeilen.find((z) => z.subscription_id === abo[schluessel]);
}

async function eintraegeAufDerListe(): Promise<string[]> {
  const { data } = await service
    .from("cash_entries")
    .select("subscription_id")
    .in("subscription_id", Object.values(abo));
  return (data ?? []).map((e) => e.subscription_id);
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error: kursFehler } = await service
    .from("courses")
    .insert({ name: `E2E98 Zyklus ${marke}`, room_id: raum!.id, price: 89 })
    .select("id")
    .single();
  if (kursFehler) throw new Error(`PROJ-98 Kurs: ${kursFehler.message}`);
  kursId = kurs!.id;

  const { data: lehrer } = await service
    .from("profiles")
    .select("id")
    .eq("full_name", "E2E13 Lehrer A")
    .single();
  await service.from("course_teachers").insert({ course_id: kursId, teacher_id: lehrer!.id });

  for (const lage of LAGEN) {
    const id = await konto(`proj98-${lage.schluessel}-${marke}@viennasalsastudio.test`, lage.name);
    kunde[lage.schluessel] = id;
    const { data, error } = await service
      .from("subscriptions")
      .insert({
        customer_id: id,
        course_id: kursId,
        status: "active",
        name: `E2E98 Kursabo ${lage.schluessel}`,
        price: lage.betrag,
        cycle_anchor_date: "2026-01-07",
      })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-98 Abo: ${error.message}`);
    abo[lage.schluessel] = data!.id;
  }

  alsAdmin = await angemeldetAls(URL, ANON, ADMIN, PASSWORT);
  alsLehrer = await angemeldetAls(URL, ANON, LEHRER, PASSWORT);
  alsKunde = await angemeldetAls(
    URL,
    ANON,
    `proj98-voll-${marke}@viennasalsastudio.test`,
    PASSWORT
  );
}, 180_000);

afterAll(async () => {
  // Zuerst die Zyklen: Ein liegengelassener Zyklus entscheidet in anderen
  // Testdateien still mit, welche Zahlung zum laufenden Zyklus gehört.
  await service.from("cash_cycles").delete().not("id", "is", null);
  const abos = Object.values(abo);
  if (abos.length > 0) {
    await service.from("cash_payments").delete().in("subscription_id", abos);
    await service.from("cash_entries").delete().in("subscription_id", abos);
    await service.from("subscriptions").delete().in("id", abos);
  }
  if (kursId) {
    await service.from("course_teachers").delete().eq("course_id", kursId);
    await service.from("courses").delete().eq("id", kursId);
  }
  for (const id of konten) await service.auth.admin.deleteUser(id).catch(() => {});
});

describe("PROJ-98: Die eine Regel beim Abschließen", () => {
  it("nimmt nur den von der Liste, der bis zum Enddatum voll bezahlt hat", async () => {
    await lageHerstellen();

    const { data, error } = await abschliessen(ENDE);
    expect(error, `Abschließen scheiterte: ${error?.message}`).toBeNull();

    const ergebnis = (data ?? [])[0] as Record<string, unknown>;
    expect(Number(ergebnis.abgeschrieben)).toBe(4);
    expect(Number(ergebnis.entfernt)).toBe(1);
    expect(Number(ergebnis.geblieben)).toBe(3);

    const aufDerListe = await eintraegeAufDerListe();
    expect(aufDerListe).not.toContain(abo.voll);
    // Der Anlass der ganzen Änderung: Wer nach dem Enddatum gezahlt hat, muss
    // stehen bleiben. Vorher wurde sein Eintrag mitgelöscht, und auf der neuen
    // Liste stand er wieder als offen.
    expect(aufDerListe).toContain(abo.spaet);
    expect(aufDerListe).toContain(abo.teil);
    expect(aufDerListe).toContain(abo.nichts);
  });

  it("rechnet die Zahlung nach dem Enddatum dem neuen Zyklus zu", async () => {
    await lageHerstellen();
    await abschliessen(ENDE);

    const zeile = zeileVon(await kursliste(), "spaet");
    expect(zeile, "Der späte Zahler fehlt in der Kursliste").toBeDefined();
    // Sein Geld zählt für den laufenden Zyklus — er steht sofort als bezahlt da
    // und muss nicht neu eingetragen werden.
    expect(Number(zeile!.bezahlt)).toBe(91);
    expect(Number(zeile!.amount_due)).toBe(91);
  });

  it("lässt die Zahlung vor dem Enddatum nicht in den neuen Zyklus durch", async () => {
    await lageHerstellen();
    await abschliessen(ENDE);

    const zeile = zeileVon(await kursliste(), "teil");
    // Das ist die zweite Hälfte derselben Änderung: Die 40 € von damals gehören
    // zum abgeschlossenen Zyklus. Würden sie hier mitzählen, stünde die Zeile
    // mit dem Geld von letztem Monat da und niemand sammelte etwas ein.
    expect(Number(zeile!.bezahlt)).toBe(0);
    expect(Number(zeile!.rest_vorher)).toBe(53);
    expect(zeile!.vorher_bis).toBe(ENDE);
  });

  it("nennt den offenen Rest aus dem vorigen Zyklus, ohne ihn in den Betrag zu rechnen", async () => {
    await lageHerstellen();
    await abschliessen(ENDE);

    const zeilen = await kursliste();
    const nichts = zeileVon(zeilen, "nichts");
    expect(Number(nichts!.amount_due)).toBe(95);
    expect(Number(nichts!.rest_vorher)).toBe(95);

    // Der dokumentierte Preis (Edge Case 1): Wer nach dem Enddatum zahlt, wird
    // dem neuen Zyklus zugerechnet — im alten bleibt sein Betrag offen stehen.
    // Der Abschluss-Dialog nennt diese Zahlungen vorher mit Namen und Tag.
    const spaet = zeileVon(zeilen, "spaet");
    expect(Number(spaet!.rest_vorher)).toBe(91);

    const voll = zeileVon(zeilen, "voll");
    expect(voll, "Der voll bezahlte Eintrag steht noch auf der Liste").toBeUndefined();
  });

  it("nimmt nach dem Abschluss wieder den ganzen Betrag an", async () => {
    await lageHerstellen();
    await abschliessen(ENDE);

    // Vor PROJ-98 hätte die Datenbank hier 53 € verbucht — den Rest nach den
    // 40 € aus dem alten Zyklus. Oder bei einem voll bezahlten Eintrag
    // „nothing open" gemeldet.
    const { data, error } = await alsAdmin.rpc("record_cash_payment", {
      p_entry_id: (await service
        .from("cash_entries")
        .select("id")
        .eq("subscription_id", abo.teil)
        .single()).data!.id,
      p_amount: null,
    });
    expect(error, `Erfassen scheiterte: ${error?.message}`).toBeNull();
    expect(Number((data as Record<string, unknown>).amount)).toBe(93);
  });
});

describe("PROJ-98: Welches Enddatum erlaubt ist", () => {
  it("weist ein Datum in der Zukunft ab", async () => {
    await lageHerstellen();
    const { error } = await abschliessen(tag(1));
    expect(error?.message, "Ein Zyklus in der Zukunft ließ sich abschließen").toContain(
      "end date in future"
    );
  });

  it("weist ein Datum vor dem Anfang des laufenden Zyklus ab", async () => {
    await lageHerstellen();
    await abschliessen(ENDE);
    // Der laufende Zyklus beginnt am Tag nach dem Abschluss. Ein Enddatum
    // davor würde zwei Zyklen überlappen lassen.
    const { error } = await abschliessen(T5);
    expect(error?.message).toContain("end date before cycle start");
  });

  it("beginnt den ersten Zyklus am Tag der ältesten Zahlung auf der Liste", async () => {
    await lageHerstellen();
    await abschliessen(ENDE);

    const [zyklus] = await zyklen();
    expect(zyklus.starts_on).toBe(T5);
    expect(zyklus.ends_on).toBe(ENDE);
  });

  it("nimmt ohne jede Zahlung das Enddatum als Anfang", async () => {
    await leereAlles();
    await eintragAnlegen("nichts", 95);
    await abschliessen(ENDE);

    const [zyklus] = await zyklen();
    expect(zyklus.starts_on).toBe(ENDE);
  });

  it("lässt sich auch mit leerer Liste abschließen", async () => {
    // Erlaubt: Ein Zyklus ohne Einträge ist eine Aussage über den Zeitraum und
    // kein Fehler.
    await leereAlles();
    const { data, error } = await abschliessen(ENDE);
    expect(error, `Abschließen scheiterte: ${error?.message}`).toBeNull();
    expect(Number((data ?? [])[0]!.abgeschrieben)).toBe(0);
    expect(await zyklen()).toHaveLength(1);
  });
});

describe("PROJ-98: Das Archiv", () => {
  it("hält je Eintrag fest, was geschuldet und was in diesem Zyklus gezahlt wurde", async () => {
    await lageHerstellen();
    await abschliessen(ENDE);

    const zeilen = await archiv();
    expect(zeilen).toHaveLength(4);

    const voll = zeilen.find((z) => z.subscription_id === abo.voll)!;
    expect(Number(voll.amount_due)).toBe(89);
    expect(Number(voll.gezahlt)).toBe(89);

    const teil = zeilen.find((z) => z.subscription_id === abo.teil)!;
    expect(Number(teil.gezahlt)).toBe(40);

    // Die Zahlung vom Tag danach gehört nicht in diesen Zeitraum.
    const spaet = zeilen.find((z) => z.subscription_id === abo.spaet)!;
    expect(Number(spaet.gezahlt)).toBe(0);
  });

  it("nennt am Zyklus Zahl der Einträge, eingesammelt und offen geblieben", async () => {
    await lageHerstellen();
    await abschliessen(ENDE);

    const [zyklus] = await zyklen();
    expect(Number(zyklus.eintraege)).toBe(4);
    expect(Number(zyklus.geschuldet)).toBe(368);
    expect(Number(zyklus.eingesammelt)).toBe(129);
    expect(Number(zyklus.offen)).toBe(239);
  });

  it("behält den Betrag, der beim Abschließen galt", async () => {
    const ids = await lageHerstellen();
    await abschliessen(ENDE);

    const { error } = await alsAdmin.rpc("update_cash_entry", {
      p_entry_id: ids.teil,
      p_amount: 150,
    });
    expect(error, `Ändern scheiterte: ${error?.message}`).toBeNull();

    const zeile = (await archiv()).find((z) => z.subscription_id === abo.teil)!;
    expect(Number(zeile.amount_due), "Das Archiv ist mitgewandert").toBe(93);
  });

  it("zeigt eine zurückgenommene Zahlung auch im Archiv", async () => {
    const ids = await lageHerstellen();
    await abschliessen(ENDE);

    await service.from("cash_payments").delete().eq("entry_id", ids.teil);

    const zeile = (await archiv()).find((z) => z.subscription_id === abo.teil)!;
    // Nur der **geschuldete** Betrag ist eingefroren. Das Gezahlte wird
    // gerechnet, damit eine Korrektur nicht am Nachweis vorbeiläuft.
    expect(Number(zeile.gezahlt)).toBe(0);
  });

  it("findet dieselbe Abschrift über den Kunden", async () => {
    await lageHerstellen();
    await abschliessen(ENDE);

    const zeilen = await archiv(alsAdmin, kunde.teil);
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0].subscription_id).toBe(abo.teil);
    expect(Number(zeilen[0].gezahlt)).toBe(40);
  });

  it("gibt für jemanden ohne Barzahlung nichts zurück", async () => {
    await lageHerstellen();
    await abschliessen(ENDE);

    const { data: fremder } = await service
      .from("profiles")
      .select("id")
      .eq("full_name", "E2E13 Lehrer A")
      .single();
    expect(await archiv(alsAdmin, fremder!.id)).toHaveLength(0);
  });
});

describe("PROJ-98: Die Vorschau", () => {
  it("sagt, wer geht und wer bleibt — und ändert nichts", async () => {
    await lageHerstellen();

    const { data, error } = await alsAdmin.rpc("get_cash_cycle_preview", { p_ends_on: ENDE });
    expect(error, `Vorschau scheiterte: ${error?.message}`).toBeNull();

    const zeilen = (data ?? []) as Record<string, unknown>[];
    expect(zeilen.filter((z) => z.geht === true)).toHaveLength(1);
    expect(zeilen.filter((z) => z.geht === false)).toHaveLength(3);

    // Der Preis aus Edge Case 1, vor dem Druck benannt.
    const spaet = zeilen.find((z) => z.subscription_id === abo.spaet)!;
    expect(Number(spaet.spaet_betrag)).toBe(91);
    expect(spaet.spaet_tag).toBe(T1);

    expect(await zyklen(), "Die Vorschau hat abgeschlossen").toHaveLength(0);
    expect(await eintraegeAufDerListe()).toHaveLength(4);
  });
});

describe("PROJ-98: Zurücknehmen", () => {
  it("stellt die Liste wieder her und räumt den Zyklus weg", async () => {
    const ids = await lageHerstellen();
    await abschliessen(ENDE);
    // Ein Betrag, der nach dem Abschluss geändert wurde, gehört zum neuen
    // Zyklus — gibt es den nicht mehr, steht wieder der alte da.
    await alsAdmin.rpc("update_cash_entry", { p_entry_id: ids.teil, p_amount: 150 });

    const { data, error } = await alsAdmin.rpc("undo_cash_cycle");
    expect(error, `Zurücknehmen scheiterte: ${error?.message}`).toBeNull();
    expect(Number(data)).toBe(4);

    expect(await zyklen()).toHaveLength(0);
    expect(await eintraegeAufDerListe()).toHaveLength(4);

    const { data: teil } = await service
      .from("cash_entries")
      .select("amount_due")
      .eq("subscription_id", abo.teil)
      .single();
    expect(Number(teil!.amount_due)).toBe(93);
  });

  it("weist ab, sobald seither kassiert wurde", async () => {
    const ids = await lageHerstellen();
    await abschliessen(ENDE);
    await zahlungAnlegen("nichts", ids.nichts, 11, tag(0));

    const { error } = await alsAdmin.rpc("undo_cash_cycle");
    expect(error?.message).toContain("payment since close");
    expect(await zyklen(), "Der Zyklus ist trotzdem verschwunden").toHaveLength(1);
  });

  it("weist ab, sobald seither ein Eintrag angelegt wurde", async () => {
    await lageHerstellen();
    await abschliessen(ENDE);
    // Nicht Vorsicht, sondern Notwendigkeit: `cash_entries` lässt je Abo nur
    // eine Zeile zu, und die wiederhergestellte träfe auf diese.
    await eintragAnlegen("voll", 89);

    const { error } = await alsAdmin.rpc("undo_cash_cycle");
    expect(error?.message).toContain("entry since close");
  });

  it("betrifft nur den jüngsten Zyklus", async () => {
    await lageHerstellen();
    await abschliessen(tag(-4));
    await abschliessen(tag(-2));
    expect(await zyklen()).toHaveLength(2);

    const { error } = await alsAdmin.rpc("undo_cash_cycle");
    expect(error, `Zurücknehmen scheiterte: ${error?.message}`).toBeNull();

    const uebrig = await zyklen();
    expect(uebrig).toHaveLength(1);
    expect(uebrig[0].ends_on).toBe(tag(-4));
  });
});

describe("PROJ-98: Wer darf was", () => {
  it("lässt eine Lehrkraft nicht abschließen und nicht zurücknehmen", async () => {
    await lageHerstellen();

    const { error: abschluss } = await abschliessen(ENDE, alsLehrer);
    expect(abschluss?.message, "Eine Lehrkraft konnte abschließen").toContain("not authorized");

    await abschliessen(ENDE);
    const { error: zurueck } = await alsLehrer.rpc("undo_cash_cycle");
    expect(zurueck?.message, "Eine Lehrkraft konnte zurücknehmen").toContain("not authorized");
  });

  it("lässt eine Lehrkraft das Archiv nicht lesen", async () => {
    // Sie braucht es nicht: Was sie am Kursabend wissen muss, steht an ihren
    // eigenen Zeilen (`rest_vorher`). Das Archiv enthält die Listen aller Kurse.
    const { error: zyklenFehler } = await alsLehrer.rpc("get_cash_cycles");
    expect(zyklenFehler?.message).toContain("not authorized");

    const { error: archivFehler } = await alsLehrer.rpc("get_cash_archive_entries", {
      p_customer_id: null,
    });
    expect(archivFehler?.message).toContain("not authorized");

    const { error: vorschauFehler } = await alsLehrer.rpc("get_cash_cycle_preview", {
      p_ends_on: ENDE,
    });
    expect(vorschauFehler?.message).toContain("not authorized");
  });

  it("gibt einem Kunden höchstens seine eigenen Archivzeilen", async () => {
    await lageHerstellen();
    await abschliessen(ENDE);

    // Über die Funktion gar nichts — sie ist der Verwaltung vorbehalten.
    const { error } = await alsKunde.rpc("get_cash_archive_entries", { p_customer_id: null });
    expect(error?.message).toContain("not authorized");

    // Und über die Tabelle nur die eigene Zeile. „voll" ist dieser Kunde.
    const { data } = await alsKunde.from("cash_cycle_entries").select("subscription_id");
    expect((data ?? []).map((z) => z.subscription_id)).toEqual([abo.voll]);
  });

  it("weist nicht Angemeldete ab", async () => {
    const anonym = createClient(URL, ANON, { auth: { persistSession: false } });

    const { error: abschluss } = await anonym.rpc("close_cash_cycle", { p_ends_on: ENDE });
    expect(abschluss, "Ohne Anmeldung ließ sich abschließen").not.toBeNull();

    const { error: zurueck } = await anonym.rpc("undo_cash_cycle");
    expect(zurueck, "Ohne Anmeldung ließ sich zurücknehmen").not.toBeNull();

    const { error: lesen } = await anonym.rpc("get_cash_cycles");
    expect(lesen, "Ohne Anmeldung war das Archiv lesbar").not.toBeNull();

    const { data } = await anonym.from("cash_cycles").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
