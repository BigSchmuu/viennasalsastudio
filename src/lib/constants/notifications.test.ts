import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { notificationEventTypeLabel } from "./notifications";

/**
 * Jede Benachrichtigungsart braucht eine Beschriftung.
 *
 * Die erlaubten Arten stehen in einer CHECK-Bedingung an `notification_queue`
 * und wachsen mit jedem neuen Anlass (zuletzt `kursumwandlung`). Fehlt dann
 * die Beschriftung, steht in der Liste „Nicht zugestellt" der technische
 * Schlüssel — unauffällig genug, dass es niemandem auffällt.
 *
 * Die Wahrheit steht in der Migration, nicht in einer zweiten Liste hier:
 * Zwei gepflegte Listen laufen auseinander.
 */
function erlaubteEreignisarten(): string[] {
  const ordner = join(process.cwd(), "supabase", "migrations");
  const dateien = readdirSync(ordner)
    .filter((n) => n.endsWith(".sql"))
    .sort();

  let letzte: string[] = [];
  for (const name of dateien) {
    const inhalt = readFileSync(join(ordner, name), "utf8");
    const treffer = inhalt.match(
      /notification_queue_event_type_check[\s\S]*?check\s*\(\s*event_type\s*(?:=\s*any\s*\(\s*array|in\s*\()([\s\S]*?)\]?\s*\)\s*\)/i
    );
    if (treffer) {
      letzte = [...treffer[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    }
  }
  return letzte;
}

describe("notificationEventTypeLabel", () => {
  const arten = erlaubteEreignisarten();

  it("findet die Liste der erlaubten Arten überhaupt", () => {
    // Ohne diese Zusicherung wäre der Test unten wertlos: Eine leere Liste
    // bestünde jede Prüfung.
    expect(arten.length, "CHECK-Liste in den Migrationen nicht gefunden").toBeGreaterThan(5);
    expect(arten).toContain("kursumwandlung");
  });

  it("beschriftet jede erlaubte Art", () => {
    const ohne = arten.filter((art) => !notificationEventTypeLabel[art]);
    expect(ohne, `Ohne Beschriftung: ${ohne.join(", ")}`).toEqual([]);
  });

  it("führt keine Art, die es nicht mehr gibt", () => {
    const ueberzaehlig = Object.keys(notificationEventTypeLabel).filter((k) => !arten.includes(k));
    expect(ueberzaehlig, `Nicht mehr erlaubt: ${ueberzaehlig.join(", ")}`).toEqual([]);
  });
});
