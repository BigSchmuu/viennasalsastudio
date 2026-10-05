import { describe, it, expect } from "vitest";
import {
  einmalArt,
  einmalGaesteAm,
  gueltigerTermin,
  istEinmalQuelle,
  istEinmalZeile,
  standardTermin,
  teileZeilen,
} from "./einmal-gaeste";

type Zelle = { status: "present" | "absent" | null; source: string; selfCheckedIn: boolean };

function zeile(
  name: string,
  zellen: Record<string, Partial<Zelle> & { source: string }>
) {
  const cells: Record<string, Zelle | null> = {};
  for (const [datum, z] of Object.entries(zellen)) {
    cells[datum] = { status: z.status ?? null, source: z.source, selfCheckedIn: z.selfCheckedIn ?? false };
  }
  return { customerId: `id-${name}`, fullName: name, cells };
}

describe("istEinmalQuelle", () => {
  it("erkennt die drei Arten von Einmal-Besuch", () => {
    expect(istEinmalQuelle("probestunde")).toBe(true);
    expect(istEinmalQuelle("dropin")).toBe(true);
    expect(istEinmalQuelle("gast")).toBe(true);
  });

  // Zwischen Auslieferung und eingespielter Migration liefert die Datenbank
  // noch den groberen Wert. Fiele er durch, wäre die Person an ihrem Abend aus
  // beiden Listen verschwunden.
  it("lässt die alte, gröbere Quelle „buchung“ weiterhin gelten", () => {
    expect(istEinmalQuelle("buchung")).toBe(true);
  });

  it("zählt Abo und manuell nicht dazu", () => {
    expect(istEinmalQuelle("abo")).toBe(false);
    expect(istEinmalQuelle("manuell")).toBe(false);
    expect(istEinmalQuelle(null)).toBe(false);
    expect(istEinmalQuelle(undefined)).toBe(false);
  });
});

describe("einmalArt", () => {
  it("nennt jede Art bei ihrem Namen", () => {
    expect(einmalArt("probestunde")).toBe("Probestunde");
    expect(einmalArt("dropin")).toBe("Drop-In");
    expect(einmalArt("gast")).toBe("Gast");
  });

  it("nennt die alte Quelle neutral „Buchung“", () => {
    expect(einmalArt("buchung")).toBe("Buchung");
  });
});

describe("istEinmalZeile", () => {
  it("erkennt eine Probestunde an einem einzigen Termin", () => {
    expect(istEinmalZeile(zeile("Probe", { "2026-10-07": { source: "probestunde" } }))).toBe(true);
  });

  it("lässt eine Abo-Teilnehmerin in der Anwesenheitsliste", () => {
    expect(
      istEinmalZeile(
        zeile("Abo", { "2026-10-07": { source: "abo" }, "2026-10-14": { source: "abo" } })
      )
    ).toBe(false);
  });

  // Der Grenzfall aus dem Spec: Wer im Verlauf der Staffel zum Kurs gehört,
  // gehört in die Anwesenheitsliste — auch wenn sie als Gast angefangen hat.
  it("rechnet eine Gästin, die später ein Abo hat, zu den Kursteilnehmern", () => {
    expect(
      istEinmalZeile(
        zeile("Gast-dann-Abo", { "2026-10-07": { source: "gast" }, "2026-10-14": { source: "abo" } })
      )
    ).toBe(false);
  });

  // Sonst verschwände jemand aus der Liste, in die man ihn gerade gesetzt hat.
  it("behandelt eine Zeile ohne jede Zelle nicht als Einmal-Gast", () => {
    expect(istEinmalZeile({ customerId: "neu", fullName: "Eben hinzugefügt", cells: {} })).toBe(
      false
    );
  });
});

