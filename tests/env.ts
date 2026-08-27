import { existsSync, readFileSync } from "node:fs";

/** Die Produktionsdatenbank. Hier steht sie nur, um sie auszuschließen. */
const PRODUKTION_REF = "kqdnaevyzgtrmaatinrx";

/**
 * Lädt die Zugangsdaten für die **Testdatenbank**.
 *
 * Die Tests legen Kunden an, buchen Kurse, erzeugen Lastschriftläufe samt
 * Rechnungen und räumen wieder auf. Solange das gegen die Produktion lief,
 * war das Aufräumarbeit — mit echten Mandaten erzeugt derselbe Lauf eine
 * echte Bankdatei mit echten Abbuchungen.
 *
 * Zwei Vorkehrungen, beide bewusst laut:
 *
 * Fehlt `.env.test`, brechen die Tests ab. Ein stiller Rückfall auf
 * `.env.local` wäre genau der Unfall, den diese Datei verhindern soll.
 *
 * Und zeigt `.env.test` trotzdem auf die Produktion — vertippt, kopiert,
 * versehentlich —, brechen sie ebenfalls ab.
 */
export function ladeTestUmgebung(): void {
  if (!existsSync(".env.test")) {
    throw new Error(
      "tests: .env.test fehlt. Die Tests laufen ausschließlich gegen die " +
        "Testdatenbank — siehe .env.test.example. Kein Rückfall auf .env.local."
    );
  }

  // Bewusst nicht process.loadEnvFile: das überschreibt bereits gesetzte
  // Variablen *nicht*. Wer vorher .env.local geladen hat — die
  // Vitest-Konfiguration tut genau das — behielte damit stillschweigend die
  // Produktionsdaten. Hier gewinnt .env.test immer.
  for (const zeile of readFileSync(".env.test", "utf8").split("\n")) {
    const treffer = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(zeile);
    if (!treffer) continue;
    const wert = treffer[2].trim().replace(/^["']|["']$/g, "");
    process.env[treffer[1]] = wert;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (url.includes(PRODUKTION_REF)) {
    throw new Error(
      "tests: .env.test zeigt auf die Produktionsdatenbank. Abbruch — ein " +
        "Testlauf dort kann echte Lastschriften erzeugen."
    );
  }
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("tests: .env.test ist unvollständig (URL oder Service-Role-Key fehlt).");
  }
}
