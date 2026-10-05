import { describe, it, expect, vi, beforeEach } from "vitest";

// Was die beiden Verbindungen tun — getrennt beobachtbar, weil genau ihre
// Verwechslung der Fehler ist, den dieser Test verhindern soll.
const sitzungAnmelden = vi.fn();
const sitzungUpdateUser = vi.fn();
const sitzungSignOut = vi.fn();
const sitzungGetUser = vi.fn();
const pruefAnmelden = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: (...a: unknown[]) => sitzungGetUser(...a),
      signInWithPassword: (...a: unknown[]) => sitzungAnmelden(...a),
      updateUser: (...a: unknown[]) => sitzungUpdateUser(...a),
      signOut: (...a: unknown[]) => sitzungSignOut(...a),
    },
  })),
}));
vi.mock("@/lib/supabase/pruefung", () => ({
  createPruefClient: vi.fn(() => ({
    auth: { signInWithPassword: (...a: unknown[]) => pruefAnmelden(...a) },
  })),
}));

function formular(felder: Partial<Record<string, string>> = {}) {
  const formData = new FormData();
  formData.set("currentPassword", felder.currentPassword ?? "Altes2026");
  formData.set("password", felder.password ?? "Neues2026");
  formData.set("confirmPassword", felder.confirmPassword ?? felder.password ?? "Neues2026");
  return formData;
}

describe("passwortAendern (PROJ-73)", () => {
  beforeEach(() => {
    sitzungGetUser.mockReset().mockResolvedValue({
      data: { user: { id: "konto-1", email: "tanz@example.test" } },
    });
    sitzungAnmelden.mockReset();
    sitzungUpdateUser.mockReset().mockResolvedValue({ error: null });
    sitzungSignOut.mockReset().mockResolvedValue({ error: null });
    pruefAnmelden.mockReset().mockResolvedValue({ error: null });
  });

  it("setzt das neue Passwort und meldet andere Geräte ab", async () => {
    const { passwortAendern } = await import("./passwort-aendern");
    expect(await passwortAendern(formular())).toEqual({ success: true });

    expect(sitzungUpdateUser).toHaveBeenCalledWith({ password: "Neues2026" });
    expect(sitzungSignOut).toHaveBeenCalledWith({ scope: "others" });
  });

  // Der Kern der Sache: Würde das aktuelle Passwort über die Verbindung mit den
  // Sitzungscookies geprüft, bekäme das Konto eine frische Anmeldung auf der
  // ersten Stufe — ein Verwaltungskonto landete mitten im Speichern auf der
  // Code-Seite (PROJ-58) und hätte danach sein altes Passwort.
  it("prüft das aktuelle Passwort über die cookie-freie Verbindung", async () => {
    const { passwortAendern } = await import("./passwort-aendern");
    await passwortAendern(formular());

    expect(pruefAnmelden).toHaveBeenCalledWith({
      email: "tanz@example.test",
      password: "Altes2026",
    });
    expect(sitzungAnmelden).not.toHaveBeenCalled();
  });

  it("nennt ein falsches aktuelles Passwort als solches und ändert nichts", async () => {
    pruefAnmelden.mockResolvedValue({ error: { code: "invalid_credentials" } });
    const { passwortAendern } = await import("./passwort-aendern");

    expect(await passwortAendern(formular())).toEqual({ error: "errCurrentPasswordWrong" });
    expect(sitzungUpdateUser).not.toHaveBeenCalled();
    expect(sitzungSignOut).not.toHaveBeenCalled();
  });

  // Sonst tippt jemand dasselbe richtige Passwort immer wieder ein.
  it("unterscheidet ein erreichtes Limit von einem falschen Passwort", async () => {
    pruefAnmelden.mockResolvedValue({ error: { code: "over_request_rate_limit" } });
    const { passwortAendern } = await import("./passwort-aendern");

    expect(await passwortAendern(formular())).toEqual({ error: "errRequestRateLimit" });
  });

  it("sagt verständlich, wenn das neue Passwort dem alten gleicht", async () => {
    sitzungUpdateUser.mockResolvedValue({ error: { code: "same_password" } });
    const { passwortAendern } = await import("./passwort-aendern");

    expect(await passwortAendern(formular())).toEqual({ error: "errSamePassword" });
    expect(sitzungSignOut).not.toHaveBeenCalled();
  });

  it("gibt ein schwaches Passwort als solches zurück", async () => {
    sitzungUpdateUser.mockResolvedValue({ error: { code: "weak_password" } });
    const { passwortAendern } = await import("./passwort-aendern");

    expect(await passwortAendern(formular())).toEqual({ error: "weakPassword" });
  });

  it("bleibt erfolgreich, wenn nur das Abmelden der anderen Geräte scheitert", async () => {
    // Das Passwort ist zu diesem Zeitpunkt schon geändert. „Fehlgeschlagen"
    // verleitete zum zweiten Versuch — und der scheiterte am alten Passwort.
    sitzungSignOut.mockResolvedValue({ error: { code: "unexpected_failure", status: 500 } });
    const fehlerLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const { passwortAendern } = await import("./passwort-aendern");

    expect(await passwortAendern(formular())).toEqual({ success: true });
    expect(fehlerLog).toHaveBeenCalled();
    fehlerLog.mockRestore();
  });

  it("verlangt eine neue Anmeldung, wenn die Sitzung abgelaufen ist", async () => {
    sitzungGetUser.mockResolvedValue({ data: { user: null } });
    const { passwortAendern } = await import("./passwort-aendern");

    expect(await passwortAendern(formular())).toEqual({ error: "errSessionExpired" });
    expect(pruefAnmelden).not.toHaveBeenCalled();
    expect(sitzungUpdateUser).not.toHaveBeenCalled();
  });

  it("weist ein zu kurzes neues Passwort ab, ohne Supabase zu fragen", async () => {
    const { passwortAendern } = await import("./passwort-aendern");

    expect(await passwortAendern(formular({ password: "kurz" }))).toEqual({
      error: "passwordHint",
    });
    expect(pruefAnmelden).not.toHaveBeenCalled();
    expect(sitzungUpdateUser).not.toHaveBeenCalled();
  });

  it("weist eine abweichende Wiederholung ab", async () => {
    const { passwortAendern } = await import("./passwort-aendern");

    expect(
      await passwortAendern(formular({ password: "Neues2026", confirmPassword: "Neues2027" }))
    ).toEqual({ error: "valPasswordsDiffer" });
    expect(sitzungUpdateUser).not.toHaveBeenCalled();
  });

  it("weist ein leeres aktuelles Passwort ab", async () => {
    const { passwortAendern } = await import("./passwort-aendern");

    expect(await passwortAendern(formular({ currentPassword: "" }))).toEqual({
      error: "valPasswordRequired",
    });
    expect(pruefAnmelden).not.toHaveBeenCalled();
  });
});
