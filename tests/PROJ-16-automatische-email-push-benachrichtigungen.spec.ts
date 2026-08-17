import { test, expect, type Page } from "@playwright/test";

const CUSTOMER = { email: "e2e16-customer@viennasalsastudio.test", password: "CorrectPassword123!" };

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL("**/profil", { timeout: 10000 });
}

test.describe("PROJ-16: Automatische E-Mail-/Push-Benachrichtigungen", () => {
  test("AC6: Profil zeigt Abschnitt 'Benachrichtigungen' mit 4 Ereignisgruppen x E-Mail/Push", async ({
    page,
  }) => {
    await login(page, CUSTOMER);
    const section = page.getByText("Benachrichtigungen", { exact: true }).first();
    await section.scrollIntoViewIfNeeded();

    await expect(page.getByRole("columnheader", { name: "E-Mail" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Push" })).toBeVisible();
    for (const label of ["Buchungsstatus", "Warteliste rückt nach", "Abo-Kündigung wirksam", "Kursstart-Erinnerung"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test("AC7: Ohne Push-Berechtigung erscheint ein Aktivieren-Button statt aktivierbarer Push-Schalter", async ({
    page,
  }) => {
    await login(page, CUSTOMER);
    await page.getByText("Benachrichtigungen", { exact: true }).first().scrollIntoViewIfNeeded();

    await expect(page.getByRole("button", { name: "Push-Benachrichtigungen aktivieren" })).toBeVisible();

    const pushSwitch = page.getByRole("switch", { name: "Buchungsstatus per Push" });
    await expect(pushSwitch).toBeDisabled();
    const emailSwitch = page.getByRole("switch", { name: "Buchungsstatus per E-Mail" });
    await expect(emailSwitch).toBeEnabled();
  });

  test("Einstellungs-Umschalten persistiert nach Neuladen", async ({ page }) => {
    await login(page, CUSTOMER);
    await page.getByText("Benachrichtigungen", { exact: true }).first().scrollIntoViewIfNeeded();

    const emailSwitch = page.getByRole("switch", { name: "Warteliste rückt nach per E-Mail" });
    await expect(emailSwitch).toHaveAttribute("data-state", "checked");
    await emailSwitch.click();
    await expect(emailSwitch).toHaveAttribute("data-state", "unchecked");

    await page.reload();
    await page.getByText("Benachrichtigungen", { exact: true }).first().scrollIntoViewIfNeeded();
    await expect(page.getByRole("switch", { name: "Warteliste rückt nach per E-Mail" })).toHaveAttribute(
      "data-state",
      "unchecked"
    );

    // reset to default for repeatable runs
    await page.getByRole("switch", { name: "Warteliste rückt nach per E-Mail" }).click();
    await expect(page.getByRole("switch", { name: "Warteliste rückt nach per E-Mail" })).toHaveAttribute(
      "data-state",
      "checked"
    );
  });
});
