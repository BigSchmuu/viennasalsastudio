import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { angemeldetAls } from "./anmeldung";

/**
 * PROJ-80: Der Kündigungsgrund.
 *
 * Geprüft wird die Datenbankfunktion, nicht das Formular: Sie nimmt Grund und
 * Notiz mit, leert sie bei einer Pause und beim Zurücknehmen — und sie ist nach
 * dem Umbau der Signatur weiterhin nur für Angemeldete erreichbar. Das Letzte
 * ist der Punkt, an dem diese Art von Migration am häufigsten scheitert:
 * `drop`/`create` setzt die Rechte zurück, und Supabase vergibt sie neu an
 * `anon`.
 *
 * Braucht die Migration 20261007170000_proj80_kuendigungsgrund.sql.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORT = "CorrectPassword123!";
const KUNDE = "proj80-grund@viennasalsastudio.test";

let service: SupabaseClient;
let alsKunde: SupabaseClient;
let kundeId = "";
let aboId = "";

function wienerDatum(versatzTage = 0): string {
  const ziel = new Date(Date.now() + versatzTage * 24 * 3_600_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(ziel);
}

/** Ein frisches, aktives Abo ohne geplante Änderung — Vorbedingung der Funktion. */
async function aboZuruecksetzen(): Promise<void> {
  const { error } = await service
    .from("subscriptions")
    .update({
      status: "active",
      pending_status: null,
      pending_effective_date: null,
      cancelled_at: null,
      cancellation_reason: null,
      cancellation_note: null,
    })
    .eq("id", aboId);
  if (error) throw new Error(`Abo zurücksetzen: ${error.message}`);
}

async function abo(): Promise<{
  pending_status: string | null;
  cancellation_reason: string | null;
  cancellation_note: string | null;
}> {
  const { data, error } = await service
    .from("subscriptions")
    .select("pending_status, cancellation_reason, cancellation_note")
    .eq("id", aboId)
    .single();
  if (error) throw new Error(`Abo lesen: ${error.message}`);
  return data;
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
  if (kontoFehler || !neu.user) throw new Error(`PROJ-80 Konto: ${kontoFehler?.message}`);
  kundeId = neu.user.id;
  await service.from("profiles").update({ full_name: "E2E80 Grundkunde" }).eq("id", kundeId);

  const { data: neuesAbo, error: aboFehler } = await service
    .from("subscriptions")
    .insert({
      customer_id: kundeId,
      status: "active",
      name: "E2E80 Flatrate",
      price: 80,
      // Weit zurück, damit der nächste Zyklus-Ende-Termin in der Zukunft liegt.
      cycle_anchor_date: wienerDatum(-40),
    })
    .select("id")
    .single();
  if (aboFehler) throw new Error(`PROJ-80 Abo: ${aboFehler.message}`);
  aboId = neuesAbo!.id;

  alsKunde = await angemeldetAls(URL, ANON, KUNDE, PASSWORT);
});

afterAll(async () => {
  if (aboId) await service.from("subscriptions").delete().eq("id", aboId);
  if (kundeId) await service.auth.admin.deleteUser(kundeId).catch(() => {});
});

describe("PROJ-80: Der Kündigungsgrund in der Datenbank", () => {
  it("nimmt Grund und Notiz bei der Kündigung mit", async () => {
    await aboZuruecksetzen();
    const { error } = await alsKunde.rpc("self_schedule_subscription_change", {
      p_subscription_id: aboId,
      p_new_pending_status: "cancelled",
      p_cancellation_reason: "keine_zeit",
      p_cancellation_note: "Schichtdienst ab November.",
    });
    expect(error, `Kündigung scheiterte: ${error?.message}`).toBeNull();

    const zeile = await abo();
    expect(zeile.pending_status).toBe("cancelled");
    expect(zeile.cancellation_reason).toBe("keine_zeit");
    expect(zeile.cancellation_note).toBe("Schichtdienst ab November.");
  });

  it("kündigt auch ohne Angaben — beides ist freiwillig", async () => {
    await aboZuruecksetzen();
    const { error } = await alsKunde.rpc("self_schedule_subscription_change", {
      p_subscription_id: aboId,
      p_new_pending_status: "cancelled",
    });
    expect(error, `Kündigung ohne Grund scheiterte: ${error?.message}`).toBeNull();

    const zeile = await abo();
    expect(zeile.pending_status).toBe("cancelled");
    expect(zeile.cancellation_reason).toBeNull();
  });

  it("macht aus Leerzeichen keine Angabe", async () => {
    await aboZuruecksetzen();
    await alsKunde.rpc("self_schedule_subscription_change", {
      p_subscription_id: aboId,
      p_new_pending_status: "cancelled",
      p_cancellation_reason: "  ",
      p_cancellation_note: "   ",
    });

    const zeile = await abo();
    expect(zeile.cancellation_reason).toBeNull();
    expect(zeile.cancellation_note).toBeNull();
  });

  // Ein Grund am Abo, der nichts mehr erklärt, ist schlimmer als keiner.
  it("leert Grund und Notiz bei einer Pause", async () => {
    await aboZuruecksetzen();
    await service
      .from("subscriptions")
      .update({ cancellation_reason: "zu_teuer", cancellation_note: "alt" })
      .eq("id", aboId);

    await alsKunde.rpc("self_schedule_subscription_change", {
      p_subscription_id: aboId,
      p_new_pending_status: "paused",
    });

    const zeile = await abo();
    expect(zeile.pending_status).toBe("paused");
    expect(zeile.cancellation_reason).toBeNull();
    expect(zeile.cancellation_note).toBeNull();
  });

  it("leert sie auch, wenn der Kunde die Kündigung zurücknimmt", async () => {
    await aboZuruecksetzen();
    await alsKunde.rpc("self_schedule_subscription_change", {
      p_subscription_id: aboId,
      p_new_pending_status: "cancelled",
      p_cancellation_reason: "umzug",
      p_cancellation_note: "Wien verlassen",
    });

    const { error } = await alsKunde.rpc("self_undo_pending_change", {
      p_subscription_id: aboId,
    });
    expect(error, `Zurücknehmen scheiterte: ${error?.message}`).toBeNull();

    const zeile = await abo();
    expect(zeile.pending_status).toBeNull();
    expect(zeile.cancellation_reason).toBeNull();
    expect(zeile.cancellation_note).toBeNull();
  });

  // Die Liste steht als CHECK in der Datenbank: Ein Schreibzugriff von irgendwo
  // sonst soll keinen Grund erfinden können, den die Auswertung nicht kennt.
  it("weist einen erfundenen Grund ab", async () => {
    await aboZuruecksetzen();
    const { error } = await service
      .from("subscriptions")
      .update({ cancellation_reason: "mir_doch_egal" })
      .eq("id", aboId);
    expect(error, "Ein unbekannter Grund wurde angenommen").not.toBeNull();
  });

  // `drop`/`create` setzt die Rechte zurück, und Supabase vergibt EXECUTE neu an
  // `anon`. Der häufigste Fehler bei genau dieser Art von Migration.
  it("bleibt für einen nicht angemeldeten Aufrufer verschlossen", async () => {
    const anonym = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error } = await anonym.rpc("self_schedule_subscription_change", {
      p_subscription_id: aboId,
      p_new_pending_status: "cancelled",
    });
    expect(error, "Die Funktion war ohne Anmeldung aufrufbar").not.toBeNull();
  });
});
