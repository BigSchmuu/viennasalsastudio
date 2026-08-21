import { describe, it, expect } from "vitest";
import {
  nextBirthdayDate,
  daysUntilNextBirthday,
  isBirthdayToday,
  isBirthdayWithinDays,
  formatNextBirthdayMonthDay,
} from "./birthdays";

describe("daysUntilNextBirthday", () => {
  it("returns 0 when the birthday is today", () => {
    expect(daysUntilNextBirthday("1995-08-21", new Date(2026, 7, 21))).toBe(0);
  });

  it("returns the correct count for a birthday later this year", () => {
    expect(daysUntilNextBirthday("1998-08-25", new Date(2026, 7, 21))).toBe(4);
  });

  it("rolls over to next year when this year's date already passed", () => {
    // Aug 20 birthday, checked from Aug 21 -> next occurrence is ~364/365 days out.
    const result = daysUntilNextBirthday("1990-08-20", new Date(2026, 7, 21));
    expect(result).toBeGreaterThan(360);
  });

  it("handles the year wraparound (checked in December, birthday in January)", () => {
    expect(daysUntilNextBirthday("1990-01-03", new Date(2026, 11, 28))).toBe(6);
  });

  it("treats a Feb 29 birthdate as Feb 28 in a non-leap year", () => {
    expect(daysUntilNextBirthday("2000-02-29", new Date(2026, 1, 28))).toBe(0);
  });

  it("treats a Feb 29 birthdate as the real Feb 29 in a leap year", () => {
    // 2028 is a leap year.
    expect(daysUntilNextBirthday("2000-02-29", new Date(2028, 1, 28))).toBe(1);
  });
});

describe("isBirthdayToday", () => {
  it("is true exactly on the birthday", () => {
    expect(isBirthdayToday("1995-08-21", new Date(2026, 7, 21))).toBe(true);
  });

  it("is false on any other day", () => {
    expect(isBirthdayToday("1995-08-22", new Date(2026, 7, 21))).toBe(false);
  });
});

describe("isBirthdayWithinDays", () => {
  it("includes a birthday exactly at the boundary", () => {
    expect(isBirthdayWithinDays("1998-08-28", new Date(2026, 7, 21), 7)).toBe(true);
  });

  it("excludes a birthday one day past the boundary", () => {
    expect(isBirthdayWithinDays("1998-08-29", new Date(2026, 7, 21), 7)).toBe(false);
  });

  it("includes today itself", () => {
    expect(isBirthdayWithinDays("1998-08-21", new Date(2026, 7, 21), 7)).toBe(true);
  });
});

describe("formatNextBirthdayMonthDay", () => {
  it("formats a normal date as DD.MM.", () => {
    expect(formatNextBirthdayMonthDay("1998-08-05", new Date(2026, 7, 1))).toBe("05.08.");
  });

  it("formats a Feb 29 birthdate as 28.02. in a non-leap lookup year, not the raw 29.02.", () => {
    expect(formatNextBirthdayMonthDay("2000-02-29", new Date(2026, 1, 25))).toBe("28.02.");
  });
});

describe("nextBirthdayDate", () => {
  it("returns a Date object matching the computed day count", () => {
    const from = new Date(2026, 7, 21);
    const next = nextBirthdayDate("1998-08-25", from);
    expect(next.getMonth()).toBe(7);
    expect(next.getDate()).toBe(25);
  });
});
