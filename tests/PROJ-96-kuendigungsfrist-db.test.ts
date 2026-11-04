import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";
import { ferientageZwischen, naechsteFaelligkeit } from "@/lib/sepa/faelligkeit";
import type { Ferienzeitraum } from "@/lib/scheduling/dates";

/**
 * PROJ-96: Die Kündigungsfrist und das Fenster, aus dem sie kommt.
 *
 * Zwei Dinge werden hier geprüft, und das zweite ist das wichtigere:
 *
 * 1. **Die Regel.** Zyklusschluss nach Unterrichtswochen, Frist am letzten
 *    Sonntag davor, danach wirkt es einen Zyklus später.
 *
 * 2. **Die Parität.** Dieselbe Rechnung steht nach PROJ-96 zweimal im Projekt:
 *    in SQL für die Kündigung, in TypeScript für den Einzug
 *    (`src/lib/sepa/faelligkeit.ts`). Der Einzug bewegt Geld und wurde
 *    absichtlich nicht angefasst. Was beide zusammenhält, ist dieser Test: Er
 *    gibt beiden Fassungen dieselben Eingaben und vergleicht die Antworten.
 *    Wer eine ändert und die andere vergisst, bekommt hier Rot — und nicht
 *    eine Kündigung, die zwei Tage neben dem Einzug liegt.
 *
 * Angemeldet als **Kunde**, nicht mit dem Dienstschlüssel: `security definer`
 * prüft selbst, wer fragt. Mit dem Dienstschlüssel geprüft wäre der Rechteteil
 * nie geprüft. Dieselbe Lehre wie bei PROJ-94 (docs/troubleshooting-tests.md).
 *
 * Braucht die Migration 20261104160000_proj96_kuendigungsfrist.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";

const marke = Date.now();
const KUNDE = `proj96-kunde-${marke}@viennasalsastudio.test`;
const FREMDER = `proj96-fremder-${marke}@viennasalsastudio.test`;

let service: SupabaseClient;
let alsKunde: SupabaseClient;

/** Der Wiener Kalendertag, wie die Datenbank ihn sieht — nicht der des Rechners. */
let heute = "";

/** Zum Durchspielen aller Wochentagslagen und zum Kündigen. */
let aboLagen = "";
/** Zum Pausieren — ein zweites Abo, weil eine Pause das erste belegt. */
let aboPause = "";
/** Für den Ferienfall: Anker weit in der Zukunft, Ferien im Fenster. */
let aboFerien = "";
/** Das Abo eines anderen Kunden. */
let aboFremd = "";

/** Der Ferienzeitraum, den dieser Test anlegt — weit weg vom Unterricht. */
let ferienVon = "";
let ferienBis = "";

const konten: string[] = [];
const abos: string[] = [];
const ferienIds: string[] = [];

const TAG_MS = 86_400_000;

function tagePlus(datum: string, tage: number): string {
  return new Date(Date.parse(`${datum}T00:00:00Z`) + tage * TAG_MS).toISOString().slice(0, 10);
}

/** Der letzte Sonntag auf oder vor diesem Tag. */
function letzterSonntag(datum: string): string {
  const wochentag = new Date(`${datum}T00:00:00Z`).getUTCDay(); // 0 = Sonntag
  return tagePlus(datum, -wochentag);
}

async function konto(email: string): Promise<string> {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-96 Konto: ${error?.message}`);
  konten.push(data.user.id);
  return data.user.id;
}

async function abo(kundeId: string, anker: string, name: string): Promise<string> {
  const { data, error } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: null,
      status: "active",
      name,
      price: 79,
      cycle_anchor_date: anker,
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-96 Abo: ${error.message}`);
  abos.push(data!.id);
  return data!.id;
}

type Fenster = {
  zyklusschluss: string;
  frist: string;
  wirksam_zum: string;
  frist_abgelaufen: boolean;
};

