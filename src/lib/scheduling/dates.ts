// Weekday convention across the app: 0=Montag ... 6=Sonntag.
// JS Date.getDay() uses 0=Sonntag ... 6=Samstag, so it needs remapping.
export function jsDayToWeekday(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

// Formats using LOCAL date components (not toISOString, which converts to
// UTC first and silently shifts the date backward by a day in any
// UTC-ahead timezone, e.g. Europe/Vienna in summer).
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Next `count` upcoming dates (today or later) matching `weekday`, skipping any date in `pauseDates`. */
export function upcomingOccurrences(
  weekday: number,
  { count, pauseDates = [] }: { count: number; pauseDates?: string[] }
): string[] {
  const pauseSet = new Set(pauseDates);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayWeekday = jsDayToWeekday(today.getDay());
  const daysUntilNext = (weekday - todayWeekday + 7) % 7;

  const first = new Date(today);
  first.setDate(today.getDate() + daysUntilNext);

  const dates: string[] = [];
  let cursor = first;
  while (dates.length < count) {
    const dateString = formatDateLocal(cursor);
    if (!pauseSet.has(dateString)) {
      dates.push(dateString);
    }
    const next = new Date(cursor);
    next.setDate(cursor.getDate() + 7);
    cursor = next;
  }
  return dates;
}

/** Whole days between today and `dateString` (negative if in the past). */
export function daysUntil(dateString: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateString + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
