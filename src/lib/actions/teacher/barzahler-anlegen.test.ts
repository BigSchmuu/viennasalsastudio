import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Die Absagen beim Eintragen eines Barzahlers (PROJ-82).
 *
 * Geprüft wird, was die Aktion **verweigert** — und dass sie dabei kein Konto
 * zurücklässt. Der glückliche Fall steht im Browsertest; hier geht es um die
 * Regeln, die ich selbst gesetzt habe.
 */

const zuordnung = vi.fn();
const kurs = vi.fn();
const mitgliederZahl = vi.fn();
const createUser = vi.fn();
const deleteUser = vi.fn();
const profilUpdate = vi.fn();
const aboInsert = vi.fn();
let istAdmin = false;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/auth/require-admin-or-teacher", () => ({
  requireAdminOrTeacher: vi.fn(async () => ({
    user: { id: "lehrer-1" },
    isAdmin: istAdmin,
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: () => zuordnung() }) }),
        }),
      }),
    },
  })),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    auth: { admin: { createUser: (...a: unknown[]) => createUser(...a), deleteUser: (...a: unknown[]) => deleteUser(...a) } },
    from: (tabelle: string) => {
      if (tabelle === "courses") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => kurs() }) }) };
      }
      if (tabelle === "course_members") {
        return { select: () => ({ eq: () => mitgliederZahl() }) };
      }
      if (tabelle === "profiles") {
        return { update: (...a: unknown[]) => ({ eq: () => profilUpdate(...a) }) };
      }
      return { insert: (...a: unknown[]) => aboInsert(...a) };
    },
  }),
}));

async function anlegen(name = "Herbert K.", betrag = "50") {
  const { legeBarzahlerAn } = await import("./barzahler-anlegen");
  return legeBarzahlerAn("kurs-1", name, betrag);
}

describe("legeBarzahlerAn (PROJ-82)", () => {
  beforeEach(() => {
    istAdmin = false;
    zuordnung.mockReset().mockResolvedValue({ data: { course_id: "kurs-1" } });
    kurs.mockReset().mockResolvedValue({ data: { name: "Salsa", max_participants: null } });
    mitgliederZahl.mockReset().mockResolvedValue({ count: 0 });
    createUser.mockReset().mockResolvedValue({ data: { user: { id: "neu-1" } }, error: null });
    deleteUser.mockReset().mockResolvedValue({ error: null });
    profilUpdate.mockReset().mockResolvedValue({ error: null });
    aboInsert.mockReset().mockResolvedValue({ error: null });
  });

  it("legt Konto, Namen und Kursplatz an", async () => {
    expect(await anlegen()).toEqual({ success: true });

    // Die Adresse liegt auf der reservierten Endung — dort kommt nie Post an.
    const adresse = (createUser.mock.calls[0][0] as { email: string }).email;
    expect(adresse).toMatch(/@viennasalsastudio\.invalid$/);
    expect(profilUpdate.mock.calls[0][0]).toEqual({ full_name: "Herbert K." });
    expect(aboInsert.mock.calls[0][0]).toMatchObject({
      course_id: "kurs-1",
      status: "active",
      price: 50,
    });
  });

  it("nimmt einen Betrag mit Komma", async () => {
    await anlegen("Herbert K.", "49,50");
    expect(aboInsert.mock.calls[0][0]).toMatchObject({ price: 49.5 });
  });

  it("verweigert Namen und Beträge, die keine sind", async () => {
    expect(await anlegen("H", "50")).toEqual({
      error: "Bitte einen Namen mit mindestens zwei Zeichen angeben.",
    });
    expect(await anlegen("Herbert K.", "abc")).toEqual({
      error: "Bitte einen Betrag angeben, zum Beispiel 50 oder 49,50.",
    });
    expect(await anlegen("Herbert K.", "0")).toMatchObject({ error: expect.stringContaining("Betrag") });
    // Und zwar, bevor irgendetwas angelegt wird.
    expect(createUser).not.toHaveBeenCalled();
  });

  // Was eine Lehrkraft nicht sieht, unterrichtet sie nicht.
  it("lässt eine Lehrkraft nur für ihre eigenen Kurse eintragen", async () => {
    zuordnung.mockResolvedValue({ data: null });
    expect(await anlegen()).toEqual({ error: "Dieser Kurs gehört nicht zu deinen Kursen." });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("fragt bei der Verwaltung nicht nach der Zuordnung", async () => {
    istAdmin = true;
    zuordnung.mockResolvedValue({ data: null });
    expect(await anlegen()).toEqual({ success: true });
  });

  // Ein stillschweigend überbuchter Kurs bringt Rollenbalance und
  // Belegungsanzeige durcheinander, ohne dass jemand sieht, woher.
  it("verweigert den Platz in einem vollen Kurs — mit Zahlen", async () => {
    kurs.mockResolvedValue({ data: { name: "Salsa", max_participants: 12 } });
    mitgliederZahl.mockResolvedValue({ count: 12 });
    const ergebnis = await anlegen();
    expect(ergebnis).toMatchObject({ error: expect.stringContaining("12 von 12") });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("trägt in einen Kurs mit freiem Platz ein", async () => {
    kurs.mockResolvedValue({ data: { name: "Salsa", max_participants: 12 } });
    mitgliederZahl.mockResolvedValue({ count: 11 });
    expect(await anlegen()).toEqual({ success: true });
  });

  // Eine halbe Anlage ist schlimmer als keine: ein Konto ohne Namen ist eine
  // Zeile, die niemand zuordnet.
  it("räumt das Konto weg, wenn der Name nicht gespeichert werden kann", async () => {
    profilUpdate.mockResolvedValue({ error: { message: "kaputt" } });
    const fehlerLog = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await anlegen()).toMatchObject({ error: expect.stringContaining("nicht angelegt") });
    expect(deleteUser).toHaveBeenCalledWith("neu-1");
    fehlerLog.mockRestore();
  });

  it("räumt das Konto weg, wenn der Kursplatz nicht angelegt werden kann", async () => {
    aboInsert.mockResolvedValue({ error: { message: "kaputt" } });
    const fehlerLog = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await anlegen()).toMatchObject({ error: expect.stringContaining("Kursplatz") });
    expect(deleteUser).toHaveBeenCalledWith("neu-1");
    fehlerLog.mockRestore();
  });

  it("meldet einen nicht gefundenen Kurs", async () => {
    kurs.mockResolvedValue({ data: null });
    expect(await anlegen()).toEqual({ error: "Der Kurs wurde nicht gefunden." });
  });
});
