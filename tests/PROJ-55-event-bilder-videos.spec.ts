import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";
import { erzeugePng } from "./bild-erzeugen";
import { BILDER_BUCKET } from "../src/lib/events/medien";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen (z. B. CI-Variablen direkt gesetzt) — unkritisch.
}

/**
 * PROJ-55: Bilder und Videos an Events und Serien.
 *
 * Diese Suite lädt wirklich hoch — Bilder werden hier erzeugt, durch den
 * Browser verkleinert, im Bildspeicher abgelegt und danach wieder weggeräumt.
 * Nur so lässt sich prüfen, was die Spezifikation verspricht: dass Metadaten
 * verschwinden und dass ein ersetztes Titelbild wirklich weg ist.
 *
 * Braucht die Migration 20260915180000_proj55_event_bilder_videos.sql.
 */

const ADMIN = { email: "e2e14-admin@viennasalsastudio.test", password: "CorrectPassword123!" };

// Je Prüfung ein eigenes Event: Hängen die Tests aneinander, sagt ein
// Fehlschlag nicht mehr, was kaputt ist — und einzeln laufen lässt sich keiner.
const EVENTS = {
  titelbild: { slug: "e2e55-titelbild", name: "E2E55 Titelbild" },
  ohneBild: { slug: "e2e55-ohne-bild", name: "E2E55 Ohne Bild" },
  ersetzen: { slug: "e2e55-ersetzen", name: "E2E55 Ersetzen" },
  metadaten: { slug: "e2e55-metadaten", name: "E2E55 Metadaten" },
  galerie: { slug: "e2e55-galerie", name: "E2E55 Galerie" },
  grossansicht: { slug: "e2e55-grossansicht", name: "E2E55 Großansicht" },
  videos: { slug: "e2e55-videos", name: "E2E55 Filmabend" },
} as const;

type EventName = keyof typeof EVENTS;

const SERIE_SLUG = "e2e55-bilderserie";
const ART_NAME = "E2E55 Art";

const STUNDE = 3_600_000;
const inStunden = (stunden: number) => new Date(Date.now() + stunden * STUNDE).toISOString();
const tag = (versatz: number) => new Date(Date.now() + versatz * 24 * STUNDE).toISOString().slice(0, 10);

let service: SupabaseClient;
let artId: string;
let serieId: string;
const ids: Record<string, string> = {};

/** Ein Bild, wie Playwright es an ein Dateifeld gibt. */
function bild(name: string, breite = 1200, hoehe = 800, merkmal?: string) {
  return { name, mimeType: "image/png", buffer: erzeugePng(breite, hoehe, merkmal) };
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
    const { data: alteSerien } = await service.from("event_series").select("id").eq("event_type_id", alteArt.id);
    for (const e of alteEvents ?? []) await raeumeSpeicher(`events/${e.id}`);
    for (const s of alteSerien ?? []) await raeumeSpeicher(`serien/${s.id}`);
    await service.from("events").delete().eq("event_type_id", alteArt.id);
    await service.from("event_series").delete().eq("event_type_id", alteArt.id);
    await service.from("event_types").delete().eq("id", alteArt.id);
  }

  const { data: art, error: artFehler } = await service
    .from("event_types")
    .insert({ name: ART_NAME })
    .select("id")
    .single();
  if (artFehler) throw new Error(`PROJ-55 Eventart: ${artFehler.message}`);
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
        starts_at: inStunden(48 + nummer),
      }))
    )
    .select("id, slug");
  if (error) throw new Error(`PROJ-55 Events: ${error.message}`);
  for (const [schluessel, eintrag] of Object.entries(EVENTS)) {
    ids[schluessel] = events!.find((e) => e.slug === eintrag.slug)!.id;
  }

  const { data: serie, error: serienFehler } = await service
    .from("event_series")
    .insert({
      name: "E2E55 Bilderserie",
      slug: SERIE_SLUG,
      event_type_id: artId,
      sales_mode: "display",
      weekday: 4,
      start_time: "21:00",
      starts_on: tag(-7),
      pause_in_holidays: false,
    })
    .select("id")
    .single();
  if (serienFehler) throw new Error(`PROJ-55 Serie: ${serienFehler.message}`);
  serieId = serie.id;
});

