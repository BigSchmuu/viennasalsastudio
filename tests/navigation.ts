import type { Page } from "@playwright/test";

/**
 * Navigieren, nachdem die Anwendung selbst navigiert hat.
 *
 * Nach einer Buchung, einem Ticketkauf oder einer Absage lädt die Seite sich
 * nach. Fährt der Test im selben Moment woandershin, bricht Playwright eine
 * der beiden Navigationen ab: „interrupted by another navigation". Auf WebKit
 * passiert das regelmäßig, auf Chromium fast nie.
 *
 * Erst versucht: vor der eigenen Navigation auf `networkidle` warten. Das
 * reichte im Einzellauf, im Volllauf aber nicht — unter Last kommt die
 * Nachlade-Navigation der Anwendung gelegentlich erst nach der Wartefrist.
 * Deshalb jetzt umgekehrt: kommt sie dazwischen, wird sie abgewartet und der
 * eigene Aufruf wiederholt. Nur genau dieser Fehler wird geschluckt.
 */
export async function gehZu(page: Page, pfad: string, versuche = 3): Promise<void> {
  for (let i = 0; i < versuche; i++) {
    try {
      await page.goto(pfad);
      return;
    } catch (fehler) {
      const ueberholt = String(fehler).includes("interrupted by another navigation");
      if (!ueberholt || i === versuche - 1) throw fehler;
      await page.waitForTimeout(700);
    }
  }
}
