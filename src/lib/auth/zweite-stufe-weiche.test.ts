import { describe, it, expect, vi, beforeEach } from "vitest";

const viewer = vi.fn();
const lage = vi.fn();

vi.mock("@/lib/auth/viewer", () => ({ getViewerContext: () => viewer() }));
vi.mock("@/lib/auth/zweite-stufe-lage", () => ({ zweiteStufeLage: () => lage() }));

describe("zweiteStufeUmweg (PROJ-73)", () => {
  beforeEach(() => {
    viewer.mockReset().mockResolvedValue({ isAdmin: true });
    lage.mockReset().mockResolvedValue("bestaetigen");
  });

  it("schickt ein Verwaltungskonto über die Code-Seite — mit dem Ziel im Gepäck", async () => {
    const { zweiteStufeUmweg } = await import("./zweite-stufe-weiche");
    expect(await zweiteStufeUmweg("/passwort-zuruecksetzen")).toBe(
      "/sicherheit/code?weiter=%2Fpasswort-zuruecksetzen"
    );
  });

  it("schickt ein Konto ohne eingerichtete zweite Stufe zur Einrichtung — ebenfalls mit Ziel", async () => {
    lage.mockResolvedValue("einrichten");
    const { zweiteStufeUmweg } = await import("./zweite-stufe-weiche");
    expect(await zweiteStufeUmweg("/passwort-zuruecksetzen")).toBe(
      "/sicherheit/einrichten?weiter=%2Fpasswort-zuruecksetzen"
    );
  });

  it("lässt ein Verwaltungskonto mit bestätigter zweiter Stufe direkt durch", async () => {
    lage.mockResolvedValue("erfuellt");
    const { zweiteStufeUmweg } = await import("./zweite-stufe-weiche");
    expect(await zweiteStufeUmweg("/passwort-zuruecksetzen")).toBeNull();
  });

  it("hält ein Kundenkonto gar nicht auf", async () => {
    viewer.mockResolvedValue({ isAdmin: false });
    const { zweiteStufeUmweg } = await import("./zweite-stufe-weiche");
    expect(await zweiteStufeUmweg("/passwort-zuruecksetzen")).toBeNull();
    // Für ein Kundenkonto wird die Lage nicht einmal erfragt.
    expect(lage).not.toHaveBeenCalled();
  });
});
