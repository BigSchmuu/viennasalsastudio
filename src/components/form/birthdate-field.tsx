"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/** Oldest selectable birth year. Generous, but bounded so the list stays usable. */
const MAX_AGE = 100;

function daysInMonth(year: number, month: number): number {
  // month is 1-based; day 0 of the next month is the last day of this one.
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function splitValue(value: string): { day: number; month: number; year: number } {
  const [yearStr = "", monthStr = "", dayStr = ""] = value ? value.split("-") : [];
  return { day: Number(dayStr) || 0, month: Number(monthStr) || 0, year: Number(yearStr) || 0 };
}

/**
 * Birthdate picker as three separate selects (Tag / Monat / Jahr).
 *
 * Replaces a native `<input type="date">`, whose picker always opens on
 * *today* — on a phone that means spinning the year wheel back three-plus
 * decades for a typical customer. Choosing the year directly removes that
 * entirely.
 *
 * Value is the same "YYYY-MM-DD" string the form/schema already uses, and
 * stays "" until all three parts are chosen, so a half-filled control never
 * submits a bogus date.
 */
export function BirthdateField({
  value,
  onChange,
  idPrefix = "birthdate",
}: {
  value: string;
  onChange: (value: string) => void;
  idPrefix?: string;
}) {
  // The three parts are held locally rather than derived from `value`:
  // picking only the day would otherwise emit "" (incomplete date) and
  // immediately erase itself, making the control impossible to fill in.
  const [parts, setParts] = useState(() => splitValue(value));

  // Re-sync when the form supplies a different value from the outside
  // (initial load, reset after save) — a plain useState would go stale.
  useEffect(() => {
    setParts(splitValue(value));
  }, [value]);

  const { day, month, year } = parts;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: MAX_AGE + 1 }, (_, i) => currentYear - i);
  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);

  function update(next: { day: number; month: number; year: number }) {
    // Guard against e.g. 31 + Februar after a month/year change.
    const clampedDay =
      next.day && next.month && next.year ? Math.min(next.day, daysInMonth(next.year, next.month)) : next.day;
    const settled = { ...next, day: clampedDay };
    setParts(settled);
    onChange(
      settled.day && settled.month && settled.year
        ? `${settled.year}-${pad(settled.month)}-${pad(settled.day)}`
        : ""
    );
  }

  return (
    <div className="flex gap-2">
      <Select value={day ? String(day) : ""} onValueChange={(v) => update({ day: Number(v), month, year })}>
        <SelectTrigger id={`${idPrefix}-day`} aria-label="Tag" className="w-24">
          <SelectValue placeholder="Tag" />
        </SelectTrigger>
        <SelectContent>
          {days.map((d) => (
            <SelectItem key={d} value={String(d)}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={month ? String(month) : ""} onValueChange={(v) => update({ day, month: Number(v), year })}>
        <SelectTrigger id={`${idPrefix}-month`} aria-label="Monat" className="w-36">
          <SelectValue placeholder="Monat" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((name, i) => (
            <SelectItem key={name} value={String(i + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={year ? String(year) : ""} onValueChange={(v) => update({ day, month, year: Number(v) })}>
        <SelectTrigger id={`${idPrefix}-year`} aria-label="Jahr" className="w-28">
          <SelectValue placeholder="Jahr" />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Selects have no empty state to go back to, unlike the date input this
          replaced — without this there'd be no way to remove a birthdate again. */}
      {/* Boolean(): `day || month || year` is 0 when nothing is picked, and
          React renders a literal "0" for that instead of nothing. */}
      {Boolean(day || month || year) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          // Distinct accessible name: a plain "Löschen" collides with the
          // subscription table's delete buttons on the admin customer page.
          aria-label="Geburtsdatum löschen"
          onClick={() => update({ day: 0, month: 0, year: 0 })}
        >
          Löschen
        </Button>
      )}
    </div>
  );
}
