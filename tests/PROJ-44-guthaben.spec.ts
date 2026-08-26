import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
try { process.loadEnvFile(".env.local"); } catch {}
const SP = "/private/tmp/claude-501/-Users-samumamu-Documents-Programmieren-Vienna-Salsa-Studio-App/5c27567f-1050-4ac0-9f1c-beba9bd0759d/scratchpad";
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
test.use({ locale: "de-DE" });


test("PROJ-44: der Betreiber schreibt gut und zieht ab, ein Abzug ins Minus wird abgewiesen — vergeben, abziehen, Regeln", async ({ page }) => {
  const { data: users } = await svc.auth.admin.listUsers({ perPage: 200 });
  const kunde = users.users.find((u) => u.email === "e2e12-a@viennasalsastudio.test")!.id;
  await svc.from("customer_credits").delete().eq("customer_id", kunde);

  await page.goto("/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill("e2e8-admin@viennasalsastudio.test");
  await page.getByLabel("Passwort").fill("CorrectPassword123!");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(/\/(profil|admin)$/, { timeout: 15000 });

  await page.goto("/admin/kunden/" + kunde);
  await page.waitForTimeout(1500);
  await expect(page.getByRole("heading", { name: "Guthaben" })).toBeVisible();

  // Ohne Grund: beide Knöpfe gesperrt
  await page.locator("#credit-amount").fill("20");
  await page.waitForTimeout(300);
  await expect(page.getByRole("button", { name: "Gutschreiben" })).toBeDisabled();

  await page.locator("#credit-reason").fill("Ausgleich Kursausfall 12.03.");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Gutschreiben" }).click();
  await page.waitForTimeout(2500);
  await expect(page.getByText("€ 20,00").first()).toBeVisible();
  await page.locator("h3:has-text('Guthaben') + div").screenshot({ path: SP + "/B1-guthaben-admin.png" });

  // Mehr abziehen als da ist -> muss abgewiesen werden
  await page.locator("#credit-amount").fill("50");
  await page.locator("#credit-reason").fill("Zu viel abziehen");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Abziehen" }).click();
  await page.waitForTimeout(2000);
  await expect(page.getByText("So viel Guthaben hat dieser Kunde nicht.")).toBeVisible();

  const { data: nachher } = await svc.from("customer_credits").select("amount").eq("customer_id", kunde);
  console.log("Verlaufszeilen:", nachher!.length, "| Summe:", nachher!.reduce((s, c) => s + Number(c.amount), 0));
  expect(nachher!.length).toBe(1);

  await svc.from("customer_credits").delete().eq("customer_id", kunde);
});

test("PROJ-44: der Kunde sieht Kontostand, Grund und den Hinweis auf die Verrechnung", async ({ page }) => {
  const { data: users } = await svc.auth.admin.listUsers({ perPage: 200 });
  const kunde = users.users.find((u) => u.email === "e2e12-a@viennasalsastudio.test")!.id;
  await svc.from("customer_credits").delete().eq("customer_id", kunde);
  await svc.from("customer_credits").insert({ customer_id: kunde, amount: 30, origin: "manual", reason: "Ausgleich Kursausfall 12.03." });

  await page.goto("/login");
  await page.waitForTimeout(1200);
  await page.getByLabel("E-Mail").fill("e2e12-a@viennasalsastudio.test");
  await page.getByLabel("Passwort").fill("CorrectPassword123!");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL(/\/profil$/, { timeout: 15000 });
  await page.waitForTimeout(1200);

  await page.getByRole("button", { name: "Empfehlen und Guthaben" }).click();
  await page.waitForTimeout(900);
  await expect(page.getByText("€ 30,00").first()).toBeVisible();
  expect(await page.getByText("€ 30,00").count()).toBe(2); // Kontostand + Verlaufszeile
  await expect(page.getByText("Ausgleich Kursausfall 12.03.")).toBeVisible();
  await expect(page.getByText("Eine Auszahlung ist nicht möglich")).toBeVisible();
  await page.screenshot({ path: SP + "/B2-guthaben-kunde.png", fullPage: true });

  await svc.from("customer_credits").delete().eq("customer_id", kunde);
});

test.describe("Guthaben englisch und Vorzeichen", () => {
  test.use({ locale: "en-GB" });
  test("PROJ-44: englische Ansicht mit englischem Format und korrektem Vorzeichen", async ({ page }) => {
    const { data: users } = await svc.auth.admin.listUsers({ perPage: 200 });
    const kunde = users.users.find((u) => u.email === "e2e12-a@viennasalsastudio.test")!.id;
    await svc.from("customer_credits").delete().eq("customer_id", kunde);
    await svc.from("customer_credits").insert([
      { customer_id: kunde, amount: 50, origin: "manual", reason: "Goodwill for cancelled class" },
      { customer_id: kunde, amount: -20, origin: "manual", reason: "Correction of a duplicate grant" },
    ]);

    await page.goto("/en/login");
    await page.waitForTimeout(1500);
    await page.getByLabel(/e-?mail/i).fill("e2e12-a@viennasalsastudio.test");
    await page.getByLabel(/password|passwort/i).fill("CorrectPassword123!");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /Log in|Einloggen/ }).click();
    await page.waitForURL(/\/profil$/, { timeout: 15000 });
    await page.waitForTimeout(1200);
    expect(page.url()).toContain("/en/");

    await page.getByRole("button", { name: "Refer a friend & credit" }).click();
    await page.waitForTimeout(900);
    const abschnitt = page.locator("div[data-state=open]").filter({ hasText: "cannot be paid out" }).last();
    await expect(abschnitt.getByText("Correction of a duplicate grant")).toBeVisible();
    await expect(abschnitt.getByText("Goodwill for cancelled class")).toBeVisible();
    console.log("TEXTE:", (await abschnitt.innerText()).replace(/\n/g, " | "));
    await abschnitt.screenshot({ path: SP + "/B3-guthaben-en.png" });

    await svc.from("customer_credits").delete().eq("customer_id", kunde);
  });
});
