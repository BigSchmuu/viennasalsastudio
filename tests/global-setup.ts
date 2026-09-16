import { richteVerwaltungskontenEin } from "./zweite-stufe";

/**
 * Einmal vor der gesamten Suite (PROJ-58).
 *
 * Die Zugangsdaten hat playwright.config.ts über `ladeTestUmgebung()` bereits
 * geladen — samt der Absicherung, dass sie nicht auf die Produktion zeigen.
 */
export default async function globalSetup(): Promise<void> {
  await richteVerwaltungskontenEin();
}