test.afterAll(async () => {
  for (const id of [...Object.values(ids), serieId]) {
    if (!id) continue;
    await raeumeSpeicher(`events/${id}`);
    await raeumeSpeicher(`serien/${id}`);
  }
  await service.from("events").delete().eq("event_type_id", artId);
  await service.from("event_series").delete().eq("event_type_id", artId);
  if (artId) await service.from("event_types").delete().eq("id", artId);
});

async function login(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  await page.goto("/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(ADMIN.email);
  await page.getByLabel("Passwort").fill(ADMIN.password);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
}

/** Den Medien-Dialog eines Events oder einer Serie öffnen. */
async function oeffneMedien(page: Page, name: string) {
  await gehZu(page, "/admin/events");
  await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: "Bilder & Videos" }).click();
  const dialog = page.getByRole("dialog");
  // Auf die Überschrift warten, nicht auf das Wort: „Titelbild" steht im
  // Dialog auch im Knopf und im Hinweis daneben.
  await expect(dialog.getByRole("heading", { name: "Titelbild" })).toBeVisible({ timeout: 15000 });
  return dialog;
}

function karte(page: Page, name: string) {
  return page.locator(".rounded-lg.border").filter({ has: page.getByRole("link", { name, exact: true }) });
}

/** Die Bildzeilen eines Events, wie sie wirklich in der Datenbank stehen. */
async function bilderVon(id: string, spalte: "event_id" | "series_id" = "event_id") {
  const { data } = await service
    .from("event_images")
    .select("id, role, storage_path, alt_text, position")
    .eq(spalte, id)
    .order("position", { ascending: true });
  return data ?? [];
}

/** Die Galeriezeilen im Verwaltungsdialog — jede trägt ein Beschreibungsfeld. */
function galerieZeilen(dialog: ReturnType<Page["getByRole"]>) {
  return dialog.locator('li:has(input[id^="beschreibung-"])');
}

/** Die Dateien, die im Bildspeicher eines Events wirklich liegen. */
async function dateienVon(id: string): Promise<string[]> {
  const { data } = await service.storage.from(BILDER_BUCKET).list(`events/${id}`, { limit: 100 });
  return (data ?? []).map((eintrag) => `events/${id}/${eintrag.name}`);
}

/** Ein Titelbild über die Verwaltung hochladen und auf die Bestätigung warten. */
async function ladeTitelbildHoch(page: Page, event: EventName, datei: ReturnType<typeof bild>) {
  const dialog = await oeffneMedien(page, EVENTS[event].name);
  await dialog.locator("#titelbild-wahl").setInputFiles(datei);
  await expect(dialog.getByRole("button", { name: "Entfernen" })).toBeVisible({ timeout: 30000 });
  return dialog;
}