async function fenster(client: SupabaseClient, aboId: string): Promise<Fenster> {
  const { data, error } = await client.rpc("abo_kuendigungsfenster", {
    p_subscription_id: aboId,
  });
  if (error) throw new Error(`PROJ-96 Fenster: ${error.message}`);
  const zeilen = (data ?? []) as Fenster[];
  if (zeilen.length !== 1) throw new Error(`PROJ-96 Fenster: ${zeilen.length} Zeilen statt 1`);
  return zeilen[0];
}

/** Die Ferien, wie sie **jetzt** in der Datenbank stehen. */
async function ferien(): Promise<Ferienzeitraum[]> {
  const { data, error } = await service.from("studio_holidays").select("starts_on, ends_on");
  if (error) throw new Error(`PROJ-96 Ferien: ${error.message}`);
  return (data ?? []).map((f) => ({ von: f.starts_on, bis: f.ends_on }));
}

async function ankerSetzen(aboId: string, anker: string): Promise<void> {
  const { error } = await service
    .from("subscriptions")
    .update({ cycle_anchor_date: anker })
    .eq("id", aboId);
  if (error) throw new Error(`PROJ-96 Anker: ${error.message}`);
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data: tag, error: tagFehler } = await service.rpc("heute_wien");
  if (tagFehler || !tag) throw new Error(`PROJ-96 heute_wien: ${tagFehler?.message}`);
  heute = String(tag);

  // Ferien weit in der Zukunft: Ein Ferienzeitraum ist studioweit und würde
  // sonst Kurstermine anderer Prüfungen ausfallen lassen. In zehn Monaten
  // stört er niemanden — und für die Rechnung ist es derselbe Fall.
  ferienVon = tagePlus(heute, 280);
  ferienBis = tagePlus(heute, 286);
  const { data: f, error: fFehler } = await service
    .from("studio_holidays")
    .insert({ name: `E2E96 Ferien ${marke}`, starts_on: ferienVon, ends_on: ferienBis })
    .select("id")
    .single();
  if (fFehler) throw new Error(`PROJ-96 Ferien anlegen: ${fFehler.message}`);
  ferienIds.push(f!.id);

  const kundeId = await konto(KUNDE);
  const fremderId = await konto(FREMDER);

  // Anker so, dass der Zyklusschluss in der Zukunft liegt; die genaue Lage
  // setzt jede Prüfung selbst.
  aboLagen = await abo(kundeId, tagePlus(heute, -14), `E2E96 Lagen ${marke}`);
  aboPause = await abo(kundeId, tagePlus(heute, -14), `E2E96 Pause ${marke}`);
  // Anker acht Tage vor den Ferien: Vier Wochen darauf liegt der Schluss
  // hinter dem Ferienzeitraum, die Ferientage fallen also ins Fenster.
  aboFerien = await abo(kundeId, tagePlus(heute, 272), `E2E96 Ferien ${marke}`);
  aboFremd = await abo(fremderId, tagePlus(heute, -14), `E2E96 Fremd ${marke}`);

  alsKunde = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
});

afterAll(async () => {
  for (const id of abos) await service.from("subscriptions").delete().eq("id", id);
  for (const id of ferienIds) await service.from("studio_holidays").delete().eq("id", id);
  for (const id of konten) await service.auth.admin.deleteUser(id);
});

describe("PROJ-96: Die Rechnung steht in SQL und in TypeScript gleich da", () => {
  it("zählt dieselben Ferientage wie ferientageZwischen", async () => {
    const liste = await ferien();
    const faelle: [string, string][] = [
      [tagePlus(heute, 270), tagePlus(heute, 300)], // Ferien mitten im Fenster
      [ferienVon, ferienBis], // genau der Zeitraum
      [tagePlus(heute, 286), tagePlus(heute, 300)], // Start am letzten Ferientag
      [tagePlus(heute, 300), tagePlus(heute, 290)], // verkehrte Reihenfolge
      [heute, tagePlus(heute, 28)], // der normale Fall
    ];

    for (const [von, bis] of faelle) {
      const { data, error } = await service.rpc("ferientage_zwischen", { p_von: von, p_bis: bis });
      if (error) throw new Error(`PROJ-96 ferientage_zwischen: ${error.message}`);
      expect(Number(data), `${von} bis ${bis}`).toBe(ferientageZwischen(von, bis, liste));
    }
  });

  it("rechnet denselben Zyklusschluss wie naechsteFaelligkeit", async () => {
    const liste = await ferien();
    const starts = [
      heute,
      tagePlus(heute, 272), // Ferien im Fenster
      tagePlus(heute, 279), // Ferien beginnen am Tag darauf
      tagePlus(heute, 286), // Ferien liegen hinter dem Start
      tagePlus(heute, -200),
    ];

    for (const start of starts) {
      const { data, error } = await service.rpc("naechste_faelligkeit", { p_letzter: start });
      if (error) throw new Error(`PROJ-96 naechste_faelligkeit: ${error.message}`);
      expect(String(data), start).toBe(naechsteFaelligkeit(start, liste));
    }
  });
});

