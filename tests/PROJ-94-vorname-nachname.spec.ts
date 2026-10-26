import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gehZu } from "./navigation";
import { ladeTestUmgebung } from "./env";

/**
 * PROJ-94: Vor- und Nachname sind bei der Registrierung Pflicht.
 *
 * Geprüft wird beides: dass ohne sie kein Konto entsteht, und dass der Name
 * mit **einer** Registrierung im Profil landet — ohne dass der Kunde ihn
 * danach noch einmal eintragen muss. Letzteres ist der Punkt, an dem die
 * Metadaten der Anmeldung entscheiden; ein nachträgliches Speichern hätte
 * scheitern können.
 */

try {
  ladeTestUmgebung();
} catch {
  // Schon geladen — unkritisch.
}

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const OHNE_NAMEN = "proj94-ohne-namen@viennasalsastudio.test";
const MIT_NAMEN = "proj94-mit-namen@viennasalsastudio.test";

async function kontoWeg(mail: string): Promise<void> {
  const { data } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const konto = data?.users.find((u) => u.email === mail);
  if (konto) await service.auth.admin.deleteUser(konto.id);
}

async function kontoVon(mail: string) {
  const { data } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users.find((u) => u.email === mail) ?? null;
}

test.beforeAll(async () => {
  await kontoWeg(OHNE_NAMEN);
  await kontoWeg(MIT_NAMEN);
});

test.afterAll(async () => {
  await kontoWeg(OHNE_NAMEN);
  await kontoWeg(MIT_NAMEN);
});

test.describe("PROJ-94: Name bei der Registrierung", () => {
  test("Ohne Nachnamen entsteht kein Konto", async ({ page }) => {
    await gehZu(page, "/registrieren");
    // Erst hydrieren lassen — siehe docs/troubleshooting-tests.md.
    await page.waitForTimeout(1200);
    await page.getByLabel("Vorname").fill("QA");
    await page.getByLabel("E-Mail").fill(OHNE_NAMEN);
    await page.getByLabel("Passwort").fill("CorrectPassword123!");
    await page.getByRole("button", { name: "Registrieren" }).click();
    await page.waitForTimeout(1500);

    await expect(page.getByText("Bitte gib deinen Nachnamen an")).toBeVisible();
    // Und zwar wirklich nicht angelegt — nicht nur eine Meldung daneben.
    expect(await kontoVon(OHNE_NAMEN), "Das Konto wurde trotzdem angelegt").toBeNull();
  });

  test("Mit beiden Namen steht der Name danach im Profil", async ({ page }) => {
    await gehZu(page, "/registrieren");
    await page.waitForTimeout(1200);
    await page.getByLabel("Vorname").fill("Anna Maria");
    await page.getByLabel("Nachname").fill("Müller");
    await page.getByLabel("E-Mail").fill(MIT_NAMEN);
    await page.getByLabel("Passwort").fill("CorrectPassword123!");
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Registrieren" }).click();
    await expect(page.getByText(/Bitte bestätige deine E-Mail-Adresse/)).toBeVisible({
      timeout: 20000,
    });

    const konto = await kontoVon(MIT_NAMEN);
    expect(konto, "Das Konto wurde nicht angelegt").not.toBeNull();
    const { data: profil } = await service
      .from("profiles")
      .select("first_name, last_name, full_name")
      .eq("id", konto!.id)
      .single();
    // Der Name kam mit der Anmeldung mit, nicht über einen zweiten Schritt.
    expect(profil!.first_name).toBe("Anna Maria");
    expect(profil!.last_name).toBe("Müller");
    expect(profil!.full_name).toBe("Anna Maria Müller");
  });

  test("Auf der englischen Seite sind Felder und Meldung englisch", async ({ page }) => {
    await gehZu(page, "/en/registrieren");
    await page.waitForTimeout(1200);
    await expect(page.getByLabel("First name")).toBeVisible();
    await expect(page.getByLabel("Last name")).toBeVisible();

    await page.getByLabel("First name").fill("QA");
    await page.getByLabel(/e-?mail/i).fill(OHNE_NAMEN);
    await page.getByLabel(/^Password$/).fill("CorrectPassword123!");
    await page.getByRole("button", { name: /Register|Sign up|Create account/ }).first().click();
    await page.waitForTimeout(1500);

    await expect(page.getByText("Please enter your last name")).toBeVisible();
  });
});
