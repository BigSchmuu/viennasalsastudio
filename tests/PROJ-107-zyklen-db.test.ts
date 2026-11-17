import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-107: Die Regeln der Zyklustabelle.
 *
 * Diese Regeln stehen absichtlich in der Datenbank und nicht im Formular — und
 * damit sind sie nur hier prüfbar. Ein `create function` sagt nichts darüber,
 * ob der Trigger greift; nur der Aufruf bringt es ans Licht
 * (.claude/rules/backend.md).
 *
 * Zwei Teile, und der zweite wird gern vergessen:
 *
 * 1. **Die Trigger.** Kein Tag in zwei Zyklen, ein Zyklus mit Lauf ist
 *    unveränderlich, und ein Ende vor dem Beginn wird mit der **Ursache**
 *    abgelehnt. Letzteres ist kein Schönheitsfehler: Ein BEFORE-Trigger läuft
 *    vor den CHECK-Bedingungen, deshalb kann ein Trigger eine falsche
 *    Begründung liefern, die dann im Formular des Betreibers landet.
 *
 * 2. **Die Rechte.** Geprüft als **Kunde**, nicht mit dem Dienstschlüssel: Der
 *    Dienstschlüssel umgeht RLS, ein damit grüner Test sagt über die Regeln
 *    nichts. Und eine Abfrage, die RLS nicht passiert, liefert **leer statt
 *    Fehler** — deshalb wird hier der Inhalt geprüft und nicht nur, dass es
 *    keinen Fehler gab.
 *
 * Die Zeiträume liegen im Jahr 2032, weit hinter allem, was andere Prüfungen
 * anlegen. Genau das ist seit der Korrektur möglich: Die erste Fassung verlangte
 * eine lückenlose Kette und hätte für einen Zyklus im Jahr 2032 achtzig Zyklen
 * dazwischen gebraucht.
 *
 * Braucht die Migrationen 20261117140000 und 20261117170000.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";

const marke = Date.now();
const KUNDE = `proj107-kunde-${marke}@viennasalsastudio.test`;

let service: SupabaseClient;
let alsKunde: SupabaseClient;

const zyklen: string[] = [];
const laeufe: string[] = [];
const konten: string[] = [];

