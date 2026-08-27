import { test, expect, type Page } from "@playwright/test";

const CUSTOMER = { email: "e2e16-customer@viennasalsastudio.test", password: "CorrectPassword123!" };

async function login(page: Page, { email, password }: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.waitForTimeout(1000); // let hydration settle, see PROJ-2 BUG-1
  await page.getByRole("button", { name: "Einloggen" }).click();
  // Admin lands on /admin after login, every other role on /profil.
  await page.waitForURL(/\/(mein-bereich|profil|admin)$/, { timeout: 10000 });
}

test.describe("PROJ-16: Automatische E-Mail-/Push-Benachrichtigungen", () => {
  test("AC6: Profil zeigt Abschnitt 'Benachrichtigungen' mit 4 Ereignisgruppen x E-Mail/Push", async ({
    page,
  }) => {
    await login(page, CUSTOMER);
    // /profil's sections live behind a collapsed Accordion (Radix unmounts
    // closed content entirely) — must click the trigger, not just scroll to
    // it, before any switch/columnheader inside is in the DOM.
    await page.getByRole("button", { name: "Benachrichtigungen" }).click();
    await page.waitForTimeout(400);

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
    // /profil's sections live behind a collapsed Accordion (Radix unmounts
    // closed content entirely) — must click the trigger, not just scroll to
    // it, before any switch/columnheader inside is in the DOM.
    await page.getByRole("button", { name: "Benachrichtigungen" }).click();
    await page.waitForTimeout(400);

    // Not every browser offers the Push API — Playwright's WebKit does not.
    // The app handles that with its own state ("wird von diesem Browser nicht
    // unterstützt"), so asserting the activate button unconditionally would
    // fail on correct behaviour. Either way the push switch must stay locked
    // and e-mail must remain usable, which is what this criterion is about.
    const unsupported = page.getByText("Push-Benachrichtigungen werden von diesem Browser nicht unterstützt");
    if (await unsupported.isVisible().catch(() => false)) {
      await expect(page.getByRole("button", { name: "Push-Benachrichtigungen aktivieren" })).toHaveCount(0);
    } else {
      await expect(page.getByRole("button", { name: "Push-Benachrichtigungen aktivieren" })).toBeVisible();
    }

    const pushSwitch = page.getByRole("switch", { name: "Buchungsstatus — Push" });
    await expect(pushSwitch).toBeDisabled();
    const emailSwitch = page.getByRole("switch", { name: "Buchungsstatus — E-Mail" });
    await expect(emailSwitch).toBeEnabled();
  });

  test("Einstellungs-Umschalten persistiert nach Neuladen", async ({ page }) => {
    await login(page, CUSTOMER);
    // /profil's sections live behind a collapsed Accordion (Radix unmounts
    // closed content entirely) — must click the trigger, not just scroll to
    // it, before any switch/columnheader inside is in the DOM.
    await page.getByRole("button", { name: "Benachrichtigungen" }).click();
    await page.waitForTimeout(400);

    const emailSwitch = page.getByRole("switch", { name: "Warteliste rückt nach — E-Mail" });
    await expect(emailSwitch).toHaveAttribute("data-state", "checked");
    // The switch updates optimistically, so asserting its state says nothing
    // about whether the save landed. Reloading right away cancels the request
    // on a slower engine, and the setting then legitimately comes back
    // unchanged — the test would blame persistence for a race it caused
    // itself. (Verified separately: the write does reach the database on
    // WebKit.) So wait for the server action's response, not for a vague
    // network idle.
    const saved = page.waitForResponse((r) => r.request().method() === "POST" && r.status() < 400);
    await emailSwitch.click();
    await expect(emailSwitch).toHaveAttribute("data-state", "unchecked");
    await saved;

    await page.reload();
    // /profil's sections live behind a collapsed Accordion (Radix unmounts
    // closed content entirely) — must click the trigger, not just scroll to
    // it, before any switch/columnheader inside is in the DOM.
    await page.getByRole("button", { name: "Benachrichtigungen" }).click();
    await page.waitForTimeout(400);
    await expect(page.getByRole("switch", { name: "Warteliste rückt nach — E-Mail" })).toHaveAttribute(
      "data-state",
      "unchecked"
    );

    // Reset to default for repeatable runs. The switch is optimistic (see
    // notification-settings-section.tsx), so the assertion above passes
    // instantly even before the server-side upsert completes — without this
    // wait, the test could close the page while that write is still in
    // flight and leave the fixture toggled off for the next run.
    await page.getByRole("switch", { name: "Warteliste rückt nach — E-Mail" }).click();
    await expect(page.getByRole("switch", { name: "Warteliste rückt nach — E-Mail" })).toHaveAttribute(
      "data-state",
      "checked"
    );
    await page.waitForTimeout(800);
  });
});
