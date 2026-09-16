import { test, expect, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ladeTestUmgebung } from "./env";
import { gehZu } from "./navigation";
import { zweiteStufeErledigen } from "./zweite-stufe";

ladeTestUmgebung();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PASSWORT = "CorrectPassword123!";
const ADMIN = "e2e14-admin@viennasalsastudio.test";
const GAST = "e2e60-gast@viennasalsastudio.test";
const LEADER = "e2e60-leader@viennasalsastudio.test";

let service: SupabaseClient;
let kursId: string;
const nutzer: Record<string, string> = {};

async function kontoAnlegen(mail: string): Promise<string> {
  const { data: alle } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const alt = alle?.users.find((u) => u.email === mail);
  if (alt) await service.auth.admin.deleteUser(alt.id);
  const { data, error } = await service.auth.admin.createUser({
    email: mail,
    password: PASSWORT,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`PROJ-60 Konto ${mail}: ${error?.message}`);
  await service.from("profiles").update({ full_name: `E2E60 ${mail.split("@")[0]}` }).eq("id", data.user.id);
  nutzer[mail] = data.user.id;
  return data.user.id;
}

async function anmelden(page: Page, mail: string) {
  await gehZu(page, "/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill(mail);
  await page.getByLabel("Passwort").fill(PASSWORT);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await zweiteStufeErledigen(page, mail);
  // Ohne dieses Warten geht es bei Kundenkonten zu früh weiter:
  // `zweiteStufeErledigen` wartet nur dort, wo es eine Code-Abfrage gibt — bei
  // einem Kunden kehrt es sofort zurück, und der nächste Aufruf landete wieder
  // auf der Anmeldeseite.
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
}

/** Ein Radix-Auswahlfeld bedienen: öffnen, Eintrag wählen. */
async function waehle(page: Page, feldId: string, eintrag: string | RegExp) {
  await page.locator(`#${feldId}`).click();
  await page.getByRole("option", { name: eintrag }).click();
}

test.beforeAll(async () => {
  service = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  await kontoAnlegen(GAST);
  await kontoAnlegen(LEADER);

  const { data: raum } = await service.from("rooms").select("id").limit(1).single();
  const { data: kurs, error } = await service
    .from("courses")
    .insert({
      name: `E2E60 Gastkurs ${Date.now()}`,
      room_id: raum!.id,
      level: "improver",
      role_query_enabled: true,
      max_role_difference: 2,
      max_participants: 20,
    })
    .select("id")
    .single();
  if (error) throw new Error(`PROJ-60 Kurs: ${error.message}`);
  kursId = kurs!.id;

  // Dienstag, damit es einen kommenden Termin gibt.
  await service.from("course_schedule").insert({
    course_id: kursId,
    weekday: 1,
    start_time: "20:00",
    end_time: "21:00",
  });
});

test.afterAll(async () => {
  await service.from("course_bookings").delete().eq("course_id", kursId);
  await service.from("guest_slots").delete().eq("course_id", kursId);
  await service.from("course_schedule").delete().eq("course_id", kursId);
  await service.from("courses").delete().eq("id", kursId);
  await service.from("guest_dancers").delete().in("customer_id", Object.values(nutzer));
  for (const kennung of Object.values(nutzer)) {
    await service.auth.admin.deleteUser(kennung).catch(() => {});
  }
});

test.beforeEach(async () => {
  await service.from("course_bookings").delete().eq("course_id", kursId);
  await service.from("guest_slots").delete().eq("course_id", kursId);
  await service.from("guest_dancers").delete().in("customer_id", Object.values(nutzer));
});

/** Eine Ausschreibung über die Verwaltungsoberfläche anlegen. */
async function ausschreibenUeberDieOberflaeche(page: Page, rolle: "Follower" | "Leader" = "Follower") {
  await gehZu(page, "/admin/gasttaenzer");
  await page.getByRole("button", { name: "Plätze ausschreiben" }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await waehle(page, "kurs", /E2E60 Gastkurs/);
  await waehle(page, "rolle", rolle);
  await dialog.getByRole("button", { name: "Ausschreiben" }).click();
  await expect(page.getByText(/Ausgeschrieben/)).toBeVisible({ timeout: 20000 });
}

test.describe("PROJ-60: Gasttänzer-Programm", () => {
  test("Kunde meldet sich mit Rolle und Level an", async ({ page }) => {
    await anmelden(page, GAST);
    await gehZu(page, "/profil#gasttaenzer");

    await waehle(page, "gast-rolle", "Follower");
    await waehle(page, "gast-level", "Advanced");
    await page.getByRole("button", { name: "Mitmachen" }).click();
    await expect(page.getByText("Du bist dabei.")).toBeVisible({ timeout: 20000 });

    const { data } = await service
      .from("guest_dancers")
      .select("dance_role, level")
      .eq("customer_id", nutzer[GAST])
      .single();
    expect(data!.dance_role).toBe("follower");
    expect(data!.level).toBe("advanced");
  });

  test("Ausschreiben geht ohne Vorschlag der App", async ({ page }) => {
    await anmelden(page, ADMIN);
    await ausschreibenUeberDieOberflaeche(page);

    const { data } = await service.from("guest_slots").select("dance_role, seats").eq("course_id", kursId);
    expect(data).toHaveLength(1);
    expect(data![0].dance_role).toBe("follower");
  });

  test("Ohne Level-Bestätigung lässt sich nicht zusagen", async ({ page }) => {
    await service
      .from("guest_dancers")
      .insert({ customer_id: nutzer[GAST], dance_role: "follower", level: "advanced" });
    await anmelden(page, ADMIN);
    await ausschreibenUeberDieOberflaeche(page);

    await anmelden(page, GAST);
    await gehZu(page, "/profil#gasttaenzer");
    await expect(page.getByText(/E2E60 Gastkurs/).first()).toBeVisible({ timeout: 20000 });

    // Der Knopf ist gesperrt, solange das Häkchen fehlt.
    await expect(page.getByRole("button", { name: "Ich springe ein" })).toBeDisabled();
  });

  test("Mit Bestätigung klappt die Zusage und steht danach unter „Zugesagt“", async ({ page }) => {
    await service
      .from("guest_dancers")
      .insert({ customer_id: nutzer[GAST], dance_role: "follower", level: "advanced" });
    await anmelden(page, ADMIN);
    await ausschreibenUeberDieOberflaeche(page);

    await anmelden(page, GAST);
    await gehZu(page, "/profil#gasttaenzer");
    await page.getByText("Ich bringe das Level für diesen Kurs mit.").click();
    await page.getByRole("button", { name: "Ich springe ein" }).click();

    // Nicht auf „Zugesagt" prüfen — so heißt auch die Überschrift des
    // Abschnitts, die immer da steht. Nach einer erfolgreichen Zusage
    // verschwindet dagegen die Einladung: Wer an dem Abend im Kurs ist,
    // bekommt keine mehr.
    await expect(page.getByText("Gerade wird niemand gesucht.")).toBeVisible({ timeout: 20000 });

    const { data } = await service
      .from("course_bookings")
      .select("type, price, status")
      .eq("course_id", kursId)
      .eq("customer_id", nutzer[GAST]);
    expect(data).toHaveLength(1);
    expect(data![0].type).toBe("guest");
    expect(Number(data![0].price)).toBe(0);
  });

  test("Wer die falsche Rolle tanzt, sieht die Einladung gar nicht", async ({ page }) => {
    await service
      .from("guest_dancers")
      .insert({ customer_id: nutzer[LEADER], dance_role: "leader", level: "advanced" });
    await anmelden(page, ADMIN);
    await ausschreibenUeberDieOberflaeche(page, "Follower");

    await anmelden(page, LEADER);
    await gehZu(page, "/profil#gasttaenzer");
    await expect(page.getByText("Gerade wird niemand gesucht.")).toBeVisible({ timeout: 20000 });
  });

  test("Zurückziehen sagt bestehende Zusagen mit ab", async ({ page }) => {
    await service
      .from("guest_dancers")
      .insert({ customer_id: nutzer[GAST], dance_role: "follower", level: "advanced" });
    await anmelden(page, ADMIN);
    await ausschreibenUeberDieOberflaeche(page);

    const { data: slot } = await service.from("guest_slots").select("id").eq("course_id", kursId).single();
    await anmelden(page, GAST);
    await gehZu(page, "/profil#gasttaenzer");
    await page.getByText("Ich bringe das Level für diesen Kurs mit.").click();
    await page.getByRole("button", { name: "Ich springe ein" }).click();
    await expect(page.getByText("Gerade wird niemand gesucht.")).toBeVisible({ timeout: 20000 });

    await anmelden(page, ADMIN);
    await gehZu(page, "/admin/gasttaenzer");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Zurückziehen" }).first().click();
    await expect(page.getByText("Ausschreibung zurückgezogen.")).toBeVisible({ timeout: 20000 });

    const { data: buchungen } = await service
      .from("course_bookings")
      .select("status")
      .eq("guest_slot_id", slot!.id);
    expect(buchungen!.every((b) => b.status === "cancelled")).toBe(true);
  });

  test("Ausgeschlossene sehen einen Hinweis statt des Formulars", async ({ page }) => {
    await service.from("guest_dancers").insert({
      customer_id: nutzer[GAST],
      dance_role: "follower",
      level: "advanced",
      excluded_at: new Date().toISOString(),
    });

    await anmelden(page, GAST);
    await gehZu(page, "/profil#gasttaenzer");
    await expect(page.getByText(/nicht freigeschaltet/)).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("button", { name: "Mitmachen" })).toHaveCount(0);
  });
});
