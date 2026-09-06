import { test, expect, type Page } from "@playwright/test";
import { gehZu } from "./navigation";
import { createClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";

ladeTestUmgebung();

const ADMIN = { email: "e2e8-admin@viennasalsastudio.test", password: "CorrectPassword123!" };
const KUNDE = { email: "e2e8-customer@viennasalsastudio.test", password: "CorrectPassword123!" };
const LEHRER = { email: "e2e13-lehrer-a@viennasalsastudio.test", password: "CorrectPassword123!" };

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

test.use({ locale: "de-DE" });

/**
 * Eigene Buchungen statt der Vorgabedaten.
 *
 * Die offenen Buchungen der Testdatenbank gehören PROJ-8, PROJ-41 und
 * PROJ-42. Würde diese Datei sie bestätigen oder ablehnen, führen jene Suiten
 * ins Leere — und die Fehlersuche endet bei der falschen Ursache. Diese
 * Prüfungen legen deshalb eigene an und räumen sie restlos weg, samt der Abos,
 * die beim Bestätigen entstehen.
 */
const KENNUNG = "PROJ48-Pruefung";

let kursId = "";
let kursName = "";
let kundenIds: string[] = [];

async function aufraeumen() {
  const { data: buchungen } = await svc
    .from("course_bookings")
    .select("id, subscription_id")
    .eq("note", KENNUNG);

  const aboIds = (buchungen ?? []).map((b) => b.subscription_id).filter(Boolean) as string[];
  await svc.from("course_bookings").delete().eq("note", KENNUNG);
  if (aboIds.length > 0) await svc.from("subscriptions").delete().in("id", aboIds);
  // Abos, die der Stapel angelegt hat, hängen am Kunden — nicht an der Notiz.
  await svc.from("subscriptions").delete().eq("name", KENNUNG);
}

test.beforeAll(async () => {
  const { data: kurs } = await svc
    .from("courses")
    .select("id, name, price")
    .not("price", "is", null)
    .limit(1)
    .single();
  if (!kurs) throw new Error("Kein Kurs mit Preis in der Testdatenbank");
  kursId = kurs.id;
  kursName = kurs.name;

  // Kunden, die in keiner anderen Testdatei vorkommen.
  //
  // Hier stand zuerst „E2E12%" mit der Bemerkung, das seien unbeteiligte
  // Konten. Das war falsch: Es sind die Wartelisten-Fixtures von PROJ-12, und
  // sie werden in fünf Testdateien benutzt. Die Stapelbestätigung legt ihnen
  // aktive Abos an — genau der Zustand, den PROJ-12 prüft.
  //
  // Diese drei sind namentlich gewählt statt über ein Muster: Ein Muster fängt
  // beim nächsten neuen Konto stillschweigend etwas Fremdes mit ein.
  //
  // Geprüft nach Name **und** E-Mail. Der erste Versuch nahm „E2E16 Customer",
  // weil der Name in keiner Testdatei vorkam — PROJ-16 spricht sein Konto aber
  // über die E-Mail an. Nach nur einem der beiden zu suchen genügt nicht.
  const UNBETEILIGT = ["E2E14 Filler", "E2E17 Filler", "E2E26 Filler"];
  const { data: profile } = await svc
    .from("profiles")
    .select("id, full_name")
    .in("full_name", UNBETEILIGT);
  if (!profile || profile.length < UNBETEILIGT.length) {
    throw new Error(
      `Testkunden fehlen: erwartet ${UNBETEILIGT.join(", ")}, gefunden ${(profile ?? [])
        .map((p) => p.full_name)
        .join(", ")}`
    );
  }
  kundenIds = profile.map((p) => p.id);

  await aufraeumen();
});

/**
 * Vor jeder Prüfung, nicht nur vor der ersten.
 *
 * Ohne das häufen sich die Buchungen über den Lauf hinweg an: Die vorletzte
 * Prüfung legt eine ohne Preis an, und die letzte wählt sie mit — der Stapel
 * ist dann zu Recht gesperrt, und der Fehler steht am falschen Ort. Genau
 * diese Zustandsabhängigkeit hat in diesem Projekt schon einmal eine
 * Fehlersuche in die falsche Richtung geschickt.
 */
test.beforeEach(aufraeumen);

test.afterAll(aufraeumen);

/** Legt offene Buchungen an und liefert ihre Kennungen. */
async function legeBuchungenAn(
  arten: ("regular" | "dropin")[],
  preis: number | null = 40
): Promise<string[]> {
  const zeilen = arten.map((art, i) => ({
    customer_id: kundenIds[i % kundenIds.length],
    course_id: kursId,
    type: art,
    status: "open",
    chosen_date: "2029-06-01",
    desired_plan: art === "regular" ? "single_course" : null,
    price: preis,
    note: KENNUNG,
  }));
  const { data, error } = await svc.from("course_bookings").insert(zeilen).select("id");
  if (error) throw new Error(`Buchungen anlegen: ${error.message}`);
  return (data ?? []).map((b) => b.id);
}

async function login(page: Page, creds: { email: string; password: string }) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(creds.email);
  await page.getByLabel("Passwort").fill(creds.password);
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

/** Die Zeilen dieser Prüfung — erkennbar an der Notiz in der Detailspalte. */
function eigeneZeilen(page: Page) {
  return page.locator("tr").filter({ hasText: KENNUNG });
}

/**
 * Die Stapelleiste.
 *
 * „Bestätigen" und „Ablehnen" stehen auch in jeder einzelnen Zeile — ohne
 * diese Eingrenzung trifft die Suche ein Dutzend Knöpfe.
 */
function stapelleiste(page: Page) {
  return page.getByRole("group", { name: "Stapelaktionen" });
}

/** Wählt alle Zeilen dieser Prüfung aus. */
async function waehleEigene(page: Page) {
  for (const zeile of await eigeneZeilen(page).all()) {
    await zeile.getByRole("checkbox").click();
  }
  await page.waitForTimeout(300);
}

test.describe("PROJ-48: Buchungen filtern und stapelweise bearbeiten", () => {
  test("AC Filter: die Seite öffnet auf „Offen“ und nennt, wie viel ausgeblendet ist", async ({
    page,
  }) => {
    await legeBuchungenAn(["regular", "dropin"]);

    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await expect(page.getByLabel("Status")).toContainText("Offen");
    await expect(page.getByText(/von \d+ Buchungen/)).toBeVisible();
    await expect(page.getByText(/Filter: Offen/)).toBeVisible();

    // Nur Offenes — kein einziger anderer Status in der Tabelle.
    const statusZellen = page.locator("table tbody tr");
    const anzahl = await statusZellen.count();
    expect(anzahl).toBeGreaterThan(0);
    for (let i = 0; i < anzahl; i++) {
      await expect(statusZellen.nth(i)).toContainText("Offen");
    }

    const { count: gesamt } = await svc
      .from("course_bookings")
      .select("id", { count: "exact", head: true });
    await expect(page.getByText(`${anzahl} von ${gesamt} Buchungen`)).toBeVisible();
  });

  test("AC Filter: ein anderer Status zeigt ausschließlich diesen, „Alle“ zeigt alles", async ({
    page,
  }) => {
    await login(page, ADMIN);

    await page.goto("/admin/buchungen?status=confirmed");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    const bestaetigte = page.locator("table tbody tr");
    for (let i = 0; i < (await bestaetigte.count()); i++) {
      await expect(bestaetigte.nth(i)).toContainText("Bestätigt");
    }

    await page.goto("/admin/buchungen?status=alle");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    const { count: gesamt } = await svc
      .from("course_bookings")
      .select("id", { count: "exact", head: true });
    await expect(page.locator("table tbody tr")).toHaveCount(gesamt!);
  });

  test("AC Auswahl: nur Offenes ist wählbar, „alle“ wählt die angezeigten, Filterwechsel leert", async ({
    page,
  }) => {
    await legeBuchungenAn(["regular", "dropin"]);

    await login(page, ADMIN);
    await page.goto("/admin/buchungen?status=alle");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    const { count: offene } = await svc
      .from("course_bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");

    // Erledigte Buchungen tragen kein Auswahlkästchen.
    await expect(page.locator("table tbody input[type=checkbox], table tbody button[role=checkbox]")).toHaveCount(
      offene!
    );

    await page.getByLabel("Alle angezeigten auswählen").click();
    await page.waitForTimeout(300);
    await expect(page.getByText(`${offene} Buchungen gewählt`)).toBeVisible();

    // Der Filterwechsel leert die Auswahl — sonst wirkte sie unsichtbar auf
    // eine andere Menge.
    await page.goto("/admin/buchungen?status=open");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    await expect(page.getByText(/gewählt/)).toHaveCount(0);
  });

  test("AC Vorschau: zeigt je Buchung Kunde, Abo-Name und Preis, bevor etwas geschieht", async ({
    page,
  }) => {
    const ids = await legeBuchungenAn(["regular", "regular"], 40);

    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await waehleEigene(page);
    await stapelleiste(page).getByRole("button", { name: "Bestätigen" }).click();

    await expect(page.getByRole("heading", { name: /2 Buchungen bestätigen/ })).toBeVisible();
    await expect(page.getByRole("dialog").getByText(kursName).first()).toBeVisible();
    await expect(page.getByRole("dialog").getByText("40,00").first()).toBeVisible();
    await expect(page.getByText(/Es entstehen 2 Abos/)).toBeVisible();

    // Solange nur die Vorschau offen ist, darf sich nichts geändert haben.
    const { data: unveraendert } = await svc
      .from("course_bookings")
      .select("status")
      .in("id", ids);
    expect(unveraendert!.every((b) => b.status === "open")).toBe(true);
  });

  test("AC Bestätigen: Abos entstehen mit den gezeigten Werten, Drop-ins ohne Abo", async ({
    page,
  }) => {
    const ids = await legeBuchungenAn(["regular", "dropin"], 40);

    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await waehleEigene(page);
    await stapelleiste(page).getByRole("button", { name: "Bestätigen" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Bestätigen" }).click();
    await page.waitForTimeout(3000);

    const { data: danach } = await svc
      .from("course_bookings")
      .select("id, type, status, subscription_id")
      .in("id", ids);

    expect(danach!.every((b) => b.status === "confirmed")).toBe(true);

    const anfrage = danach!.find((b) => b.type === "regular")!;
    expect(anfrage.subscription_id, "Die Anfrage braucht ein Abo").not.toBeNull();

    const { data: abo } = await svc
      .from("subscriptions")
      .select("name, price")
      .eq("id", anfrage.subscription_id!)
      .single();
    expect(abo!.name).toBe(kursName);
    expect(Number(abo!.price)).toBe(40);

    const dropin = danach!.find((b) => b.type === "dropin")!;
    expect(dropin.subscription_id, "Ein Drop-in bekommt kein Abo").toBeNull();

    // Jede bestätigte Buchung erzeugt eine Nachricht — eingereiht, nicht sofort.
    const { count: nachrichten } = await svc
      .from("notification_queue")
      .select("id", { count: "exact", head: true })
      .in("dedupe_key", ids.map((id) => `booking_status:${id}:confirmed`));
    expect(nachrichten).toBe(2);

    await svc.from("notification_queue").delete().in(
      "dedupe_key",
      ids.map((id) => `booking_status:${id}:confirmed`)
    );
  });

  test("AC Ablehnen: Rückfrage, dann Statuswechsel und Nachricht für jeden", async ({ page }) => {
    const ids = await legeBuchungenAn(["regular", "dropin"]);

    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await waehleEigene(page);
    await stapelleiste(page).getByRole("button", { name: "Ablehnen" }).click();
    await expect(page.getByRole("alertdialog").getByText(/2 Buchungen ablehnen/)).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "Ablehnen" }).click();
    await page.waitForTimeout(3000);

    const { data: danach } = await svc.from("course_bookings").select("status").in("id", ids);
    expect(danach!.every((b) => b.status === "rejected")).toBe(true);

    const { count: nachrichten } = await svc
      .from("notification_queue")
      .select("id", { count: "exact", head: true })
      .in("dedupe_key", ids.map((id) => `booking_status:${id}:rejected`));
    expect(nachrichten).toBe(2);

    await svc.from("notification_queue").delete().in(
      "dedupe_key",
      ids.map((id) => `booking_status:${id}:rejected`)
    );
  });

  test("Edge Case: eine Buchung ohne Preis blockiert den Stapel, statt ein Abo über 0 € anzulegen", async ({
    page,
  }) => {
    // Der Kurs hat einen Preis, die Buchung nicht — und `coursePrice` greift
    // nur, solange der Kurs einen trägt. Hier wird beides genommen.
    const { data: ohnePreis } = await svc
      .from("courses")
      .select("id")
      .is("price", null)
      .limit(1)
      .maybeSingle();
    test.skip(!ohnePreis, "Kein Kurs ohne Preis in der Testdatenbank");

    const { data: buchung } = await svc
      .from("course_bookings")
      .insert({
        customer_id: kundenIds[0],
        course_id: ohnePreis!.id,
        type: "regular",
        status: "open",
        chosen_date: "2029-06-01",
        desired_plan: "single_course",
        price: null,
        note: KENNUNG,
      })
      .select("id")
      .single();

    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await eigeneZeilen(page).first().getByRole("checkbox").click();
    await page.waitForTimeout(300);

    await expect(page.getByText(/fehlt ein Preis/)).toBeVisible();
    await expect(stapelleiste(page).getByRole("button", { name: "Bestätigen" })).toBeDisabled();

    const { data: unveraendert } = await svc
      .from("course_bookings")
      .select("status")
      .eq("id", buchung!.id)
      .single();
    expect(unveraendert!.status).toBe("open");
  });

  test("Edge Case: eine inzwischen bearbeitete Buchung wird übersprungen, nicht überschrieben", async ({
    page,
  }) => {
    const ids = await legeBuchungenAn(["dropin", "dropin"]);

    await login(page, ADMIN);
    await page.goto("/admin/buchungen");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    await waehleEigene(page);

    // Jemand anders war schneller — hinter dem Rücken des Bildschirms.
    await svc.from("course_bookings").update({ status: "rejected" }).eq("id", ids[0]);

    await stapelleiste(page).getByRole("button", { name: "Bestätigen" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Bestätigen" }).click();
    await page.waitForTimeout(3000);

    // Zwei Meldungen, beide gewollt: die Kurzmeldung nennt die Zahlen, die
    // Liste darunter nennt Namen und Grund. „Erledigt" allein wäre gelogen.
    await expect(page.getByText("1 Buchung bestätigt, 1 übersprungen.")).toBeVisible();
    await expect(page.getByText(/1 Buchung wurde übersprungen/)).toBeVisible();
    await expect(page.getByText(/war nicht mehr offen/)).toBeVisible();

    const { data: danach } = await svc
      .from("course_bookings")
      .select("id, status")
      .in("id", ids);
    // Die fremde Arbeit bleibt stehen, die andere ist bestätigt.
    expect(danach!.find((b) => b.id === ids[0])!.status).toBe("rejected");
    expect(danach!.find((b) => b.id === ids[1])!.status).toBe("confirmed");
  });

  test("Sicherheit: Kunde und Lehrkraft erreichen die Buchungsverwaltung nicht", async ({
    page,
  }) => {
    for (const zugang of [KUNDE, LEHRER]) {
      await login(page, zugang);
      await page.goto("/admin/buchungen");
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/login|\/$|\/mein-bereich|\/profil|\/lehrer/);
      await expect(page.getByRole("button", { name: "Alle angezeigten auswählen" })).toHaveCount(0);
    }
  });
});