test.describe("PROJ-55: Bilder & Videos", () => {
  test("Titelbild hochladen — Karte, Eventseite und Link-Vorschau zeigen es", async ({ page }) => {
    await login(page);
    await ladeTitelbildHoch(page, "titelbild", bild("flyer.png"));

    await gehZu(page, "/events");
    await expect(karte(page, EVENTS.titelbild.name).locator("img")).toBeVisible();

    await gehZu(page, `/events/${EVENTS.titelbild.slug}`);
    const titelbild = page.locator("article img").first();
    await expect(titelbild).toBeVisible();
    // Nicht das Original an jedes Telefon: Die Seite fordert die Größe an, die
    // sie braucht.
    await expect(titelbild).toHaveAttribute("srcset", /\/_next\/image/);

    // Die Link-Vorschau nennt dasselbe Bild — das sieht man in WhatsApp zuerst.
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /\/storage\/v1\/object\/public\/event-bilder\//
    );
  });

  test("Ohne Titelbild bleibt kein Loch — die Karte zeigt eine gestaltete Fläche", async ({ page }) => {
    await gehZu(page, "/events");
    const ohne = karte(page, EVENTS.ohneBild.name);
    await expect(ohne).toBeVisible();
    await expect(ohne.locator("img")).toHaveCount(0);
    // Die Fläche nennt die Eventart, damit die Karte nicht leer wirkt.
    await expect(ohne.getByText(ART_NAME).first()).toBeVisible();
  });

  test("Titelbild ersetzen — das alte verschwindet auch aus dem Bildspeicher", async ({ page }) => {
    await login(page);
    await ladeTitelbildHoch(page, "ersetzen", bild("erster-flyer.png"));

    const vorher = (await bilderVon(ids.ersetzen)).find((b) => b.role === "cover");
    expect(vorher).toBeTruthy();

    await ladeTitelbildHoch(page, "ersetzen", bild("zweiter-flyer.png", 900, 600));
    await page.waitForTimeout(2500);

    const titelbilder = (await bilderVon(ids.ersetzen)).filter((b) => b.role === "cover");
    expect(titelbilder).toHaveLength(1);
    expect(titelbilder[0].storage_path).not.toBe(vorher!.storage_path);
    expect(await dateienVon(ids.ersetzen)).not.toContain(vorher!.storage_path);
  });

  test("Beim Hochladen fallen die Metadaten des Fotos weg", async ({ page }) => {
    // Ein Handyfoto bringt seinen Aufnahmeort mit. Hier steht stellvertretend
    // ein Texteintrag im Bild — überlebt er das Hochladen nicht, ist das Bild
    // unterwegs neu gezeichnet worden.
    await login(page);
    const dialog = await oeffneMedien(page, EVENTS.metadaten.name);
    await dialog.locator("#galerie-wahl").setInputFiles(bild("urlaubsfoto.png", 800, 600, "GEHEIMER-ORT-48.2082"));
    await expect(galerieZeilen(dialog)).toHaveCount(1, { timeout: 30000 });

    const galerie = (await bilderVon(ids.metadaten)).filter((b) => b.role === "gallery");
    expect(galerie).toHaveLength(1);

    const { data: datei } = await service.storage.from(BILDER_BUCKET).download(galerie[0].storage_path);
    const inhalt = Buffer.from(await datei!.arrayBuffer());
    expect(inhalt.includes(Buffer.from("GEHEIMER-ORT"))).toBe(false);
  });

  test("Galerie: Beschreibung, Reihenfolge, Entfernen — und der Alternativtext", async ({ page }) => {
    await login(page);
    let dialog = await oeffneMedien(page, EVENTS.galerie.name);
    await dialog.locator("#galerie-wahl").setInputFiles([bild("eins.png", 600, 400), bild("zwei.png", 600, 400)]);
    await expect(galerieZeilen(dialog)).toHaveCount(2, { timeout: 40000 });

    // Die Beschreibung wird zum Alternativtext.
    const erste = galerieZeilen(dialog).first();
    await erste.getByLabel("Bildbeschreibung (optional)").fill("Tanzfläche am Abend");
    await erste.getByLabel("Bildbeschreibung (optional)").blur();
    await expect(page.getByText("Beschreibung gespeichert.")).toBeVisible({ timeout: 15000 });

    const vorherErste = (await bilderVon(ids.galerie)).filter((b) => b.role === "gallery")[0];
    await galerieZeilen(dialog).first().getByRole("button", { name: "Nach unten" }).click();
    await page.waitForTimeout(2500);

    const sortiert = (await bilderVon(ids.galerie)).filter((b) => b.role === "gallery");
    expect(sortiert[1].id).toBe(vorherErste.id);

    // Auf der Seite trägt das beschriebene Bild seinen Text, das andere den
    // Eventnamen.
    await gehZu(page, `/events/${EVENTS.galerie.slug}`);
    await expect(page.getByRole("img", { name: "Tanzfläche am Abend" })).toBeVisible();
    await expect(page.getByRole("img", { name: EVENTS.galerie.name }).first()).toBeVisible();

    // Entfernen räumt Eintrag und Datei weg.
    dialog = await oeffneMedien(page, EVENTS.galerie.name);
    const zuLoeschen = sortiert[sortiert.length - 1];
    await galerieZeilen(dialog).last().getByRole("button", { name: "Bild entfernen" }).click();
    await expect(galerieZeilen(dialog)).toHaveCount(1, { timeout: 15000 });

    expect((await bilderVon(ids.galerie)).map((b) => b.id)).not.toContain(zuLoeschen.id);
    expect(await dateienVon(ids.galerie)).not.toContain(zuLoeschen.storage_path);
  });

  test("Großansicht: öffnen, blättern, mit Escape schließen", async ({ page }) => {
    await login(page);
    const dialog = await oeffneMedien(page, EVENTS.grossansicht.name);
    await dialog.locator("#galerie-wahl").setInputFiles([bild("a.png", 500, 500), bild("b.png", 500, 500)]);
    await expect(galerieZeilen(dialog)).toHaveCount(2, { timeout: 40000 });

    await gehZu(page, `/events/${EVENTS.grossansicht.slug}`);
    const bereich = page.locator("section").filter({ has: page.getByRole("heading", { name: "Bilder" }) });
    await bereich.getByRole("button").first().click();

    const gross = page.getByRole("dialog");
    await expect(gross.getByText("Bild 1 von 2")).toBeVisible();
    await gross.getByRole("button", { name: "Nächstes Bild" }).click();
    await expect(gross.getByText("Bild 2 von 2")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(gross).toBeHidden();
  });

  test("Falsches Format wird abgewiesen, und nichts wird gespeichert", async ({ page }) => {
    await login(page);
    const dialog = await oeffneMedien(page, EVENTS.ohneBild.name);
    await dialog.locator("#galerie-wahl").setInputFiles({
      name: "programm.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 kein Bild"),
    });

    await expect(page.getByText("Nur JPG, PNG oder WebP.")).toBeVisible({ timeout: 15000 });
    expect(await bilderVon(ids.ohneBild)).toHaveLength(0);
    expect(await dateienVon(ids.ohneBild)).toHaveLength(0);
  });

  test("Videos: YouTube-Link wird angenommen, ein anderer nicht", async ({ page }) => {
    await login(page);
    const dialog = await oeffneMedien(page, EVENTS.videos.name);

    await dialog.getByLabel("YouTube-Link").fill("https://example.com/kein-video");
    await dialog.getByRole("button", { name: "Video hinzufügen" }).click();
    await expect(page.getByText("Das ist kein YouTube-Link")).toBeVisible({ timeout: 15000 });

    await dialog.getByLabel("YouTube-Link").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    await dialog.getByLabel("Titel (optional)").fill("Rückblick");
    await dialog.getByRole("button", { name: "Video hinzufügen" }).click();
    await expect(page.getByText("Video hinzugefügt.")).toBeVisible({ timeout: 15000 });

    await gehZu(page, `/events/${EVENTS.videos.slug}`);
    await expect(page.getByRole("heading", { name: "Videos" })).toBeVisible();
    // Datensparsam eingebettet: über youtube-nocookie, wie die Beispiel-Videos.
    await expect(page.locator('iframe[src*="youtube-nocookie.com"]')).toBeVisible();

    // Und wieder weg damit.
    const nochmal = await oeffneMedien(page, EVENTS.videos.name);
    await nochmal.getByRole("button", { name: "Video entfernen" }).click();
    await expect(page.getByText("Video entfernt.")).toBeVisible({ timeout: 15000 });

    await gehZu(page, `/events/${EVENTS.videos.slug}`);
    await expect(page.locator('iframe[src*="youtube-nocookie.com"]')).toHaveCount(0);
  });

  test("Der Dialog weist auf Bildrechte und Einverständnis hin", async ({ page }) => {
    await login(page);
    const dialog = await oeffneMedien(page, EVENTS.ohneBild.name);
    await expect(dialog.getByText(/Rechte hat und mit deren Veröffentlichung die abgebildeten Personen/)).toBeVisible();
    await expect(dialog.getByText(/Standortdaten aus Handyfotos werden beim Hochladen entfernt/)).toBeVisible();
  });

  test("Serie: das Titelbild gilt auf der Serienseite", async ({ page }) => {
    await login(page);
    const dialog = await oeffneMedien(page, "E2E55 Bilderserie");
    await dialog.locator("#titelbild-wahl").setInputFiles(bild("serienflyer.png", 1000, 700));
    await expect(dialog.getByRole("button", { name: "Entfernen" })).toBeVisible({ timeout: 30000 });

    await gehZu(page, `/events/${SERIE_SLUG}`);
    await expect(page.getByRole("heading", { level: 1, name: "E2E55 Bilderserie" })).toBeVisible();
    await expect(page.locator("article img").first()).toBeVisible();
  });
});
