import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ladeTestUmgebung } from "./env";
import { angemeldetAls } from "./anmeldung";
import { fuehreStudentenpreisLaufDurch } from "@/lib/subscriptions/studentenpreis";

ladeTestUmgebung();

/**
 * PROJ-102: Der Studierendenpreis endet mit 28 — angekuendigt, nicht
 * ueberraschend.
 *
 * Geprueft wird der ganze Weg: ankuendigen, die Nachricht einreihen, am
 * Stichtag umstellen — und die drei Faelle, in denen bewusst **nichts**
 * passiert (gekuendigt, pausiert, von Hand geaenderter Preis).
 *
 * **Der Lauf ist globaler Zustand.** Er sieht jedes Studierendenabo der
 * Testdatenbank, auch die aus anderen Dateien und die, die die Migration aus
 * alten Anfragen abgeleitet hat. Deshalb behauptet dieser Test nie eine
 * Gesamtzahl, sondern prueft seine eigenen Zeilen — und raeumt am Ende jede
 * Ankuendigung weg, damit kein anderer Test einen Preishinweis vorfindet, den
 * er nicht erwartet.
 *
 * Braucht die Migrationen 20261116100000_proj101_... und
 * 20261116120000_proj102_studentenpreis_endet.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";
const ADMIN = "e2e8-admin@viennasalsastudio.test";

const stempel = Date.now();

let service: SupabaseClient<Database>;
let alsAdmin: SupabaseClient;

let kursId = "";
const konten: Record<string, string> = {};
const abos: Record<string, string> = {};

/** Preise aus der Testdatenbank — nicht eingetippt. */
let kursNormal = 0;
let kursStudent = 0;

function datum(versatzTage: number): string {
  const heute = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Vienna" }));
  heute.setDate(heute.getDate() + versatzTage);
  const m = String(heute.getMonth() + 1).padStart(2, "0");
  const t = String(heute.getDate()).padStart(2, "0");
  return `${heute.getFullYear()}-${m}-${t}`;
}

/** Ein Geburtsdatum, mit dem der Kunde am Stichtag genau `alter` Jahre alt ist. */
function geburtstagFuer(alter: number, stichtag: string): string {
  const [jahr, rest] = [Number(stichtag.slice(0, 4)), stichtag.slice(4)];
  return `${jahr - alter}${rest}`;
}

async function kontoAnlegen(kennung: string, geburtsdatum: string | null): Promise<string> {
  const mail = `proj102-${kennung}-${stempel}@viennasalsastudio.test`;
  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-102 Konto ${kennung}: ${error?.message}`);
  await service
    .from("profiles")
    .update({ full_name: `E2E102 ${kennung} ${stempel}`, birthdate: geburtsdatum })
    .eq("id", data.user.id);
  return data.user.id;
}

async function aboAnlegen(kundeId: string, opt: { preis: number; student: boolean; anker: string }) {
  const { data, error } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: kursId,
      status: "active",
      name: `E2E102 Kursabo ${stempel}`,
      price: opt.preis,
      student_price: opt.student,
      cycle_anchor_date: opt.anker,
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-102 Abo: ${error.message}`);
  return data!.id;
}

async function lies(aboId: string) {
  const { data, error } = await service
    .from("subscriptions")
    .select("price, status, pending_status, pending_price, pending_price_old, pending_price_date, price_notice_sent_at")
    .eq("id", aboId)
    .single();
  if (error) throw new Error(`PROJ-102 lesen: ${error.message}`);
  return data!;
}

async function nachrichten(kundeId: string) {
  const { data, error } = await service
    .from("notification_queue")
    .select("id, payload")
    .eq("customer_id", kundeId)
    .eq("event_type", "studentenpreis_endet");
  if (error) throw new Error(`PROJ-102 Warteschlange: ${error.message}`);
  return data ?? [];
}

