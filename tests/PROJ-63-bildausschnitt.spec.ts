import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { erzeugePng } from "./bild-erzeugen";
import { BILDER_BUCKET } from "../src/lib/events/medien";
import { zweiteStufeErledigen } from "./zweite-stufe";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen (z. B. CI-Variablen direkt gesetzt) — unkritisch.
}

/**
 * PROJ-63: Welcher Teil des Titelbilds auf der Karte zu sehen ist.
 *
 * Geprüft wird der ganze Weg: Der Betreiber schiebt den Regler im
 * Bilder-Dialog, die Zahl landet in der Datenbank, und die öffentliche Karte
 * zeigt genau diesen Ausschnitt — während die Eventseite den Flyer weiterhin
 * ganz zeigt.
 *
 * Braucht die Migration 20260923090000_proj63_bildausschnitt.sql.
 */

const ADMIN = { email: "e2e14-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const ART_NAME = "E2E63 Art";

// Je Prüfung ein eigenes Event — wie schon bei PROJ-55. Teilen sich zwei
// Prüfungen eines, steht beim Hochladen der Knopf „Entfernen" vom vorigen Bild
// noch da, und die Prüfung fährt los, bevor das neue Bild oben ist. Genau
// daran ist AC8 im ersten Anlauf gescheitert.
const EVENTS = {
  hoch: { slug: "e2e63-hochformat", name: "E2E63 Hochformat" },
  breit: { slug: "e2e63-panorama", name: "E2E63 Panorama" },
  passend: { slug: "e2e63-passend", name: "E2E63 Passend" },
  seite: { slug: "e2e63-eventseite", name: "E2E63 Eventseite" },
  ersetzen: { slug: "e2e63-ersetzen", name: "E2E63 Ersetzen" },
  rechte: { slug: "e2e63-rechte", name: "E2E63 Rechte" },
} as const;

type EventName = keyof typeof EVENTS;

const STUNDE = 3_600_000;
const inStunden = (stunden: number) => new Date(Date.now() + stunden * STUNDE).toISOString();

let service: SupabaseClient;
let artId: string;
const ids: Record<string, string> = {};

function bild(name: string, breite: number, hoehe: number) {
  return { name, mimeType: "image/png", buffer: erzeugePng(breite, hoehe) };
}

async function raeumeSpeicher(ordner: string) {
  const { data } = await service.storage.from(BILDER_BUCKET).list(ordner, { limit: 1000 });
  const pfade = (data ?? []).map((eintrag) => `${ordner}/${eintrag.name}`);
  if (pfade.length > 0) await service.storage.from(BILDER_BUCKET).remove(pfade);
}

test.beforeAll(async () => {
  service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: alteArt } = await service.from("event_types").select("id").eq("name", ART_NAME).maybeSingle();
  if (alteArt) {
    const { data: alteEvents } = await service.from("events").select("id").eq("event_type_id", alteArt.id);
    for (const e of alteEvents ?? []) await raeumeSpeicher(`events/${e.id}`);
    await service.from("events").delete().eq("event_type_id", alteArt.id);
    await service.from("event_types").delete().eq("id", alteArt.id);
  }

  const { data: art, error: artFehler } = await service
    .from("event_types")
    .insert({ name: ART_NAME })
    .select("id")
    .single();
  if (artFehler) throw new Error(`PROJ-63 Eventart: ${artFehler.message}`);
  artId = art.id;

  const leer = { capacity: null, price_normal: null, price_student: null, sales_mode: "display" };
  const { data: events, error } = await service
    .from("events")
    .insert(
      Object.values(EVENTS).map((eintrag, nummer) => ({
        ...leer,
        name: eintrag.name,
        slug: eintrag.slug,
        event_type_id: artId,
        starts_at: inStunden(72 + nummer),
      }))
    )
    .select("id, slug");
  if (error) throw new Error(`PROJ-63 Events: ${error.message}`);
  for (const [schluessel, eintrag] of Object.entries(EVENTS)) {
    ids[schluessel] = events!.find((e) => e.slug === eintrag.slug)!.id;
  }
});

test.afterAll(async () => {
  for (const id of Object.values(ids)) {
    if (id) await raeumeSpeicher(`events/${id}`);
  }
  await service.from("events").delete().eq("event_type_id", artId);
  if (artId) await service.from("event_types").delete().eq("id", artId);
});

async function login(page: Page) {
  await page.goto("/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(ADMIN.email);
  await page.getByLabel("Passwort").fill(ADMIN.password);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, ADMIN.email);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
}

async function oeffneMedien(page: Page, name: string) {
  await gehZu(page, "/admin/events");
  await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: "Bilder & Videos" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Titelbild" })).toBeVisible({ timeout: 15000 });
  return dialog;
}

/** Ein Titelbild über die Verwaltung hochladen und auf die Bestätigung warten. */
async function ladeTitelbildHoch(page: Page, event: EventName, breite: number, hoehe: number) {
  const dialog = await oeffneMedien(page, EVENTS[event].name);
  await dialog.locator("#titelbild-wahl").setInputFiles(bild("flyer.png", breite, hoehe));
  await expect(dialog.getByRole("button", { name: "Entfernen" })).toBeVisible({ timeout: 30000 });
  return dialog;
}

function karte(page: Page, name: string) {
  return page.locator(".rounded-lg.border").filter({ has: page.getByRole("link", { name, exact: true }) });
}

/** Der gespeicherte Ausschnitt eines Events, wie er wirklich in der Datenbank steht. */
async function ausschnittVon(event: EventName): Promise<number | null> {
  const { data } = await service
    .from("event_images")
    .select("focus_percent")
    .eq("event_id", ids[event])
    .eq("role", "cover")
    .maybeSingle();
  return data?.focus_percent ?? null;
}

