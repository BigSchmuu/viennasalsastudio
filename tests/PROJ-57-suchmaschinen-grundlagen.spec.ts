import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen (z. B. CI-Variablen direkt gesetzt) — unkritisch.
}

/**
 * PROJ-57: Sitemap, robots.txt und die Verknüpfung der Sprachen.
 *
 * Das Besondere an dieser Suite: Sie prüft Dinge, die kein Mensch je zu Gesicht
 * bekommt. Genau deshalb braucht es sie — beim Bauen hat die Sprachweiche
 * Sitemap und robots.txt verschluckt und die 404-Seite ausgeliefert, und das
 * wäre sonst erst in der Produktion aufgefallen, wo niemand hinsieht.
 */

const ART_NAME = "E2E57 Art";
const STUNDE = 3_600_000;
const inStunden = (h: number) => new Date(Date.now() + h * STUNDE).toISOString();
const tag = (versatz: number) => new Date(Date.now() + versatz * 24 * STUNDE).toISOString().slice(0, 10);

let service: SupabaseClient;
let artId: string;
const adressen = {
  kommend: "e2e57-kommendes-event",
  vergangen: "e2e57-vergangenes-event",
  abgesagt: "e2e57-abgesagtes-event",
  serie: "e2e57-laufende-serie",
  serieBeendet: "e2e57-beendete-serie",
  termin: "",
};

