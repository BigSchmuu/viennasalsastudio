import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FailedDeliveries, type FehlgeschlageneSendung } from "./failed-deliveries";

/**
 * Die drei Zustände von „Nicht zugestellt" (PROJ-16).
 *
 * Vorher hing der Leerzustand an einem E2E-Test, der sich selbst übersprang,
 * sobald irgendwo in der Testdatenbank ein Fehlschlag lag — und dort liegen
 * Tausende, weil ohne Mailserver jede Sendung scheitert. Der Test war damit
 * dauerhaft übersprungen und bewachte nichts (aufgefallen im Volllauf vom
 * 2026-10-06). Ein Leerzustand ist reine Darstellung; hier ist er prüfbar,
 * ohne eine ganze Datenbank sauber halten zu müssen.
 */

const sendung: FehlgeschlageneSendung = {
  id: "s1",
  ereignis: "Buchungsstatus",
  kunde: "Beispielkundin",
  perEmail: "failed",
  perPush: "skipped",
  fehler: "550 mailbox unavailable",
  zeitpunkt: "2026-10-05T18:30:00Z",
};

describe("FailedDeliveries", () => {
  it("sagt „Alles zugestellt.“, wenn nichts fehlgeschlagen ist", () => {
    render(<FailedDeliveries sendungen={[]} lesefehler={false} />);
    expect(screen.getByText("Alles zugestellt.")).toBeInTheDocument();
  });

  // Der gefährlichere der beiden Zustände: Eine leere Liste nach einem
  // Lesefehler sähe aus wie „alles in Ordnung".
  it("benennt einen Lesefehler statt ihn als Entwarnung auszugeben", () => {
    render(<FailedDeliveries sendungen={[]} lesefehler={true} />);
    expect(screen.getByText(/konnte nicht geladen werden/)).toBeInTheDocument();
    expect(screen.queryByText("Alles zugestellt.")).not.toBeInTheDocument();
  });

  it("zeigt eine fehlgeschlagene Sendung mit Anlass, Grund und Weg", () => {
    render(<FailedDeliveries sendungen={[sendung]} lesefehler={false} />);
    expect(screen.getByText("Beispielkundin")).toBeInTheDocument();
    expect(screen.getByText("Buchungsstatus")).toBeInTheDocument();
    expect(screen.getByText("550 mailbox unavailable")).toBeInTheDocument();
    // Der Weg steht als Kennzeichen da — und nur der, der scheiterte.
    expect(screen.getByText("E-Mail")).toBeInTheDocument();
    expect(screen.queryByText("Push")).not.toBeInTheDocument();
    expect(screen.queryByText("Alles zugestellt.")).not.toBeInTheDocument();
  });

  it("zeigt den Lesefehler auch dann, wenn Zeilen vorliegen", () => {
    // Sonst stünde eine halbe Liste da, die aussieht wie die ganze.
    render(<FailedDeliveries sendungen={[sendung]} lesefehler={true} />);
    expect(screen.getByText(/konnte nicht geladen werden/)).toBeInTheDocument();
    expect(screen.queryByText("Beispielkundin")).not.toBeInTheDocument();
  });

  it("verträgt eine Sendung ohne Fehlertext und ohne Zeitpunkt", () => {
    render(
      <FailedDeliveries
        sendungen={[{ ...sendung, fehler: null, zeitpunkt: null, perPush: "failed" }]}
        lesefehler={false}
      />
    );
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText("Push")).toBeInTheDocument();
  });
});
