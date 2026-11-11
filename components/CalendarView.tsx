"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Paperclip } from "lucide-react";
import { calendarCells, formatLongDate, formatMonth, initialMonth, isWeekend, monthsOf, WEEKDAYS } from "@/lib/dates";
import { holidayOn } from "@/lib/holidays";
import { formatHours } from "@/lib/money";
import { modeById, type DayLog, type Expense } from "@/lib/types";
import type { FinancialYear } from "@/lib/ato-rules";
import { buttonClass, cx, Panel } from "@/components/ui";

export function CalendarView({
  year,
  logs,
  expenses,
  onOpenDay,
}: {
  year: FinancialYear;
  logs: Record<string, DayLog>;
  expenses: Expense[];
  onOpenDay: (date: string) => void;
}) {
  const months = monthsOf(year.start, year.end);
  const [seenYear, setSeenYear] = useState(year.id);
  const [cursor, setCursor] = useState(() => initialMonth(year, Object.keys(logs)));
  if (seenYear !== year.id) {
    setSeenYear(year.id);
    setCursor(initialMonth(year, Object.keys(logs)));
  }

  const index = months.findIndex((item) => item.year === cursor.year && item.month === cursor.month);
  const safeIndex = index >= 0 ? index : 0;
  const current = months[safeIndex];
  const cells = calendarCells(current.year, current.month);
  const prefix = `${current.year}-${String(current.month + 1).padStart(2, "0")}`;
  const monthLogs = Object.values(logs).filter((log) => log.date.startsWith(prefix));
  const wfhTenths = monthLogs.reduce((total, log) => (log.mode === "wfh" ? total + Math.round(log.hours * 10) : total), 0);
  const expensesByDate = new Map<string, number>();
  for (const expense of expenses) {
    if (!expense.date.startsWith(prefix)) continue;
    expensesByDate.set(expense.date, (expensesByDate.get(expense.date) ?? 0) + 1);
  }
  const holidayCount = cells.filter((cell) => cell && holidayOn(cell.iso)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Hours diary</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-fog">
            Log the hours you actually worked. The fixed-rate claim uses these working-from-home days, not an estimate.
          </p>
        </div>
        <p className="font-mono text-sm text-mint">
          {formatHours(wfhTenths / 10)} h from home this month
        </p>
      </div>

      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={cx(buttonClass.ghost, "min-h-10 px-3")}
              aria-label="Previous month"
              disabled={safeIndex === 0}
              onClick={() => setCursor(months[safeIndex - 1])}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className={cx(buttonClass.ghost, "min-h-10 px-3")}
              aria-label="Next month"
              disabled={safeIndex === months.length - 1}
              onClick={() => setCursor(months[safeIndex + 1])}
            >
              <ChevronRight size={16} />
            </button>
            <label className="sr-only" htmlFor="month-jump">
              Jump to month
            </label>
            <select
              id="month-jump"
              className="min-h-10 rounded-full border border-line bg-ink px-3 text-sm"
              value={`${current.year}-${current.month}`}
              onChange={(event) => {
                const [yearText, monthText] = event.target.value.split("-");
                setCursor({ year: Number(yearText), month: Number(monthText) });
              }}
            >
              {months.map((item) => (
                <option key={`${item.year}-${item.month}`} value={`${item.year}-${item.month}`}>
                  {formatMonth(item.year, item.month)}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-fog">
            {holidayCount === 1 ? "1 public holiday" : `${holidayCount} public holidays`}
          </p>
        </div>

        <ul className="mt-4 flex flex-wrap gap-2 text-[11px] text-fog">
          <Legend swatch="bg-black/30 border border-line" label="Weekend" />
          <Legend swatch="bg-rose/20 border border-rose/50" label="National holiday" />
          <Legend swatch="bg-gold/20 border border-gold/50" label="Queensland holiday" />
          <Legend swatch="bg-mint/20 border border-mint/50" label="Work from home" />
          <Legend swatch="bg-sky/20 border border-sky/40" label="Office" />
          <Legend swatch="bg-rose/10 border border-rose/30" label="Leave" />
          <Legend swatch="bg-gold/10 border border-gold/30" label="RDO" />
        </ul>
        <p className="mt-3 text-xs leading-5 text-fog">
          The Ekka public holiday is for the Brisbane area only. Other Queensland show holidays are not listed.
        </p>

        <div className="mt-4 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day, index) => (
            <div key={day} className={cx("px-1 py-1 text-center text-[11px] uppercase tracking-wide", index > 4 ? "text-fog" : "text-paper/80")}>
              {day}
            </div>
          ))}
          {cells.map((cell, index) => {
            if (!cell) return <div key={`empty-${index}`} />;
            const holiday = holidayOn(cell.iso);
            const weekend = isWeekend(cell.iso);
            const log = logs[cell.iso];
            const expenseCount = expensesByDate.get(cell.iso) ?? 0;
            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => onOpenDay(cell.iso)}
                aria-label={dayLabel(cell.iso, log, expenseCount)}
                className={cx(
                  "focus-ring flex h-[4.5rem] flex-col rounded-xl border p-1 text-left sm:h-28 sm:p-2",
                  holiday
                    ? holiday.scope === "national"
                      ? "border-rose/40 bg-rose/10"
                      : "border-gold/40 bg-gold/10"
                    : weekend
                      ? "border-line bg-paper/5 text-fog"
                      : "border-line bg-panel",
                  cell.iso === todayIso() && "ring-1 ring-mint",
                )}
              >
                <span className="flex items-start justify-between gap-1">
                  <span className="font-mono text-xs sm:text-sm">{cell.day}</span>
                  {holiday ? (
                    <span className={cx("rounded px-1 text-[9px] font-semibold", holiday.scope === "national" ? "text-rose" : "text-gold")}>
                      {holiday.partDay ? "6pm" : holiday.scope === "national" ? "AU" : "QLD"}
                    </span>
                  ) : null}
                </span>
                {holiday ? <span className="mt-1 hidden truncate text-[10px] leading-4 text-fog sm:block">{holiday.name}</span> : null}
                <span className="mt-auto flex items-center justify-between gap-1">
                  {log ? (
                    <span className={cx("truncate text-[10px] font-medium sm:text-[11px]", modeTone(log.mode))}>
                      <span className="sm:hidden">{modeById(log.mode).short === "Office" ? "Off" : modeById(log.mode).short}</span>
                      <span className="hidden sm:inline">
                        {modeById(log.mode).short}
                        {log.mode === "wfh" ? ` ${formatHours(log.hours)}h` : ""}
                      </span>
                    </span>
                  ) : (
                    <span />
                  )}
                  {expenseCount > 0 || log?.receiptMarker ? (
                    <Paperclip size={12} className={expenseCount > 0 ? "text-mint" : "text-gold"} />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-1">
      <span className={cx("size-2.5 rounded-sm", swatch)} />
      {label}
    </li>
  );
}

function modeTone(mode: DayLog["mode"]): string {
  if (mode === "wfh") return "text-mint";
  if (mode === "office") return "text-sky";
  if (mode === "leave") return "text-rose";
  return "text-gold";
}

function todayIso(): string {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function dayLabel(iso: string, log: DayLog | undefined, expenseCount: number): string {
  const parts = [formatLongDate(iso)];
  const holiday = holidayOn(iso);
  if (holiday) parts.push(`${holiday.scope === "national" ? "National" : "Queensland"} public holiday, ${holiday.name}`);
  else if (isWeekend(iso)) parts.push("Weekend");
  if (log) {
    parts.push(log.mode === "wfh" ? `${modeById(log.mode).label}, ${formatHours(log.hours)} hours` : modeById(log.mode).label);
  }
  if (log?.receiptMarker) parts.push("Receipt flagged");
  if (expenseCount > 0) parts.push(`${expenseCount} expense${expenseCount === 1 ? "" : "s"} logged`);
  return parts.join(". ");
}