/** Legt einen Zyklus an und gibt Fehlermeldung oder Kennung zurück. */
async function anlegen(von: string, bis: string): Promise<{ id?: string; fehler?: string }> {
  const { data, error } = await service
    .from("billing_cycles")
    .insert({ starts_on: von, ends_on: bis })
    .select("id")
    .single();
  if (error) return { fehler: error.message };
  zyklen.push(data!.id);
  return { id: data!.id };
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, { auth: { persistSession: false } });

  const { data, error } = await service.auth.admin.createUser({
    email: KUNDE,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-107 Konto: ${error?.message}`);
  konten.push(data.user.id);

  alsKunde = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
});

afterAll(async () => {
  for (const id of laeufe) await service.from("sepa_collection_runs").delete().eq("id", id);
  for (const id of zyklen) await service.from("billing_cycles").delete().eq("id", id);
  for (const id of konten) await service.auth.admin.deleteUser(id);
});

describe("PROJ-107: Was die Datenbank über Zyklen erzwingt", () => {
  it("nimmt einen Zyklus an, der an keinen anderen anschließt", async () => {
    // Die Kettenpflicht ist absichtlich gefallen: Sie machte Prüfungen zu
    // realistischen Daten unmöglich.
    const ergebnis = await anlegen("2032-05-03", "2032-05-30");
    expect(ergebnis.fehler).toBeUndefined();
    expect(ergebnis.id).toBeTruthy();
  });

  it("nennt beim Ende vor dem Beginn die Ursache", async () => {
    const ergebnis = await anlegen("2032-09-13", "2032-09-06");
    expect(ergebnis.fehler).toContain("ends before it starts");
  });

  it("lässt keinen Tag zu zwei Zyklen gehören", async () => {
    const faelle: [string, string, string][] = [
      ["2032-05-24", "2032-06-20", "überlappt am Ende"],
      ["2032-04-12", "2032-05-09", "überlappt am Anfang"],
      ["2032-05-10", "2032-05-16", "liegt ganz darin"],
      ["2032-04-05", "2032-06-27", "schließt ihn ein"],
      ["2032-05-30", "2032-06-26", "nur der letzte Tag"],
      ["2032-05-03", "2032-05-30", "derselbe Zeitraum"],
    ];
    for (const [von, bis, was] of faelle) {
      const ergebnis = await anlegen(von, bis);
      expect(ergebnis.fehler, was).toContain("overlaps an existing one");
    }
  });

  it("nimmt den Anschluss vorne und hinten an, ohne Lücke", async () => {
    const hinten = await anlegen("2032-05-31", "2032-06-27");
    expect(hinten.fehler).toBeUndefined();
    const vorne = await anlegen("2032-04-05", "2032-05-02");
    expect(vorne.fehler).toBeUndefined();
  });

  it("erlaubt eine Lücke — dafür warnt das Formular, nicht die Datenbank", async () => {
    const ergebnis = await anlegen("2032-08-02", "2032-08-29");
    expect(ergebnis.fehler).toBeUndefined();
  });

  describe("Ein Zyklus mit Lastschriftlauf ist unveränderlich", () => {
    let zyklusId = "";

    beforeAll(async () => {
      const z = await anlegen("2032-11-01", "2032-11-28");
      if (!z.id) throw new Error(`PROJ-107 Zyklus für den Lauf: ${z.fehler}`);
      zyklusId = z.id;

      const { data, error } = await service
        .from("sepa_collection_runs")
        .insert({ due_date: "2032-11-01", cycle_id: zyklusId })
        .select("id")
        .single();
      if (error) throw new Error(`PROJ-107 Lauf: ${error.message}`);
      laeufe.push(data!.id);
    });

    it("lässt sich nicht verschieben", async () => {
      const { error } = await service
        .from("billing_cycles")
        .update({ ends_on: "2032-12-05" })
        .eq("id", zyklusId);
      expect(error?.message).toContain("has collection runs");
    });

    it("lässt sich nicht löschen", async () => {
      const { error } = await service.from("billing_cycles").delete().eq("id", zyklusId);
      expect(error?.message).toContain("has collection runs");
    });

    it("behält seinen Zeitraum nach den abgewiesenen Versuchen", async () => {
      const { data } = await service
        .from("billing_cycles")
        .select("starts_on, ends_on")
        .eq("id", zyklusId)
        .single();
      expect(data).toEqual({ starts_on: "2032-11-01", ends_on: "2032-11-28" });
    });
  });
});

describe("PROJ-107: Wer die Zyklen sehen und ändern darf", () => {
  it("zeigt dem Kunden keine Zyklen", async () => {
    // Eine leere Liste ohne Fehler ist hier das erwartete Verhalten von RLS —
    // belegt wird es, indem dieselbe Abfrage mit dem Dienstschlüssel etwas
    // findet. Ohne diesen Gegenbeweis bestünde der Test auch bei leerer
    // Tabelle (.claude/rules/backend.md).
    const { data: alsAdmin } = await service.from("billing_cycles").select("id").limit(5);
    expect((alsAdmin ?? []).length).toBeGreaterThan(0);

    const { data, error } = await alsKunde.from("billing_cycles").select("id").limit(5);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("lässt den Kunden keinen Zyklus anlegen", async () => {
    const { error } = await alsKunde
      .from("billing_cycles")
      .insert({ starts_on: "2033-01-04", ends_on: "2033-01-31" });
    expect(error).not.toBeNull();
  });

  it("lässt den Kunden keinen Zyklus ändern", async () => {
    const { error, count } = await alsKunde
      .from("billing_cycles")
      .update({ ends_on: "2032-06-06" }, { count: "exact" })
      .eq("starts_on", "2032-05-03");
    // RLS blockt beim Ändern nicht mit einem Fehler, sondern trifft keine
    // Zeile. Beides ist richtig — nur „hat geändert" wäre falsch.
    expect(error ? true : count === 0).toBe(true);

    const { data } = await service
      .from("billing_cycles")
      .select("ends_on")
      .eq("starts_on", "2032-05-03")
      .single();
    expect(data?.ends_on).toBe("2032-05-30");
  });
});
