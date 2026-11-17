import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-107 Stufe 2: Die Kündigung hängt am eingetragenen Zyklus.
 *
 * Bis hierher rechnete `abo_kuendigungsfenster` selbst — letzter Einzug plus
 * vier Unterrichtswochen, Frist am letzten Sonntag davor. Dieselbe Rechnung
 * stand damit zweimal im Projekt, und die Migration zu PROJ-96 warnte im
 * Kommentar selbst davor.
 *
 * Geprüft werden **beide** Wege, denn beide sind lebendiger Code:
 *
 * 1. **Mit Zyklus**: Das Ende kommt aus `billing_cycles`, wirksam ist der Tag
 *    danach, und eine eigene Frist gibt es nicht mehr.
 * 2. **Ohne Zyklus**: die Rechnung aus PROJ-96, unverändert. Sie deckt die
 *    Zeit vor dem 30.11.2026 und jede Lücke.
 *
 * Angemeldet als **Kunde**, nicht mit dem Dienstschlüssel: Die Funktion ist
 * `security definer` und prüft selbst, wer fragt. Mit dem Dienstschlüssel
 * geprüft wäre der Rechteteil nie geprüft (docs/troubleshooting-tests.md).
 *
 * Der Zyklus dieses Tests umfasst **heute** — er würde anderen Prüfungen unter
 * den Füßen liegen. Das ist hier sicher, weil `vitest.config.ts`
 * `fileParallelism: false` setzt und die Datenbanktests nacheinander laufen;
 * angelegt wird er erst in der Prüfung, die ihn braucht, und sofort wieder
 * entfernt.
 *
 * Braucht die Migration 20261117230000_proj107_kuendigung_am_zyklus.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";

const marke = Date.now();
const KUNDE = `proj107k-${marke}@viennasalsastudio.test`;

let service: SupabaseClient;
let alsKunde: SupabaseClient;
let heute = "";

const abos: string[] = [];
const konten: string[] = [];
const zyklen: string[] = [];

const TAG_MS = 86_400_000;

function tagePlus(datum: string, tage: number): string {
  return new Date(Date.parse(`${datum}T00:00:00Z`) + tage * TAG_MS).toISOString().slice(0, 10);
}

/** Der Wochentag nach ISO: Montag 1 bis Sonntag 7. */
function isoWochentag(datum: string): number {
  const tag = new Date(`${datum}T00:00:00Z`).getUTCDay();
  return tag === 0 ? 7 : tag;
}

type Fenster = {
  zyklusschluss: string;
  frist: string;
  wirksam_zum: string;
  frist_abgelaufen: boolean;
};

async function fenster(aboId: string): Promise<Fenster> {
  const { data, error } = await alsKunde.rpc("abo_kuendigungsfenster", {
    p_subscription_id: aboId,
  });
  if (error || !data?.[0]) throw new Error(`PROJ-107 Fenster: ${error?.message}`);
  return data[0] as Fenster;
}

async function legeZyklusAn(von: string, bis: string): Promise<string> {
  const { data, error } = await service
    .from("billing_cycles")
    .insert({ starts_on: von, ends_on: bis })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-107 Zyklus: ${error.message}`);
  zyklen.push(data!.id);
  return data!.id;
}

async function entferneZyklus(id: string) {
  const { error } = await service.from("billing_cycles").delete().eq("id", id);
  if (error) throw new Error(`PROJ-107 Zyklus löschen: ${error.message}`);
  const stelle = zyklen.indexOf(id);
  if (stelle >= 0) zyklen.splice(stelle, 1);
}

async function abo(kundeId: string, anker: string): Promise<string> {
  const { data, error } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      course_id: null,
      status: "active",
      name: `E2E107K ${marke}`,
      price: 60,
      cycle_anchor_date: anker,
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-107 Abo: ${error.message}`);
  abos.push(data!.id);
  return data!.id;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data: tag, error: tagFehler } = await service.rpc("heute_wien");
  if (tagFehler || !tag) throw new Error(`PROJ-107 heute_wien: ${tagFehler?.message}`);
  heute = String(tag);

  const { data: konto, error: kontoFehler } = await service.auth.admin.createUser({
    email: KUNDE,
    password: PASSWORT,
    email_confirm: true,
  });
  if (kontoFehler || !konto.user) throw new Error(`PROJ-107 Konto: ${kontoFehler?.message}`);
  konten.push(konto.user.id);

  alsKunde = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
});

