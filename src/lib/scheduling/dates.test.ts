import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { jsDayToWeekday, formatDateLocal, upcomingOccurrences, pastOccurrences, daysUntil } from "./dates";

describe("jsDayToWeekday", () => {
  it("maps JS Sunday (0) to app Sonntag (6)", () => {
    expect(jsDayToWeekday(0)).toBe(6);
  });

  it("maps JS Monday (1) to app Montag (0)", () => {
    expect(jsDayToWeekday(1)).toBe(0);
  });

  it("maps JS Saturday (6) to app Samstag (5)", () => {
    expect(jsDayToWeekday(6)).toBe(5);
  });
});

describe("formatDateLocal", () => {
  it("formats a local-midnight date without shifting to a different day", () => {
    // Regression test for the toISOString() UTC-shift bug found during PROJ-8 QA:
    // a date constructed at local midnight must not shift back a day when
    // the local timezone is ahead of UTC (e.g. Europe/Vienna in summer).
    const date = new Date(2026, 7, 17); // August 17 2026, local midnight (month is 0-indexed)
    expect(formatDateLocal(date)).toBe("2026-08-17");
  });

  it("pads single-digit month and day with a leading zero", () => {
    const date = new Date(2026, 0, 5); // January 5 2026
    expect(formatDateLocal(date)).toBe("2026-01-05");
  });
});

describe("upcomingOccurrences", () => {
  beforeEach(() => {
    // Sunday 2026-08-16 (app weekday 6)
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 16, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the next N Mondays when today is Sunday", () => {
    const dates = upcomingOccurrences(0, { count: 3 });
    expect(dates).toEqual(["2026-08-17", "2026-08-24", "2026-08-31"]);
  });

  it("includes today itself when today matches the requested weekday", () => {
    const dates = upcomingOccurrences(6, { count: 2 }); // Sonntag = 6, today is Sunday
    expect(dates).toEqual(["2026-08-16", "2026-08-23"]);
  });

  it("skips dates present in pauseDates while keeping the requested count", () => {
    const dates = upcomingOccurrences(0, { count: 3, pauseDates: ["2026-08-17"] });
    expect(dates).toEqual(["2026-08-24", "2026-08-31", "2026-09-07"]);
  });
});

describe("pastOccurrences", () => {
  beforeEach(() => {
    // Sunday 2026-08-16 (app weekday 6)
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 16, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the last N Mondays before today when today is Sunday", () => {
    const dates = pastOccurrences(0, { count: 3 });
    expect(dates).toEqual(["2026-08-10", "2026-08-03", "2026-07-27"]);
  });

  it("excludes today even when today matches the requested weekday (PROJ-13: attendance for today comes from the upcoming list, not past)", () => {
    const dates = pastOccurrences(6, { count: 2 }); // Sonntag = 6, today is Sunday
    expect(dates).toEqual(["2026-08-09", "2026-08-02"]);
  });

  it("skips dates present in pauseDates while keeping the requested count", () => {
    const dates = pastOccurrences(0, { count: 3, pauseDates: ["2026-08-10"] });
    expect(dates).toEqual(["2026-08-03", "2026-07-27", "2026-07-20"]);
  });

  it("returns dates in most-recent-first order", () => {
    const dates = pastOccurrences(0, { count: 2 });
    expect(new Date(dates[0]).getTime()).toBeGreaterThan(new Date(dates[1]).getTime());
  });
});

describe("daysUntil", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 16, 23, 0, 0)); // late in the day, should not matter
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 0 for today", () => {
    expect(daysUntil("2026-08-16")).toBe(0);
  });

  it("returns 1 for tomorrow", () => {
    expect(daysUntil("2026-08-17")).toBe(1);
  });

  it("returns a negative number for a past date", () => {
    expect(daysUntil("2026-08-15")).toBe(-1);
  });
});