describe("PROJ-96: Die Frist ist der letzte Sonntag vor dem Zyklusschluss", () => {
  it("stimmt in jeder Wochentagslage — alle 28 Tage durchgespielt", async () => {
    const liste = await ferien();

    for (let versatz = 0; versatz < 28; versatz++) {
      const anker = tagePlus(heute, versatz - 28);
      await ankerSetzen(aboLagen, anker);

      const erwarteterSchluss = naechsteFaelligkeit(anker, liste);
      const erwarteteFrist = letzterSonntag(erwarteterSchluss);
      const abgelaufen = heute > erwarteteFrist;
      const erwartetWirksam = abgelaufen
        ? naechsteFaelligkeit(erwarteterSchluss, liste)
        : erwarteterSchluss;

      const f = await fenster(alsKunde, aboLagen);
      expect(f.zyklusschluss, `Anker ${anker}`).toBe(erwarteterSchluss);
      expect(f.frist, `Anker ${anker}`).toBe(erwarteteFrist);
      expect(f.frist_abgelaufen, `Anker ${anker}`).toBe(abgelaufen);
      expect(f.wirksam_zum, `Anker ${anker}`).toBe(erwartetWirksam);
    }
  });

  it("nennt den Zyklusschluss selbst als Frist, wenn er auf einen Sonntag fällt", async () => {
    const liste = await ferien();
    // Einen Anker suchen, dessen Zyklusschluss ein Sonntag ist.
    let anker = "";
    for (let versatz = 0; versatz < 28; versatz++) {
      const kandidat = tagePlus(heute, versatz - 28);
      const schluss = naechsteFaelligkeit(kandidat, liste);
      if (new Date(`${schluss}T00:00:00Z`).getUTCDay() === 0) {
        anker = kandidat;
        break;
      }
    }
    expect(anker, "kein Anker mit Sonntags-Schluss gefunden").not.toBe("");

    await ankerSetzen(aboLagen, anker);
    const f = await fenster(alsKunde, aboLagen);
    expect(f.frist).toBe(f.zyklusschluss);
  });

  it("verschiebt Schluss und Frist um die Ferientage", async () => {
    const liste = await ferien();
    const anker = tagePlus(heute, 272);

    const ohneFerien = tagePlus(anker, 28);
    const mitFerien = naechsteFaelligkeit(anker, liste);
    // Sieben Ferientage liegen im Fenster — sonst prüft dieser Fall nichts.
    expect(mitFerien).toBe(tagePlus(ohneFerien, 7));

    const f = await fenster(alsKunde, aboFerien);
    expect(f.zyklusschluss).toBe(mitFerien);
    expect(f.frist).toBe(letzterSonntag(mitFerien));
  });
});