beforeAll(async () => {
  service = createClient<Database>(URL, SERVICE, { auth: { persistSession: false } });
  alsAdmin = await angemeldetAls(URL, ANON, ADMIN, PASSWORT);

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error } = await service
    .from("courses")
    .insert({ name: `E2E102 Preiskurs ${stempel}`, room_id: raum!.id, price: 85 })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-102 Kurs: ${error.message}`);
  kursId = kurs!.id;

  const { data: normal } = await alsAdmin.rpc("resolve_plan_price", {
    p_course_id: kursId,
    p_desired_plan: "single_course",
    p_wants_student_price: false,
  });
  const { data: student } = await alsAdmin.rpc("resolve_plan_price", {
    p_course_id: kursId,
    p_desired_plan: "single_course",
    p_wants_student_price: true,
  });
  kursNormal = Number(normal);
  kursStudent = Number(student);
  // Ohne Unterschied wuerde diese Datei nichts belegen.
  expect(kursStudent).toBeLessThan(kursNormal);

  // Der Stichtag, auf den alles zulaeuft: Anker heute heisst Zyklusende in 28
  // Tagen — genau der versprochene Vorlauf.
  const stichtag = datum(28);

  konten.wirdAlt = await kontoAnlegen("wirdalt", geburtstagFuer(28, stichtag));
  konten.jung = await kontoAnlegen("jung", geburtstagFuer(25, stichtag));
  konten.ohneDatum = await kontoAnlegen("ohnedatum", null);
  konten.handArbeit = await kontoAnlegen("handarbeit", geburtstagFuer(28, stichtag));
  konten.kuendigt = await kontoAnlegen("kuendigt", geburtstagFuer(28, stichtag));
}, 60000);

beforeEach(async () => {
  // Jede Pruefung beginnt mit frischen Abos: Der Lauf aendert Zeilen, und zwei
  // Pruefungen duerfen sich nicht ueber dieselbe Zeile unterhalten.
  for (const id of Object.values(abos)) {
    await service.from("subscriptions").delete().eq("id", id);
  }
  for (const id of Object.values(konten)) {
    await service.from("notification_queue").delete().eq("customer_id", id);
  }
  const anker = datum(0);
  abos.wirdAlt = await aboAnlegen(konten.wirdAlt, { preis: kursStudent, student: true, anker });
  abos.jung = await aboAnlegen(konten.jung, { preis: kursStudent, student: true, anker });
  abos.ohneDatum = await aboAnlegen(konten.ohneDatum, { preis: kursStudent, student: true, anker });
  abos.handArbeit = await aboAnlegen(konten.handArbeit, { preis: kursStudent, student: true, anker });
  abos.kuendigt = await aboAnlegen(konten.kuendigt, { preis: kursStudent, student: true, anker });
});

afterAll(async () => {
  for (const id of Object.values(abos)) {
    await service.from("subscriptions").delete().eq("id", id);
  }
  // Was der Lauf an **fremden** Zeilen angekuendigt hat, wird zurueckgenommen:
  // Sonst fände ein anderer Test an einem Fixture-Abo einen Preishinweis, den
  // er nicht erwartet.
  await service
    .from("subscriptions")
    .update({
      pending_price: null,
      pending_price_old: null,
      pending_price_date: null,
      price_notice_sent_at: null,
    })
    .not("pending_price_date", "is", null);
  await service.from("notification_queue").delete().eq("event_type", "studentenpreis_endet");
  if (kursId) {
    await service.from("course_memberships").delete().eq("course_id", kursId);
    await service.from("courses").delete().eq("id", kursId);
  }
  for (const id of Object.values(konten)) await service.auth.admin.deleteUser(id).catch(() => {});
});

describe("PROJ-102: Ankuendigen", () => {
  it("kuendigt die Umstellung einen vollen Zyklus vorher an", async () => {
    const ergebnis = await fuehreStudentenpreisLaufDurch(service);
    expect(ergebnis.angekuendigt).toBeGreaterThanOrEqual(1);

    const zeile = await lies(abos.wirdAlt);
    expect(zeile.pending_price_date).toBe(datum(28));
    expect(Number(zeile.pending_price)).toBe(kursNormal);
    expect(Number(zeile.pending_price_old)).toBe(kursStudent);
    expect(zeile.price_notice_sent_at).not.toBeNull();
    // Der Preis selbst aendert sich jetzt noch nicht.
    expect(Number(zeile.price)).toBe(kursStudent);
  });

  it("reiht genau eine Nachricht ein, mit allem, was der Text braucht", async () => {
    await fuehreStudentenpreisLaufDurch(service);

    const post = await nachrichten(konten.wirdAlt);
    expect(post).toHaveLength(1);
    const inhalt = post[0]!.payload as Record<string, unknown>;
    expect(Number(inhalt.alt)).toBe(kursStudent);
    expect(Number(inhalt.neu)).toBe(kursNormal);
    expect(inhalt.datum).toBe(datum(28));
  });

  it("verschickt bei einem zweiten Lauf am selben Tag nichts nach", async () => {
    await fuehreStudentenpreisLaufDurch(service);
    await fuehreStudentenpreisLaufDurch(service);
    expect(await nachrichten(konten.wirdAlt)).toHaveLength(1);
  });

  it("laesst einen 25-Jaehrigen in Ruhe", async () => {
    await fuehreStudentenpreisLaufDurch(service);
    const zeile = await lies(abos.jung);
    expect(zeile.pending_price_date).toBeNull();
    expect(await nachrichten(konten.jung)).toHaveLength(0);
  });

  it("ruehrt ein Abo ohne Geburtsdatum nicht an, zaehlt es aber", async () => {
    const ergebnis = await fuehreStudentenpreisLaufDurch(service);
    expect(ergebnis.ohneGeburtsdatum).toBeGreaterThanOrEqual(1);

    const zeile = await lies(abos.ohneDatum);
    expect(zeile.pending_price_date).toBeNull();
    expect(await nachrichten(konten.ohneDatum)).toHaveLength(0);
  });

  it("kuendigt nichts an, wenn es nichts zu erhoehen gibt", async () => {
    // Das Kennzeichen sagt "Studierendenpreis", der Preis ist aber schon der
    // normale — der Rettungsanker fuer einen ungenau abgeleiteten Bestand.
    await service.from("subscriptions").update({ price: kursNormal }).eq("id", abos.wirdAlt);
    await fuehreStudentenpreisLaufDurch(service);

    const zeile = await lies(abos.wirdAlt);
    expect(zeile.pending_price_date).toBeNull();
    expect(await nachrichten(konten.wirdAlt)).toHaveLength(0);
  });
});

describe("PROJ-102: Umstellen", () => {
  /** Die Ankuendigung auf heute vorziehen — der Stichtag ist erreicht. */
  async function stichtagIstHeute(aboId: string) {
    await service.from("subscriptions").update({ pending_price_date: datum(0) }).eq("id", aboId);
  }

  it("setzt am Stichtag den neuen Preis", async () => {
    await fuehreStudentenpreisLaufDurch(service);
    await stichtagIstHeute(abos.wirdAlt);

    const ergebnis = await fuehreStudentenpreisLaufDurch(service);
    expect(ergebnis.umgestellt).toBeGreaterThanOrEqual(1);

    const zeile = await lies(abos.wirdAlt);
    expect(Number(zeile.price)).toBe(kursNormal);
    expect(zeile.pending_price).toBeNull();
    expect(zeile.pending_price_date).toBeNull();
    expect(zeile.price_notice_sent_at).toBeNull();
  });

  it("laesst ein gekuendigtes Abo in Ruhe", async () => {
    await fuehreStudentenpreisLaufDurch(service);
    // Der Kunde hat nach der Ankuendigung gekuendigt: Die Kuendigung wirkt zum
    // Zyklusende — also genau an dem Tag, an dem der neue Preis beginnen
    // wuerde. Er darf ihn nie zahlen.
    await service
      .from("subscriptions")
      .update({ pending_status: "cancelled", pending_effective_date: datum(28) })
      .eq("id", abos.kuendigt);
    await stichtagIstHeute(abos.kuendigt);

    await fuehreStudentenpreisLaufDurch(service);
    const zeile = await lies(abos.kuendigt);
    expect(Number(zeile.price)).toBe(kursStudent);
    expect(zeile.pending_price_date).toBeNull();
  });

  it("laesst ein pausiertes Abo in Ruhe", async () => {
    await fuehreStudentenpreisLaufDurch(service);
    await service.from("subscriptions").update({ status: "paused" }).eq("id", abos.kuendigt);
    await stichtagIstHeute(abos.kuendigt);

    await fuehreStudentenpreisLaufDurch(service);
    expect(Number((await lies(abos.kuendigt)).price)).toBe(kursStudent);
  });

  it("ueberschreibt einen von Hand gesetzten Preis nicht", async () => {
    await fuehreStudentenpreisLaufDurch(service);
    // Die Verwaltung hat nach der Ankuendigung einen eigenen Betrag gesetzt.
    // Sonst waere jede Ausnahme 28 Tage spaeter wieder weg.
    const eigener = kursStudent + 5;
    await service.from("subscriptions").update({ price: eigener }).eq("id", abos.handArbeit);
    await stichtagIstHeute(abos.handArbeit);

    const ergebnis = await fuehreStudentenpreisLaufDurch(service);
    expect(ergebnis.uebersprungen).toBeGreaterThanOrEqual(1);

    const zeile = await lies(abos.handArbeit);
    expect(Number(zeile.price)).toBe(eigener);
    // Die Ankuendigung ist damit verbraucht, nicht liegengeblieben.
    expect(zeile.pending_price_date).toBeNull();
  });

  it("holt einen ausgefallenen Lauf nach", async () => {
    await fuehreStudentenpreisLaufDurch(service);
    // Der Stichtag lag gestern, der Lauf fiel aus.
    await service.from("subscriptions").update({ pending_price_date: datum(-1) }).eq("id", abos.wirdAlt);

    await fuehreStudentenpreisLaufDurch(service);
    expect(Number((await lies(abos.wirdAlt)).price)).toBe(kursNormal);
  });
});

describe("PROJ-102: Das Upgrade raeumt die Ankuendigung ab", () => {
  it("laesst nach einem Upgrade den Preis des Upgrades gelten", async () => {
    // Zwei Preisaenderungen fuer denselben Zyklus liessen sich niemandem
    // erklaeren. Der Preis des Upgrades gilt, die Ankuendigung verfaellt.
    await fuehreStudentenpreisLaufDurch(service);
    expect((await lies(abos.wirdAlt)).pending_price_date).toBe(datum(28));

    await service
      .from("subscriptions")
      .update({ upgrade_requested_at: new Date().toISOString() })
      .eq("id", abos.wirdAlt);
    const { error } = await alsAdmin.rpc("confirm_flatrate_upgrade", {
      p_subscription_id: abos.wirdAlt,
      p_student: false,
      p_differenz: 0,
    });
    expect(error).toBeNull();

    const zeile = await lies(abos.wirdAlt);
    expect(zeile.pending_price).toBeNull();
    expect(zeile.pending_price_date).toBeNull();
    expect(zeile.price_notice_sent_at).toBeNull();

    // Und am Stichtag passiert nichts mehr.
    await fuehreStudentenpreisLaufDurch(service);
    const { data: preise } = await service
      .from("dropin_pricing")
      .select("flatrate_price")
      .limit(1)
      .single();
    expect(Number((await lies(abos.wirdAlt)).price)).toBe(Number(preise!.flatrate_price));
  });
});

describe("PROJ-102: Die Studierenden-Flatrate", () => {
  it("wird genauso angekuendigt und umgestellt wie ein Kursabo", async () => {
    // Derselbe Rabatt, nur eine andere Stufe. Ohne diesen Fall waere nur das
    // Kursabo belegt — und die Flatrate ist die teurere Haelfte.
    const { data: preise } = await service
      .from("dropin_pricing")
      .select("flatrate_price, flatrate_student_price")
      .limit(1)
      .single();
    const flatNormal = Number(preise!.flatrate_price);
    const flatStudent = Number(preise!.flatrate_student_price);
    expect(flatStudent).toBeLessThan(flatNormal);

    const { data: abo, error } = await service
      .from("subscriptions")
      .insert({
        customer_id: konten.wirdAlt,
        status: "active",
        name: `E2E102 Flatrate Student ${stempel}`,
        price: flatStudent,
        student_price: true,
        cycle_anchor_date: datum(0),
      })
      .select("id")
      .single();
    if (error) throw new Error(`PROJ-102 Studierenden-Flatrate: ${error.message}`);

    await fuehreStudentenpreisLaufDurch(service);
    const angekuendigt = await lies(abo!.id);
    expect(angekuendigt.pending_price_date).toBe(datum(28));
    expect(Number(angekuendigt.pending_price)).toBe(flatNormal);

    await service.from("subscriptions").update({ pending_price_date: datum(0) }).eq("id", abo!.id);
    await fuehreStudentenpreisLaufDurch(service);
    expect(Number((await lies(abo!.id)).price)).toBe(flatNormal);

    await service.from("subscriptions").delete().eq("id", abo!.id);
  });
});

describe("PROJ-102: Der Normalpreis einer Stufe", () => {
  it("nennt fuer ein Kursabo den Kurspreis ohne Ermaessigung", async () => {
    const { data, error } = await alsAdmin.rpc("abo_normalpreis", {
      p_subscription_id: abos.wirdAlt,
    });
    expect(error).toBeNull();
    expect(Number(data)).toBe(kursNormal);
  });

  it("nennt fuer eine Flatrate den Flatrate-Preis", async () => {
    const { data: preise } = await service
      .from("dropin_pricing")
      .select("flatrate_price")
      .limit(1)
      .single();

    const { data: flat, error: flatFehler } = await service
      .from("subscriptions")
      .insert({
        customer_id: konten.jung,
        status: "active",
        name: `E2E102 Flatrate ${stempel}`,
        price: 1,
        cycle_anchor_date: datum(0),
      })
      .select("id")
      .single();
    if (flatFehler) throw new Error(`PROJ-102 Flatrate: ${flatFehler.message}`);

    const { data, error } = await alsAdmin.rpc("abo_normalpreis", { p_subscription_id: flat!.id });
    expect(error).toBeNull();
    expect(Number(data)).toBe(Number(preise!.flatrate_price));

    await service.from("subscriptions").delete().eq("id", flat!.id);
  });

  it("antwortet fuer ein unbekanntes Abo mit nichts, nicht mit null Euro", async () => {
    const { data, error } = await alsAdmin.rpc("abo_normalpreis", {
      p_subscription_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});
