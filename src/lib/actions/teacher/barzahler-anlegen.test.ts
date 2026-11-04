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
const eintragInsert = vi.fn();
const platzInsert = vi.fn();
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
      if (tabelle === "course_memberships") {
        return { insert: (...a: unknown[]) => platzInsert(...a) };
      }
      if (tabelle === "cash_entries") {
        return { insert: (...a: unknown[]) => eintragInsert(...a) };
      }
      // subscriptions: Seit PROJ-84 wird die Kennung des Abos gebraucht, um
      // daran den Listeneintrag zu haengen.
      return {
        insert: (...a: unknown[]) => ({
          select: () => ({ single: () => aboInsert(...a) }),
        }),
      };
    },
  }),
}));

async function anlegen(name = "Herbert K.", betrag = "50", art?: "kurs" | "flatrate" | "pass") {
  const { legeBarzahlerAn } = await import("./barzahler-anlegen");
  return art ? legeBarzahlerAn("kurs-1", name, betrag, art) : legeBarzahlerAn("kurs-1", name, betrag);
}

/** Derselbe Kurs, aber mit Stilrichtung und Passpreis (PROJ-95). */
function kursMitPass(passPreis: number | null = 45) {
  kurs.mockResolvedValue({
    data: {
      name: "Bachata Anfänger",
      max_participants: null,
      dance_style_id: "stil-bachata",
      dance_styles: { name: "Bachata", pass_price: passPreis },
    },
  });
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
    aboInsert.mockReset().mockResolvedValue({ data: { id: "abo-1" }, error: null });
    eintragInsert.mockReset().mockResolvedValue({ error: null });
    platzInsert.mockReset().mockResolvedValue({ error: null });
  });

  it("legt Konto, Namen und Kursplatz an", async () => {
    expect(await anlegen()).toEqual({ success: true });

    // Die Adresse liegt auf der reservierten Endung — dort kommt nie Post an.
    const adresse = (createUser.mock.calls[0][0] as { email: string }).email;
    expect(adresse).toMatch(/@viennasalsastudio\.invalid$/);
    // PROJ-94: Ein Feld an der Tür, geteilt gespeichert — `full_name` setzt
    // der Trigger auf `profiles` aus den beiden Teilen.
    expect(profilUpdate.mock.calls[0][0]).toEqual({ first_name: "Herbert", last_name: "K." });
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
    aboInsert.mockResolvedValue({ data: null, error: { message: "kaputt" } });
    const fehlerLog = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await anlegen()).toMatchObject({ error: expect.stringContaining("Kursplatz") });
    expect(deleteUser).toHaveBeenCalledWith("neu-1");
    fehlerLog.mockRestore();
  });

  // PROJ-84: Ohne diesen Eintrag waere der Gast angelegt, stuende aber auf
  // keiner Liste — und genau dafuer hat ihn die Lehrkraft eingetragen.
  it("setzt den Gast auch auf die Barzahler-Liste", async () => {
    await anlegen("Herbert K.", "49,50");
    expect(eintragInsert.mock.calls[0][0]).toMatchObject({
      subscription_id: "abo-1",
      amount_due: 49.5,
    });
  });

  it("räumt das Konto weg, wenn der Listeneintrag nicht angelegt werden kann", async () => {
    eintragInsert.mockResolvedValue({ error: { message: "kaputt" } });
    const fehlerLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const ergebnis = await anlegen();
    expect(ergebnis).toHaveProperty("error");
    expect(deleteUser).toHaveBeenCalled();
    fehlerLog.mockRestore();
  });

  // PROJ-85: Dieselben Schritte, ein Unterschied in einem davon.
  it("legt bei der Flatrate ein Abo ohne Kurs an — und den Kursplatz daneben", async () => {
    await anlegen("Frida Flat", "120", "flatrate");
    expect(aboInsert.mock.calls[0][0]).toMatchObject({
      course_id: null,
      name: "Flatrate",
      price: 120,
    });
    expect(platzInsert.mock.calls[0][0]).toMatchObject({
      course_id: "kurs-1",
      subscription_id: "abo-1",
    });
    // PROJ-69: Der Platz gilt ab heute, nicht irgendwann.
    expect(platzInsert.mock.calls[0][0]).toHaveProperty("started_on");
  });

  it("legt beim Kursabo keinen Kursplatz daneben", async () => {
    // Sonst stünde derselbe Mensch zweimal im Kurs — über das Abo und über
    // den Platz (PROJ-50).
    await anlegen("Kurt Kurs", "50", "kurs");
    expect(aboInsert.mock.calls[0][0]).toMatchObject({ course_id: "kurs-1", name: "Barzahler" });
    expect(platzInsert).not.toHaveBeenCalled();
  });

  it("raeumt das Konto weg, wenn der Kursplatz der Flatrate nicht entsteht", async () => {
    platzInsert.mockResolvedValue({ error: { message: "kaputt" } });
    const fehlerLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const ergebnis = await anlegen("Frida Flat", "120", "flatrate");
    expect(ergebnis).toHaveProperty("error");
    expect(deleteUser).toHaveBeenCalled();
    fehlerLog.mockRestore();
  });

  it("meldet einen nicht gefundenen Kurs", async () => {
    kurs.mockResolvedValue({ data: null });
    expect(await anlegen()).toEqual({ error: "Der Kurs wurde nicht gefunden." });
  });
});