afterAll(async () => {
  for (const id of abos) await service.from("subscriptions").delete().eq("id", id);
  for (const id of zyklen) await service.from("billing_cycles").delete().eq("id", id);
  for (const id of konten) await service.auth.admin.deleteUser(id);
});

describe("PROJ-107: Das Kündigungsfenster mit eingetragenem Zyklus", () => {
  it("nennt das Zyklusende und den Tag danach", async () => {
    const aboId = await abo(konten[0], tagePlus(heute, -14));
    const bis = tagePlus(heute, 6);
    const zyklus = await legeZyklusAn(heute, bis);
    try {
      const f = await fenster(aboId);
      expect(f.zyklusschluss).toBe(bis);
      // Wirksam ist der erste Tag, der nicht mehr bezahlt ist.
      expect(f.wirksam_zum).toBe(tagePlus(heute, 7));
      // Eine eigene Frist gibt es nicht mehr: „kündigen bis" ist das Zyklusende.
      expect(f.frist).toBe(bis);
      expect(f.frist_abgelaufen).toBe(false);
    } finally {
      await entferneZyklus(zyklus);
    }
  });

  it("gilt auch am letzten Tag des Zyklus — es gibt keine Frist mehr", async () => {
    const aboId = await abo(konten[0], tagePlus(heute, -14));
    // Der Zyklus endet heute: Unter der alten Regel wäre die Frist der letzte
    // Sonntag davor, und heute könnte sie abgelaufen sein.
    const zyklus = await legeZyklusAn(tagePlus(heute, -20), heute);
    try {
      const f = await fenster(aboId);
      expect(f.zyklusschluss).toBe(heute);
      expect(f.wirksam_zum).toBe(tagePlus(heute, 1));
      expect(f.frist_abgelaufen).toBe(false);
    } finally {
      await entferneZyklus(zyklus);
    }
  });

  it("schreibt beim Kündigen genau dieses Datum an das Abo", async () => {
    const aboId = await abo(konten[0], tagePlus(heute, -14));
    const bis = tagePlus(heute, 9);
    const zyklus = await legeZyklusAn(tagePlus(heute, -5), bis);
    try {
      const { error } = await alsKunde.rpc("self_schedule_subscription_change", {
        p_subscription_id: aboId,
        p_new_pending_status: "cancelled",
      });
      expect(error).toBeNull();

      const { data } = await service
        .from("subscriptions")
        .select("pending_status, pending_effective_date")
        .eq("id", aboId)
        .single();
      expect(data?.pending_status).toBe("cancelled");
      expect(data?.pending_effective_date).toBe(tagePlus(heute, 10));
    } finally {
      await entferneZyklus(zyklus);
    }
  });
});

describe("PROJ-107: Ohne eingetragenen Zyklus gilt die Rechnung aus PROJ-96", () => {
  it("fällt auf den Sonntag vor dem Zyklusschluss zurück", async () => {
    // Kein Zyklus umfasst heute — die Prüfungen oben haben ihre wieder
    // entfernt. Erkennbar ist der Rückfall daran, dass die Frist ein Sonntag
    // ist und nicht mit dem Zyklusschluss zusammenfällt, außer dieser liegt
    // selbst auf einem Sonntag.
    const { data: vorhanden } = await service
      .from("billing_cycles")
      .select("id")
      .lte("starts_on", heute)
      .gte("ends_on", heute);
    expect(vorhanden ?? []).toEqual([]);

    const aboId = await abo(konten[0], tagePlus(heute, -14));
    const f = await fenster(aboId);
    expect(isoWochentag(f.frist)).toBe(7);
    expect(f.frist <= f.zyklusschluss).toBe(true);
    // Die Invariante der alten Regel: Innerhalb der Frist wirkt es zum
    // Zyklusschluss, danach später — und die Markierung muss mit dem Datum
    // übereinstimmen. Beides auseinander wäre eine Auskunft, die sich selbst
    // widerspricht.
    expect(f.wirksam_zum >= f.zyklusschluss).toBe(true);
    expect(f.frist_abgelaufen).toBe(f.wirksam_zum > f.zyklusschluss);
  });
});
