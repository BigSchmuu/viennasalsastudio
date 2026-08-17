import { describe, it, expect } from "vitest";
import { currentMonthPeriod, trailing12MonthsPeriod, resolvePeriod, trendGranularity, buildBuckets } from "./period";

describe("currentMonthPeriod", () => {
  it("returns the first and last day of the reference month", () => {
    expect(currentMonthPeriod(new Date(2026, 7, 18))).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("handles February in a leap year correctly", () => {
    expect(currentMonthPeriod(new Date(2028, 1, 10))).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});

describe("trailing12MonthsPeriod", () => {
  it("spans from 11 months before the reference month through its end", () => {
    expect(trailing12MonthsPeriod(new Date(2026, 7, 18))).toEqual({ from: "2025-09-01", to: "2026-08-31" });
  });
});

describe("resolvePeriod", () => {
  it("defaults to the current month when no params are given", () => {
    const { period, isCustom } = resolvePeriod({});
    expect(isCustom).toBe(false);
    expect(period.from.slice(8)).toBe("01");
  });

  it("uses a valid custom range from params", () => {
    const { period, isCustom } = resolvePeriod({ from: "2026-01-01", to: "2026-03-31" });
    expect(isCustom).toBe(true);
    expect(period).toEqual({ from: "2026-01-01", to: "2026-03-31" });
  });

  it("rejects an end date before the start date and falls back to default", () => {
    const { isCustom } = resolvePeriod({ from: "2026-03-31", to: "2026-01-01" });
    expect(isCustom).toBe(false);
  });

  it("rejects malformed date strings", () => {
    const { isCustom } = resolvePeriod({ from: "not-a-date", to: "2026-01-01" });
    expect(isCustom).toBe(false);
  });
});

describe("trendGranularity", () => {
  it("groups by month for a 12-month range", () => {
    expect(trendGranularity({ from: "2025-09-01", to: "2026-08-31" })).toBe("month");
  });

  it("groups by day for a 2-week range", () => {
    expect(trendGranularity({ from: "2026-07-01", to: "2026-07-15" })).toBe("day");
  });

  it("switches to month grouping right at the 60-day threshold", () => {
    expect(trendGranularity({ from: "2026-01-01", to: "2026-03-02" })).toBe("month"); // 60 days
    expect(trendGranularity({ from: "2026-01-01", to: "2026-03-01" })).toBe("day"); // 59 days
  });
});

describe("buildBuckets", () => {
  it("builds one bucket per calendar month, clipped to the period bounds", () => {
    const buckets = buildBuckets({ from: "2026-06-15", to: "2026-08-10" }, "month");
    expect(buckets.map((b) => b.key)).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(buckets[0]).toMatchObject({ from: "2026-06-15", to: "2026-06-30" });
    expect(buckets[2]).toMatchObject({ from: "2026-08-01", to: "2026-08-10" });
  });

  it("builds one bucket per day for a short range", () => {
    const buckets = buildBuckets({ from: "2026-08-01", to: "2026-08-03" }, "day");
    expect(buckets.map((b) => b.key)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
  });

  it("builds a single bucket when from equals to", () => {
    expect(buildBuckets({ from: "2026-08-15", to: "2026-08-15" }, "day")).toHaveLength(1);
    expect(buildBuckets({ from: "2026-08-15", to: "2026-08-15" }, "month")).toHaveLength(1);
  });
});