describe("legeBarzahlerAn: der Pass (PROJ-95)", () => {
  beforeEach(() => {
    istAdmin = false;
    zuordnung.mockReset().mockResolvedValue({ data: { course_id: "kurs-1" } });
    kurs.mockReset();
    mitgliederZahl.mockReset().mockResolvedValue({ count: 0 });
    createUser.mockReset().mockResolvedValue({ data: { user: { id: "neu-1" } }, error: null });
    deleteUser.mockReset().mockResolvedValue({ error: null });
    profilUpdate.mockReset().mockResolvedValue({ error: null });
    aboInsert.mockReset().mockResolvedValue({ data: { id: "abo-1" }, error: null });
    eintragInsert.mockReset().mockResolvedValue({ error: null });
    platzInsert.mockReset().mockResolvedValue({ error: null });
    kursMitPass();
  });

  it("legt ein Abo ohne Kurs mit Stilgrenze an und nennt es nach der Stilrichtung", async () => {
    await anlegen("Paula Pass", "45", "pass");
    expect(aboInsert.mock.calls[0][0]).toMatchObject({
      course_id: null,
      dance_style_id: "stil-bachata",
      name: "Bachata Pass",
      price: 45,
    });
  });

  it("legt den Kursplatz daneben an, wie bei der Flatrate", async () => {
    // Ohne diesen Platz wäre der Gast in keinem Kurs, obwohl er gerade
    // davorsteht: Das Abo trägt ja keinen Kurs.
    await anlegen("Paula Pass", "45", "pass");
    expect(platzInsert.mock.calls[0][0]).toMatchObject({
      course_id: "kurs-1",
      subscription_id: "abo-1",
    });
  });

  it("macht aus einer Flatrate keinen Pass, auch nicht im Bachata-Kurs", async () => {
    // Der Fehler, der hier droht: Die Stilrichtung steht am Kurs, und wer sie
    // unbesehen ans Abo schreibt, verkauft eine Flatrate als Pass — der Kunde
    // zahlt den Flatrate-Preis und kommt nur noch in Bachata-Kurse.
    await anlegen("Frida Flat", "120", "flatrate");
    expect(aboInsert.mock.calls[0][0]).toMatchObject({
      course_id: null,
      dance_style_id: null,
      name: "Flatrate",
    });
  });

  it("verweigert den Pass, wenn die Stilrichtung keinen Passpreis hat", async () => {
    // Die Auswahl zeigt ihn dort nicht an — geprüft wird es hier trotzdem.
    // Sonst wäre ein verändertes Formular ein Weg zu einem Produkt, das der
    // Betreiber nicht anbietet.
    kursMitPass(null);
    expect(await anlegen("Paula Pass", "45", "pass")).toEqual({
      error: "Für diesen Kurs gibt es keinen Pass.",
    });
    expect(createUser).not.toHaveBeenCalled();
  });

  it("verweigert den Pass, wenn der Kurs keine Stilrichtung hat", async () => {
    kurs.mockResolvedValue({
      data: { name: "Offenes Training", max_participants: null, dance_style_id: null, dance_styles: null },
    });
    expect(await anlegen("Paula Pass", "45", "pass")).toEqual({
      error: "Für diesen Kurs gibt es keinen Pass.",
    });
  });

  it("lässt Kursabo und Flatrate unberührt, wenn es keinen Pass gibt", async () => {
    // Die Prüfung darf nur den Pass treffen. Ein Kurs ohne Stilrichtung ist
    // für die beiden anderen Arten völlig normal.
    kurs.mockResolvedValue({
      data: { name: "Offenes Training", max_participants: null, dance_style_id: null, dance_styles: null },
    });
    expect(await anlegen("Kurt Kurs", "50", "kurs")).toEqual({ success: true });
    expect(await anlegen("Frida Flat", "120", "flatrate")).toEqual({ success: true });
  });

  it("verweigert den Pass auch der Lehrkraft eines fremden Kurses", async () => {
    // Die Rechteprüfung steht vor allem anderen und gilt für alle drei Arten.
    zuordnung.mockResolvedValue({ data: null });
    expect(await anlegen("Paula Pass", "45", "pass")).toEqual({
      error: "Dieser Kurs gehört nicht zu deinen Kursen.",
    });
  });
});
