import { FINANCIAL_YEARS } from "@/lib/ato-rules";
import type { YearId } from "@/lib/types";

const longDate = new Intl.DateTimeFormat("en-AU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const mediumDate = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const monthYear = new Intl.DateTimeFormat("en-AU", {
  month: "long",
  year: "numeric",
});

const stamp = new Intl.DateTimeFormat("en-AU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface CalendarCell {
  iso: string;
  day: number;
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isRealIsoDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function isValidHours(hours: unknown): hours is number {
  if (typeof hours !== "number" || !Number.isFinite(hours)) return false;
  if (hours < 0 || hours > 24) return false;
  return Math.abs(hours * 10 - Math.round(hours * 10)) < 1e-6;
}

export function isWeekend(iso: string): boolean {
  const day = parseIsoDate(iso).getDay();
  return day === 0 || day === 6;
}

export function isWithin(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

/** Income years whose start date has arrived. 2027–28 stays hidden until 1 July 2027. */
export function visibleFinancialYears(today = new Date()) {
  const iso = toIsoDate(today);
  return FINANCIAL_YEARS.filter((year) => year.start <= iso);
}

export function financialYearIdFor(today = new Date()): YearId {
  const iso = toIsoDate(today);
  const visible = visibleFinancialYears(today);
  const current = [...visible].reverse().find((year) => iso <= year.end);
  return current?.id ?? visible.at(-1)?.id ?? "2025-26";
}

export function monthsOf(startIso: string, endIso: string): { year: number; month: number }[] {
  const cursor = parseIsoDate(startIso);
  cursor.setDate(1);
  const last = parseIsoDate(endIso);
  last.setDate(1);
  const months: { year: number; month: number }[] = [];
  while (cursor <= last && months.length < 24) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

export function calendarCells(year: number, month: number): Array<CalendarCell | null> {
  const firstWeekday = new Date(year, month, 1).getDay();
  const pad = (firstWeekday + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: Array<CalendarCell | null> = Array.from({ length: pad }, () => null);
  for (let day = 1; day <= count; day += 1) {
    cells.push({ iso: toIsoDate(new Date(year, month, day)), day });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function initialMonth(
  bounds: { start: string; end: string },
  logDates: readonly string[],
  today = new Date(),
): { year: number; month: number } {
  const iso = toIsoDate(today);
  if (iso >= bounds.start && iso <= bounds.end) {
    return { year: today.getFullYear(), month: today.getMonth() };
  }
  const last = [...logDates].filter((date) => date >= bounds.start && date <= bounds.end).sort().at(-1);
  if (last) {
    const parsed = parseIsoDate(last);
    return { year: parsed.getFullYear(), month: parsed.getMonth() };
  }
  const start = parseIsoDate(bounds.start);
  return { year: start.getFullYear(), month: start.getMonth() };
}

export function yearStatus(
  bounds: { start: string; end: string },
  today = new Date(),
): "upcoming" | "current" | "ended" {
  const iso = toIsoDate(today);
  if (iso < bounds.start) return "upcoming";
  if (iso > bounds.end) return "ended";
  return "current";
}

export function daysLeftInYear(bounds: { start: string; end: string }, today = new Date()): number | null {
  const iso = toIsoDate(today);
  if (iso < bounds.start || iso > bounds.end) return null;
  const diff = Math.round((parseIsoDate(bounds.end).getTime() - parseIsoDate(iso).getTime()) / 86_400_000);
  return diff + 1;
}

export function defaultEntryDate(bounds: { start: string; end: string }, today = new Date()): string {
  const iso = toIsoDate(today);
  if (iso < bounds.start) return bounds.start;
  if (iso > bounds.end) return bounds.end;
  return iso;
}

export function formatLongDate(iso: string): string {
  return longDate.format(parseIsoDate(iso));
}

export function formatMediumDate(iso: string): string {
  return mediumDate.format(parseIsoDate(iso));
}

export function formatMonth(year: number, month: number): string {
  return monthYear.format(new Date(year, month, 1));
}

export function formatPeriod(start: string, end: string): string {
  const fmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric" });
  return `${fmt.format(parseIsoDate(start))} – ${fmt.format(parseIsoDate(end))}`;
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return stamp.format(date);
}
