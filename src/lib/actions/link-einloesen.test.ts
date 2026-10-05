import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyOtp = vi.fn();
const getUser = vi.fn();
const umweg = vi.fn();
const sprachRedirect = vi.fn();
const pfadRedirect = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => ({ get: () => "https://app.viennasalsastudio.at" }),
}));
vi.mock("next-intl/server", () => ({ getLocale: async () => "de" }));
vi.mock("@/i18n/navigation", () => ({ redirect: (...a: unknown[]) => sprachRedirect(...a) }));
vi.mock("next/navigation", () => ({ redirect: (...a: unknown[]) => pfadRedirect(...a) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
      getUser: (...a: unknown[]) => getUser(...a),
    },
  }),
}));
vi.mock("@/lib/auth/zweite-stufe-weiche", () => ({
  zweiteStufeUmweg: (...a: unknown[]) => umweg(...a),
}));

function formular(next: string) {
  const formData = new FormData();
  formData.set("token_hash", "abc123");
  formData.set("type", "recovery");
  formData.set("next", next);
  return formData;
}

describe("linkEinloesen und die zweite Stufe (PROJ-73)", () => {
  beforeEach(() => {
    verifyOtp.mockReset().mockResolvedValue({ error: null });
    getUser.mockReset().mockResolvedValue({ data: { user: { id: "konto-1" } } });
    umweg.mockReset().mockResolvedValue(null);
    sprachRedirect.mockReset();
    pfadRedirect.mockReset();
  });

  it("führt ein Kundenkonto direkt zum Ziel", async () => {
    const { linkEinloesen } = await import("./link-einloesen");
    await linkEinloesen(formular("/passwort-zuruecksetzen"));

    expect(sprachRedirect).toHaveBeenCalledWith({ href: "/passwort-zuruecksetzen", locale: "de" });
    expect(pfadRedirect).not.toHaveBeenCalled();
  });

  // Der gemeldete Fall: Der Admin bestätigte seinen Code, landete im Dashboard
  // und hatte dabei den Einmal-Link verbraucht, ohne das Formular zu sehen.
  it("führt ein Verwaltungskonto über die zweite Stufe — und merkt sich das Ziel", async () => {
    umweg.mockResolvedValue("/sicherheit/code?weiter=%2Fpasswort-zuruecksetzen");
    const { linkEinloesen } = await import("./link-einloesen");
    await linkEinloesen(formular("/passwort-zuruecksetzen"));

    expect(umweg).toHaveBeenCalledWith("/passwort-zuruecksetzen");
    // Ohne Sprachebene: /sicherheit liegt neben dem Kundenbereich.
    expect(pfadRedirect).toHaveBeenCalledWith("/sicherheit/code?weiter=%2Fpasswort-zuruecksetzen");
    expect(sprachRedirect).not.toHaveBeenCalled();
  });

  it("nimmt den Umweg auch, wenn das Token schon eingelöst war und die Sitzung steht", async () => {
    // Doppelt abgeschickter Knopf: Supabase lehnt ab, angemeldet ist das Konto
    // trotzdem — dann gilt derselbe Weg wie beim ersten Mal.
    verifyOtp.mockResolvedValue({ error: { code: "otp_expired", status: 403 } });
    umweg.mockResolvedValue("/sicherheit/code?weiter=%2Fpasswort-zuruecksetzen");
    const fehlerLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const { linkEinloesen } = await import("./link-einloesen");
    await linkEinloesen(formular("/passwort-zuruecksetzen"));

    expect(pfadRedirect).toHaveBeenCalledWith("/sicherheit/code?weiter=%2Fpasswort-zuruecksetzen");
    fehlerLog.mockRestore();
  });

  it("verwirft ein fremdes Ziel, bevor es überhaupt gemerkt wird", async () => {
    const { linkEinloesen } = await import("./link-einloesen");
    await linkEinloesen(formular("https://phishing.example/konto"));

    // Nicht die fremde Adresse, sondern der Rückfall.
    expect(umweg).toHaveBeenCalledWith("/profil");
    expect(sprachRedirect).toHaveBeenCalledWith({ href: "/profil", locale: "de" });
  });
});