describe("PROJ-96: Woher der Zyklus gerechnet wird", () => {
  it("rechnet vom Anker, solange es keinen Einzug gibt", async () => {
    const liste = await ferien();
    const anker = tagePlus(heute, -7);
    await ankerSetzen(aboLagen, anker);

    const f = await fenster(alsKunde, aboLagen);
    expect(f.zyklusschluss).toBe(naechsteFaelligkeit(anker, liste));
  });

  it("rechnet vom letzten Einzug, sobald es einen gibt — auch aus einem Entwurf", async () => {
    const liste = await ferien();
    const anker = tagePlus(heute, -27);
    await ankerSetzen(aboLagen, anker);

    // Ein Lauf, der **nicht** freigegeben ist: Entwürfe zählen mit, sonst
    // wären zwei offene Entwürfe zum selben Zyklus zwei Abbuchungen.
    const einzug = tagePlus(heute, -3);
    const { data: lauf, error: laufFehler } = await service
      .from("sepa_collection_runs")
      .insert({ due_date: einzug })
      .select("id")
      .single();
    if (laufFehler) throw new Error(`PROJ-96 Lauf: ${laufFehler.message}`);

    const { data: kunde } = await service
      .from("subscriptions")
      .select("customer_id")
      .eq("id", aboLagen)
      .single();

    const { error: postenFehler } = await service.from("sepa_collection_items").insert({
      run_id: lauf!.id,
      subscription_id: aboLagen,
      customer_id: kunde!.customer_id,
      amount: 79,
      iban: "AT611904300234573201",
      account_holder_name: "E2E96 Kunde",
      mandate_reference: `E2E96-${marke}`,
    });
    if (postenFehler) throw new Error(`PROJ-96 Posten: ${postenFehler.message}`);

    try {
      const f = await fenster(alsKunde, aboLagen);
      // Vom Einzug gerechnet, nicht vom Anker — die beiden liegen hier 24 Tage
      // auseinander, ein Irrtum wäre also nicht zu übersehen.
      expect(f.zyklusschluss).toBe(naechsteFaelligkeit(einzug, liste));
      expect(f.zyklusschluss).not.toBe(naechsteFaelligkeit(anker, liste));
    } finally {
      await service.from("sepa_collection_items").delete().eq("run_id", lauf!.id);
      await service.from("sepa_collection_runs").delete().eq("id", lauf!.id);
    }
  });
});

describe("PROJ-96: Kündigen und Pausieren nehmen dieses Datum", () => {
  it("setzt bei der Kündigung das Datum aus dem Fenster", async () => {
    await ankerSetzen(aboLagen, tagePlus(heute, -14));
    const f = await fenster(alsKunde, aboLagen);

    const { error } = await alsKunde.rpc("self_schedule_subscription_change", {
      p_subscription_id: aboLagen,
      p_new_pending_status: "cancelled",
      p_cancellation_reason: "keine_zeit",
      p_cancellation_note: null,
    });
    expect(error).toBeNull();

    const { data } = await service
      .from("subscriptions")
      .select("pending_status, pending_effective_date")
      .eq("id", aboLagen)
      .single();
    expect(data!.pending_status).toBe("cancelled");
    expect(data!.pending_effective_date).toBe(f.wirksam_zum);
  });

  it("setzt bei der Pause dasselbe Datum — die Frist gilt für beides", async () => {
    await ankerSetzen(aboPause, tagePlus(heute, -14));
    const f = await fenster(alsKunde, aboPause);

    const { error } = await alsKunde.rpc("self_schedule_subscription_change", {
      p_subscription_id: aboPause,
      p_new_pending_status: "paused",
    });
    expect(error).toBeNull();

    const { data } = await service
      .from("subscriptions")
      .select("pending_status, pending_effective_date")
      .eq("id", aboPause)
      .single();
    expect(data!.pending_status).toBe("paused");
    expect(data!.pending_effective_date).toBe(f.wirksam_zum);
  });
});

describe("PROJ-96: Das Fenster ist eine Auskunft über das eigene Abo", () => {
  it("weist die Frage nach einem fremden Abo ab", async () => {
    const { error } = await alsKunde.rpc("abo_kuendigungsfenster", {
      p_subscription_id: aboFremd,
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toContain("not authorized");
  });

  it("weist die Frage nach einem Abo ab, das es nicht gibt", async () => {
    const { error } = await alsKunde.rpc("abo_kuendigungsfenster", {
      p_subscription_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toContain("subscription not found");
  });
});