describe("teileZeilen", () => {
  it("trennt Kursteilnehmer von Einmal-Gästen", () => {
    const { kursteilnehmer, einmal } = teileZeilen([
      zeile("Anna Abo", { "2026-10-07": { source: "abo" } }),
      zeile("Paul Probe", { "2026-10-07": { source: "probestunde" } }),
      zeile("Doris Drop", { "2026-10-14": { source: "dropin" } }),
      zeile("Maria Manuell", { "2026-10-07": { source: "manuell" } }),
    ]);
    expect(kursteilnehmer.map((z) => z.fullName)).toEqual(["Anna Abo", "Maria Manuell"]);
    expect(einmal.map((z) => z.fullName)).toEqual(["Paul Probe", "Doris Drop"]);
  });
});

describe("einmalGaesteAm", () => {
  const zeilen = [
    zeile("Anna Abo", { "2026-10-07": { source: "abo" } }),
    zeile("Paul Probe", { "2026-10-07": { source: "probestunde", status: "present" } }),
    zeile("Doris Drop", { "2026-10-14": { source: "dropin" } }),
    zeile("Gustav Gast", { "2026-10-07": { source: "gast", selfCheckedIn: true } }),
  ];

  it("zeigt nur die Gäste genau dieses Termins", () => {
    const gaeste = einmalGaesteAm(zeilen, "2026-10-07");
    expect(gaeste.map((g) => `${g.fullName} (${g.art})`)).toEqual([
      "Gustav Gast (Gast)",
      "Paul Probe (Probestunde)",
    ]);
  });

  it("nimmt Status und Selbst-Check-In des Termins mit", () => {
    const gaeste = einmalGaesteAm(zeilen, "2026-10-07");
    expect(gaeste.find((g) => g.fullName === "Paul Probe")?.status).toBe("present");
    expect(gaeste.find((g) => g.fullName === "Gustav Gast")?.selfCheckedIn).toBe(true);
  });

  it("zeigt am nächsten Termin die dortigen Gäste — und nicht die von vorher", () => {
    expect(einmalGaesteAm(zeilen, "2026-10-14").map((g) => g.fullName)).toEqual(["Doris Drop"]);
  });

  it("bleibt leer an einem Termin ohne Einmal-Gäste", () => {
    expect(einmalGaesteAm(zeilen, "2026-10-21")).toEqual([]);
  });
});

describe("standardTermin", () => {
  const staffel = ["2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28"];

  it("wählt den heutigen Termin, wenn er dabei ist", () => {
    expect(standardTermin(staffel, "2026-10-14")).toBe("2026-10-14");
  });

  it("wählt sonst den nächsten anstehenden", () => {
    expect(standardTermin(staffel, "2026-10-09")).toBe("2026-10-14");
  });

  it("wählt den letzten, wenn die ganze Staffel vorbei ist", () => {
    expect(standardTermin(staffel, "2026-11-30")).toBe("2026-10-28");
  });

  it("wählt den ersten, wenn die Staffel noch bevorsteht", () => {
    expect(standardTermin(staffel, "2026-09-01")).toBe("2026-10-07");
  });

  it("kommt ohne Termine zurecht", () => {
    expect(standardTermin([], "2026-10-14")).toBeNull();
  });
});

describe("gueltigerTermin", () => {
  it("behält den gewählten Termin, solange er gezeigt wird", () => {
    expect(gueltigerTermin("2026-10-14", ["2026-10-07", "2026-10-14"], "2026-10-07")).toBe(
      "2026-10-14"
    );
  });

  // Sonst behauptete die Liste etwas über einen Abend, der nirgends steht.
  it("wählt neu, wenn der Termin nach dem Blättern nicht mehr dabei ist", () => {
    expect(gueltigerTermin("2026-10-14", ["2026-09-02", "2026-09-09"], "2026-10-07")).toBe(
      "2026-09-09"
    );
  });

  it("wählt auch dann, wenn noch nichts gewählt war", () => {
    expect(gueltigerTermin(null, ["2026-10-07", "2026-10-14"], "2026-10-07")).toBe("2026-10-07");
  });
});
