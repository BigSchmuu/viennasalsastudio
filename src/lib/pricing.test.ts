import { describe, it, expect } from "vitest";
import {
  readStudioPricing,
  planPrice,
  formatPrice,
  preisUeberblick,
  type StudioPricing,
} from "./pricing";

const pricing: StudioPricing = {
  dropin: { normal: 20, student: 15 },
  course: { normal: 65, student: 45 },
  flatrate: { normal: 145, student: 100 },
  referral: { referrer: 15, referee: 15 },
};

describe("readStudioPricing — Empfehlungsbeträge", () => {
  it("liest die gepflegten Beträge", () => {
    const p = readStudioPricing({ referral_reward_referrer: 20, referral_reward_referee: 10 });
    expect(p.referral).toEqual({ referrer: 20, referee: 10 });
  });

  it("liest 0 als 0 und nicht als „nicht gepflegt“", () => {
    const p = readStudioPricing({ referral_reward_referrer: 0, referral_reward_referee: 0 });
    expect(p.referral).toEqual({ referrer: 0, referee: 0 });
  });

  it("fehlt die Zeile ganz, ist das Programm aus — nicht versehentlich an", () => {
    expect(readStudioPricing(null).referral).toEqual({ referrer: 0, referee: 0 });
  });
});

describe("planPrice", () => {
  it("uses the standard course price when the course has none", () => {
    expect(planPrice(pricing, "single_course", { coursePrice: null })).toBe(65);
  });

  it("lets a course's own price beat the standard", () => {
    expect(planPrice(pricing, "single_course", { coursePrice: 80 })).toBe(80);
  });

  it("falls back to the standard once a course price is cleared again", () => {
    expect(planPrice(pricing, "single_course", { coursePrice: 80 })).toBe(80);
    expect(planPrice(pricing, "single_course", { coursePrice: null })).toBe(65);
  });

  it("shows the student price for both plans", () => {
    expect(planPrice(pricing, "single_course", { coursePrice: null, student: true })).toBe(45);
    expect(planPrice(pricing, "flatrate", { student: true })).toBe(100);
  });

  it("keeps the student discount even when the course deviates", () => {
    // Ein abweichender Kurspreis ist eine Aussage über diesen Kurs, keine über
    // die Ermäßigung — sonst würde ein teurerer Kurs die Ermäßigung aushebeln.
    expect(planPrice(pricing, "single_course", { coursePrice: 80, student: true })).toBe(45);
  });

  it("returns null when nothing is maintained — never a silent 0", () => {
    const empty: StudioPricing = {
      dropin: { normal: 20, student: 15 },
      course: { normal: null, student: null },
      flatrate: { normal: null, student: null },
      referral: { referrer: 15, referee: 15 },
    };
    expect(planPrice(empty, "single_course", { coursePrice: null })).toBeNull();
    expect(planPrice(empty, "flatrate")).toBeNull();
  });

  it("falls back to the normal price when only the student rate is missing", () => {
    const noStudentRate: StudioPricing = { ...pricing, flatrate: { normal: 145, student: null } };
    expect(planPrice(noStudentRate, "flatrate", { student: true })).toBe(145);
  });

  it("respects a course priced at 0 instead of treating it as 'not maintained'", () => {
    expect(planPrice(pricing, "single_course", { coursePrice: 0 })).toBe(0);
  });
});

describe("readStudioPricing", () => {
  it("maps a full row", () => {
    const result = readStudioPricing({
      normal_price: 20,
      student_price: 15,
      course_price: 65,
      course_student_price: 45,
      flatrate_price: 145,
      flatrate_student_price: 100,
      referral_reward_referrer: 15,
      referral_reward_referee: 15,
    });
    expect(result).toEqual(pricing);
  });

  it("keeps unmaintained subscription prices as null, but defaults the drop-ins", () => {
    const result = readStudioPricing({ normal_price: 22, student_price: 17 });
    expect(result.dropin).toEqual({ normal: 22, student: 17 });
    expect(result.course.normal).toBeNull();
    expect(result.flatrate.normal).toBeNull();
  });

  it("survives a missing row entirely", () => {
    const result = readStudioPricing(null);
    expect(result.dropin.normal).toBe(20);
    expect(result.course.normal).toBeNull();
  });
});

describe("formatPrice", () => {
  it("formats in Austrian style", () => {
    expect(formatPrice(65).replace(/ /g, " ")).toBe("€ 65,00");
  });
});

describe("preisUeberblick", () => {
  const basis: StudioPricing = {
    dropin: { normal: 20, student: 15 },
    course: { normal: 65, student: 45 },
    flatrate: { normal: 145, student: 100 },
    referral: { referrer: 15, referee: 15 },
  };
  // formatPrice setzt ein schmales geschütztes Leerzeichen hinter das €.
  // Erwartungen deshalb nie von Hand tippen, sondern zusammensetzen.
  const p = (betrag: number) => formatPrice(betrag, "de");

  it("nennt alle vier Bereiche in einer Zeile", () => {
    expect(preisUeberblick(basis)).toBe(
      [
        `Drop-in ${p(20)} / ${p(15)}`,
        `Kursabo ${p(65)} / ${p(45)}`,
        `Flatrate ${p(145)} / ${p(100)}`,
        `Empfehlung ${p(15)} / ${p(15)}`,
      ].join(" \u00b7 ")
    );
  });

  it("sagt „nicht gepflegt“, wenn beide Preise fehlen", () => {
    // Ein ausgelassener Eintrag sähe aus wie ein vergessener.
    const ohne = { ...basis, flatrate: { normal: null, student: null } };
    expect(preisUeberblick(ohne)).toContain("Flatrate nicht gepflegt");
  });

  it("zeigt einen Strich, wenn nur einer der beiden fehlt", () => {
    const halb = { ...basis, course: { normal: 65, student: null } };
    expect(preisUeberblick(halb)).toContain(`Kursabo ${p(65)} / \u2014`);
  });

  it("nennt ein abgeschaltetes Empfehlungsprogramm als solches, nicht als 0 €", () => {
    // Sonst sucht man den Schalter, den es nicht gibt.
    const aus = { ...basis, referral: { referrer: 0, referee: 0 } };
    expect(preisUeberblick(aus)).toContain("Empfehlung aus");
    expect(preisUeberblick(aus)).not.toContain(p(0));
  });

  it("behält 0 € als Betrag, solange nur einer der beiden null ist", () => {
    const halb = { ...basis, referral: { referrer: 15, referee: 0 } };
    expect(preisUeberblick(halb)).toContain(`Empfehlung ${p(15)} / ${p(0)}`);
  });
});
