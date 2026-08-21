function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Feb 29 falls back to Feb 28 in a non-leap lookup year, per PROJ-31's spec. */
function normalizedMonthDay(birthdate: string, year: number): { month: number; day: number } {
  const [, monthStr, dayStr] = birthdate.split("-");
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return { month: 2, day: 28 };
  }
  return { month, day };
}

/** The next calendar date (today or later) `birthdate`'s month/day falls on, Feb-29 normalized. */
export function nextBirthdayDate(birthdate: string, from: Date): Date {
  const fromLocal = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const thisYear = normalizedMonthDay(birthdate, fromLocal.getFullYear());
  const next = new Date(fromLocal.getFullYear(), thisYear.month - 1, thisYear.day);

  if (next < fromLocal) {
    const nextYear = fromLocal.getFullYear() + 1;
    const rolled = normalizedMonthDay(birthdate, nextYear);
    return new Date(nextYear, rolled.month - 1, rolled.day);
  }
  return next;
}

/** Days from `from` (local midnight) to the next occurrence of `birthdate`'s month/day. 0 = today. */
export function daysUntilNextBirthday(birthdate: string, from: Date): number {
  const fromLocal = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const next = nextBirthdayDate(birthdate, from);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((next.getTime() - fromLocal.getTime()) / msPerDay);
}

export function isBirthdayToday(birthdate: string, today: Date): boolean {
  return daysUntilNextBirthday(birthdate, today) === 0;
}

export function isBirthdayWithinDays(birthdate: string, from: Date, days: number): boolean {
  const d = daysUntilNextBirthday(birthdate, from);
  return d >= 0 && d <= days;
}

/**
 * Day.Month of the next actual occurrence, e.g. "24.12." — the birth year is
 * never shown (privacy). Formats the normalized next occurrence, not the raw
 * stored birthdate, so a Feb-29 birthday correctly shows "28.02." in a
 * non-leap year rather than the un-observed "29.02.".
 */
export function formatNextBirthdayMonthDay(birthdate: string, from: Date): string {
  const next = nextBirthdayDate(birthdate, from);
  const day = String(next.getDate()).padStart(2, "0");
  const month = String(next.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.`;
}