test.describe("PROJ-63: Bildausschnitt für das Event-Titelbild", () => {
  test("AC1–AC4: Der Regler verschiebt den Ausschnitt, die Karte zeigt ihn", async ({ page }) => {
    await login(page);
    const dialog = await ladeTitelbildHoch(page, "hoch", 900, 1200);

    // Vorschau und Regler stehen da, und die Enden sagen, wohin es geht.
    await expect(dialog.getByText("So sieht die Karte in der Übersicht aus")).toBeVisible();
    const regler = dialog.getByRole("slider");
    await expect(regler).toBeVisible();
    await expect(dialog.getByText("oben", { exact: true })).toBeVisible();
    await expect(dialog.getByText("unten", { exact: true })).toBeVisible();

    // Frisch hochgeladen heißt mittig — wie vor diesem Projekt.
    expect(await ausschnittVon("hoch")).toBe(50);

    // Wie ein Mensch ohne Maus: Der Regler nimmt die Tastatur an.
    await regler.press("Home");
    await expect(page.getByText("Bildausschnitt gespeichert.")).toBeVisible({ timeout: 20000 });
    await expect.poll(() => ausschnittVon("hoch"), { timeout: 15000 }).toBe(0);

    // Und die öffentliche Karte zeigt genau das obere Ende.
    await gehZu(page, "/events");
    await expect(karte(page, EVENTS.hoch.name).locator("img")).toHaveCSS("object-position", "50% 0%");
  });

  test("AC5: Ein sehr breites Bild verschiebt sich zur Seite", async ({ page }) => {
    await login(page);
    const dialog = await ladeTitelbildHoch(page, "breit", 2100, 900);

    await expect(dialog.getByText("links", { exact: true })).toBeVisible();
    await expect(dialog.getByText("rechts", { exact: true })).toBeVisible();

    await dialog.getByRole("slider").press("End");
    await expect(page.getByText("Bildausschnitt gespeichert.")).toBeVisible({ timeout: 20000 });
    await expect.poll(() => ausschnittVon("breit"), { timeout: 15000 }).toBe(100);

    await gehZu(page, "/events");
    await expect(karte(page, EVENTS.breit.name).locator("img")).toHaveCSS("object-position", "100% 50%");
  });

  test("AC6: Ein Bild im Kartenformat bekommt keinen Regler, sondern eine Erklärung", async ({ page }) => {
    await login(page);
    const dialog = await ladeTitelbildHoch(page, "passend", 1600, 900);

    await expect(dialog.getByText("Dieses Bild hat genau das Format der Karte")).toBeVisible();
    await expect(dialog.getByRole("slider")).toHaveCount(0);
  });

  test("AC8: Auf der Eventseite bleibt der Flyer ganz zu sehen", async ({ page }) => {
    await login(page);
    const dialog = await ladeTitelbildHoch(page, "seite", 900, 1200);
    await dialog.getByRole("slider").press("Home");
    await expect(page.getByText("Bildausschnitt gespeichert.")).toBeVisible({ timeout: 20000 });
    await expect.poll(() => ausschnittVon("seite"), { timeout: 15000 }).toBe(0);

    await gehZu(page, `/events/${EVENTS.seite.slug}`);
    // Über den Alternativtext, nicht über die Stelle im Aufbau: Ohne
    // Beschreibung trägt das Titelbild den Eventnamen — genau das, woran auch
    // eine Vorleseansage es erkennt.
    const bildAufSeite = page.getByRole("img", { name: EVENTS.seite.name });
    await expect(bildAufSeite).toBeVisible();
    // Ganz heißt: nichts abgeschnitten. Ein zugeschnittenes Bild stünde hier
    // auf „cover".
    await expect(bildAufSeite).toHaveCSS("object-fit", "contain");
  });

  test("AC10: Ein neues Titelbild beginnt wieder mittig", async ({ page }) => {
    await login(page);
    const dialog = await ladeTitelbildHoch(page, "ersetzen", 900, 1200);
    await dialog.getByRole("slider").press("Home");
    await expect(page.getByText("Bildausschnitt gespeichert.")).toBeVisible({ timeout: 20000 });
    await expect.poll(() => ausschnittVon("ersetzen"), { timeout: 15000 }).toBe(0);

    // Ersetzen heißt: neues Bild, neuer Ausschnitt. Der alte Wert darf nicht
    // am neuen Flyer kleben.
    await dialog.locator("#titelbild-wahl").setInputFiles(bild("anderer-flyer.png", 900, 1200));
    await expect.poll(() => ausschnittVon("ersetzen"), { timeout: 30000 }).toBe(50);
  });

  test("Sicherheit: Ohne Verwaltungsrechte lässt sich der Ausschnitt nicht setzen", async ({ page }) => {
    await login(page);
    await ladeTitelbildHoch(page, "rechte", 900, 1200);

    const { data: bildZeile } = await service
      .from("event_images")
      .select("id")
      .eq("event_id", ids.rechte)
      .eq("role", "cover")
      .single();

    const ohneRechte = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const vorher = await ausschnittVon("rechte");
    await ohneRechte.from("event_images").update({ focus_percent: 7 }).eq("id", bildZeile!.id);
    // Ohne Rechte trifft die Änderung keine Zeile — sie kommt ohne Fehler
    // zurück. Was zählt, ist der Wert danach.
    expect(await ausschnittVon("rechte")).toBe(vorher);
  });
});
