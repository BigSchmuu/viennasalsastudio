import { describe, it, expect, vi, beforeEach } from "vitest";

type Konto = { id: string; email: string; email_confirmed_at: string | null };

let konten: Konto[] = [];
const supabaseSignUp = vi.fn();
const enqueueAndDispatch = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signUp: (...args: unknown[]) => supabaseSignUp(...args) },
  })),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    auth: {
      admin: {
        // Eine Momentaufnahme wie bei Supabase: Was signUp danach anlegt, steht
        // erst in der nächsten Abfrage.
        listUsers: vi.fn(async () => ({ data: { users: [...konten] }, error: null })),
      },
    },
  })),
}));
vi.mock("@/lib/notifications/dispatch", () => ({
  enqueueAndDispatch: (...args: unknown[]) => enqueueAndDispatch(...args),
}));

function formular(email: string) {
  const formData = new FormData();
  formData.set("email", email);
  formData.set("password", "Tanzen2026");
  return formData;
}

describe("signUp", () => {
  beforeEach(() => {
    konten = [];
    enqueueAndDispatch.mockReset().mockResolvedValue(undefined);
    // Wie Supabase: Nach signUp ist eine neue Adresse sofort angelegt. Hier
    // gleich bestätigt, wie bei abgeschalteter Mailbestätigung — so fällt eine
    // Suche *nach* signUp auch nicht an der Bestätigungsprüfung durch.
    supabaseSignUp.mockReset().mockImplementation(async ({ email }: { email: string }) => {
      if (!konten.some((k) => k.email === email)) {
        konten.push({ id: "eben-angelegt", email, email_confirmed_at: "2026-09-13T10:00:00Z" });
      }
      return { error: null };
    });
  });

  it("schickt einer neuen Adresse nicht „Du hast bereits ein Konto“", async () => {
    // Gemeldet am 2026-09-13: Jede Neuregistrierung bekam zwei Mails.
    const { signUp } = await import("./auth");
    expect(await signUp(formular("neu@example.test"))).toEqual({ success: true });
    expect(enqueueAndDispatch).not.toHaveBeenCalled();
  });

  it("benachrichtigt den Inhaber eines bestätigten Kontos genau einmal", async () => {
    konten.push({ id: "bestehend", email: "tanz@example.test", email_confirmed_at: "2026-08-01T10:00:00Z" });
    const { signUp } = await import("./auth");
    expect(await signUp(formular("Tanz@example.test"))).toEqual({ success: true });
    expect(enqueueAndDispatch).toHaveBeenCalledTimes(1);
    expect(enqueueAndDispatch.mock.calls[0][0]).toMatchObject({
      customerId: "bestehend",
      eventType: "konto_existiert",
    });
  });

  it("überlässt ein nie bestätigtes Konto der Bestätigungsmail von Supabase", async () => {
    konten.push({ id: "unbestaetigt", email: "halb@example.test", email_confirmed_at: null });
    const { signUp } = await import("./auth");
    expect(await signUp(formular("halb@example.test"))).toEqual({ success: true });
    expect(enqueueAndDispatch).not.toHaveBeenCalled();
  });
});
