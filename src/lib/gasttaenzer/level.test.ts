import { describe, it, expect } from "vitest";
import { rang, eineStufeUeber, erfuelltMindeststufe, LEVEL_REIHE } from "./level";

describe("rang", () => {
  it("ordnet die vier Stufen aufsteigend", () => {
    const raenge = LEVEL_REIHE.map((l) => rang(l));
    expect(raenge).toEqual([1, 2, 3, 4]);
  });

  it("gibt open_level keinen Rang", () => {
    expect(rang("open_level")).toBeNull();
  });

  it("kommt mit null und Unsinn zurecht", () => {
    expect(rang(null)).toBeNull();
    expect(rang("gibt_es_nicht")).toBeNull();
  });
});

describe("eineStufeUeber", () => {
  it("schlägt für Beginner den Improver vor", () => {
    expect(eineStufeUeber("beginner")).toBe("improver");
  });

  it("schlägt für Intermediate den Advanced vor", () => {
    expect(eineStufeUeber("intermediate")).toBe("advanced");
  });

  it("hat über Advanced nichts vorzuschlagen", () => {
    expect(eineStufeUeber("advanced")).toBeNull();
  });

  it("hat für Open Level nichts vorzuschlagen — es steht in keiner Reihe", () => {
    expect(eineStufeUeber("open_level")).toBeNull();
  });
});

describe("erfuelltMindeststufe", () => {
  it("lässt genau die Schwelle gelten", () => {
    expect(erfuelltMindeststufe("intermediate", "intermediate")).toBe(true);
  });

  it("lässt höher gelten", () => {
    expect(erfuelltMindeststufe("advanced", "intermediate")).toBe(true);
  });

  it("weist niedriger ab", () => {
    expect(erfuelltMindeststufe("improver", "intermediate")).toBe(false);
  });

  it("lässt jeden durch, wenn keine Stufe gefordert ist", () => {
    expect(erfuelltMindeststufe("beginner", null)).toBe(true);
  });

  it("weist ein Konto ohne Level ab, sobald eine Stufe gefordert ist", () => {
    expect(erfuelltMindeststufe(null, "improver")).toBe(false);
  });

  it("fordert open_level als Schwelle niemanden heraus — es hat keinen Rang", () => {
    expect(erfuelltMindeststufe("beginner", "open_level")).toBe(true);
  });
});