async function eventAnlegen(name: string, slug: string, felder: Record<string, unknown> = {}) {
  const { data, error } = await service
    .from("events")
    .insert({
      name,
      slug,
      event_type_id: artId,
      sales_mode: "display",
      capacity: null,
      price_normal: null,
      price_student: null,
      starts_at: inStunden(72),
      ends_at: inStunden(76),
      ...felder,
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-57 Event ${name}: ${error.message}`);
  return data.id;
}

test.beforeAll(async () => {
  service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: alteArt } = await service.from("event_types").select("id").eq("name", ART_NAME).maybeSingle();
  if (alteArt) {
    await service.from("events").delete().eq("event_type_id", alteArt.id);
    await service.from("event_series").delete().eq("event_type_id", alteArt.id);
    await service.from("event_types").delete().eq("id", alteArt.id);
  }
  const { data: art, error } = await service.from("event_types").insert({ name: ART_NAME }).select("id").single();
  if (error) throw new Error(`PROJ-57 Eventart: ${error.message}`);
  artId = art.id;

  await eventAnlegen("E2E57 Kommendes Event", adressen.kommend);
  await eventAnlegen("E2E57 Vergangenes Event", adressen.vergangen, {
    starts_at: inStunden(-72),
    ends_at: inStunden(-70),
  });
  await eventAnlegen("E2E57 Abgesagtes Event", adressen.abgesagt, { status: "abgesagt" });

  const { data: serie, error: serienFehler } = await service
    .from("event_series")
    .insert({
      name: "E2E57 Laufende Serie",
      slug: adressen.serie,
      event_type_id: artId,
      sales_mode: "display",
      weekday: 4,
      start_time: "21:00",
      starts_on: tag(-7),
      pause_in_holidays: false,
      status: "aktiv",
    })
    .select("id")
    .single();
  if (serienFehler) throw new Error(`PROJ-57 Serie: ${serienFehler.message}`);

  await service.from("event_series").insert({
    name: "E2E57 Beendete Serie",
    slug: adressen.serieBeendet,
    event_type_id: artId,
    sales_mode: "display",
    weekday: 4,
    start_time: "21:00",
    starts_on: tag(-60),
    pause_in_holidays: false,
    status: "beendet",
  });

  // Ein Termin der laufenden Serie — er ist ein Event mit eigener Adresse.
  adressen.termin = `${adressen.serie}-${tag(3)}`;
  await eventAnlegen("E2E57 Laufende Serie", adressen.termin, {
    series_id: serie.id,
    occurrence_date: tag(3),
    starts_at: inStunden(72),
    ends_at: inStunden(76),
  });
});

test.afterAll(async () => {
  await service.from("events").delete().eq("event_type_id", artId);
  await service.from("event_series").delete().eq("event_type_id", artId);
  if (artId) await service.from("event_types").delete().eq("id", artId);
});

/** Die Angabe „robots" aus dem ausgelieferten Seitenkopf. */
async function robotsAngabe(page: import("@playwright/test").Page, pfad: string): Promise<string> {
  await gehZu(page, pfad);
  return (await page.locator('meta[name="robots"]').getAttribute("content")) ?? "";
}

test.describe("PROJ-57: Suchmaschinen-Grundlagen", () => {
  test("robots.txt nennt die Sitemap und sperrt die Bereiche hinter der Anmeldung", async ({ request }) => {
    const antwort = await request.get("/robots.txt");
    expect(antwort.status()).toBe(200);
    const text = await antwort.text();

    // Kein HTML: Beim Bauen lieferte die Sprachweiche hier die 404-Seite aus.
    expect(text).not.toContain("<!DOCTYPE html>");
    expect(text).toContain("Sitemap:");
    for (const bereich of ["/admin", "/checkin", "/lehrer", "/mein-bereich", "/profil", "/rechnungen"]) {
      expect(text).toContain(`Disallow: ${bereich}`);
    }
  });

  test("Die Sitemap führt kommende Events und laufende Serien, beide Sprachen", async ({ request }) => {
    const antwort = await request.get("/sitemap.xml");
    expect(antwort.status()).toBe(200);
    const xml = await antwort.text();

    expect(xml).not.toContain("<!DOCTYPE html>");
    expect(xml).toContain(`/events/${adressen.kommend}`);
    expect(xml).toContain(`/events/${adressen.serie}`);
    // Je Eintrag beide Sprachen und die Vorgabe.
    expect(xml).toContain(`/en/events/${adressen.kommend}`);
    expect(xml).toContain('hreflang="x-default"');
  });

  test("Die Sitemap lässt draußen, was nicht hineingehört", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();

    // Vergangen, abgesagt, beendet — und der einzelne Serientermin, den die
    // Serienseite vertritt.
    expect(xml).not.toContain(adressen.vergangen);
    expect(xml).not.toContain(adressen.abgesagt);
    expect(xml).not.toContain(adressen.serieBeendet);
    expect(xml).not.toContain(adressen.termin);

    // Und nichts, was eine Anmeldung verlangt.
    for (const bereich of ["/profil", "/mein-bereich", "/admin", "/checkin", "/rechnungen"]) {
      expect(xml).not.toContain(`<loc>${bereich}`);
      expect(xml).not.toContain(`${bereich}</loc>`);
    }
  });

  test("Die Sitemap bildet Änderungen ohne Zutun ab", async ({ request }) => {
    const vorher = await (await request.get("/sitemap.xml")).text();
    expect(vorher).toContain(adressen.kommend);

    await service.from("events").update({ status: "abgesagt" }).eq("slug", adressen.kommend);
    const nachher = await (await request.get("/sitemap.xml")).text();
    expect(nachher).not.toContain(adressen.kommend);

    await service.from("events").update({ status: "geplant" }).eq("slug", adressen.kommend);
    const wieder = await (await request.get("/sitemap.xml")).text();
    expect(wieder).toContain(adressen.kommend);
  });

  test("Die öffentlichen Seiten außerhalb der Events bleiben aus dem Index", async ({ page }) => {
    for (const pfad of ["/", "/kurse", "/stundenplan", "/login", "/registrieren", "/agb", "/datenschutz", "/impressum"]) {
      expect(await robotsAngabe(page, pfad), `${pfad} müsste noindex sagen`).toContain("noindex");
    }
  });

  test("Eine kommende Eventseite gehört in den Index — mit Sprachverknüpfung", async ({ page }) => {
    await gehZu(page, `/events/${adressen.kommend}`);
    expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("index");
    expect(await page.locator('meta[name="robots"]').getAttribute("content")).not.toContain("noindex");

    const kanonisch = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(kanonisch).toContain(`/events/${adressen.kommend}`);
    expect(kanonisch).not.toContain("/en/");

    const sprachen = page.locator('link[rel="alternate"]');
    await expect(sprachen).toHaveCount(3);
    expect(await sprachen.nth(1).getAttribute("href")).toContain(`/en/events/${adressen.kommend}`);
    // Wessen Sprache Google nicht zuordnen kann, landet auf Deutsch.
    const vorgabe = page.locator('link[hreflang="x-default"]');
    expect(await vorgabe.getAttribute("href")).not.toContain("/en/");
  });

  test("Die englische Fassung verweist auf sich selbst, nicht auf die deutsche", async ({ page }) => {
    // Andersherum verschwände die englische Fassung aus dem Index.
    await gehZu(page, `/en/events/${adressen.kommend}`);
    const kanonisch = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(kanonisch).toContain(`/en/events/${adressen.kommend}`);
  });

  test("Vergangene, abgesagte und Serientermin-Seiten bleiben erreichbar, aber draußen", async ({ page }) => {
    for (const adresse of [adressen.vergangen, adressen.abgesagt, adressen.termin]) {
      await gehZu(page, `/events/${adresse}`);
      // Erreichbar: Ein geteilter Link soll nicht ins Leere laufen.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.locator('meta[name="robots"]').getAttribute("content"),
        `${adresse} müsste noindex sagen`
      ).toContain("noindex");
    }
  });

  test("Eine beendete Serie bleibt erreichbar, aber draußen", async ({ page }) => {
    await gehZu(page, `/events/${adressen.serieBeendet}`);
    await expect(page.getByRole("heading", { level: 1, name: "E2E57 Beendete Serie" })).toBeVisible();
    expect(await page.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
  });

  test("Eine indexierte Seite trägt Titel und Beschreibung für die Vorschau", async ({ page }) => {
    await gehZu(page, `/events/${adressen.kommend}`);
    expect(await page.title()).toContain("E2E57 Kommendes Event");
    expect(await page.locator('meta[name="description"]').getAttribute("content")).toBeTruthy();
    expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toBe("E2E57 Kommendes Event");
    // Ohne Titelbild bleibt die Angabe weg statt kaputt zu sein.
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
  });
});
