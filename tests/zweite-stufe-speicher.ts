import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";

/**
 * Die Schlüssel der zweiten Stufe, geteilt zwischen beiden Testwelten.
 *
 * Playwright legt sie im Lauf-Aufbau an; die Datenbanktests von Vitest brauchen
 * dieselben. Als jeder für sich einen neuen Faktor anlegte, machte der eine dem
 * anderen den Schlüssel ungültig — die Browsertests blieben dann auf der
 * Code-Seite hängen. Deshalb eine gemeinsame Ablage und kein Paket, das
 * Playwright hereinzieht: Vitest darf das nicht laden.
 */

const ABLAGE = "test-results/zweite-stufe.json";

export type Schluesselablage = Record<string, string>;

export function schluessel(): Schluesselablage {
  if (!existsSync(ABLAGE)) return {};
  try {
    return JSON.parse(readFileSync(ABLAGE, "utf8")) as Schluesselablage;
  } catch {
    return {};
  }
}

export function merkeSchluessel(mail: string, geheim: string): void {
  const bestand = schluessel();
  bestand[mail] = geheim;
  mkdirSync("test-results", { recursive: true });
  writeFileSync(ABLAGE, JSON.stringify(bestand, null, 2));
}

export function setzeSchluessel(alle: Schluesselablage): void {
  mkdirSync("test-results", { recursive: true });
  writeFileSync(ABLAGE, JSON.stringify(alle, null, 2));
}
