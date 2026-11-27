"use client";

import { useState } from "react";
import { Building2, CircleOff, Coffee, Flag, Home, MapPin, Paperclip, TreePalm } from "lucide-react";
import { holidayOn, holidayStateLabel, type AustralianState } from "@/lib/holidays";
import { formatCents, formatHours, toCents } from "@/lib/money";
import { formatLongDate, isUsualWorkDay } from "@/lib/dates";
import { isValidHours } from "@/lib/dates";
import { modeById, WORK_MODES, type DayLog, type Expense, type WfhMethod, type WorkMode } from "@/lib/types";
import { buttonClass, cx, Field, Modal, TextArea, TextBox } from "@/components/ui";

const MODE_ICONS = {
  wfh: Home,
  office: Building2,
  leave: TreePalm,
  rdo: Coffee,
  "not-working": CircleOff,
} as const;

export function DayLogModal({
  date,
  existing,
  expenses,
  defaultHours,
  wfhMethod,
  workDays,
  holidayState,
  onSave,
  onClear,
  onClose,
  onAddExpense,
}: {
  date: string;
  existing?: DayLog;
  expenses: Expense[];
  defaultHours: number;
  wfhMethod: WfhMethod;
  workDays: readonly number[];
  holidayState: AustralianState;
  onSave: (log: DayLog) => void;
  onClear: () => void;
  onClose: () => void;
  onAddExpense: () => void;
}) {
  const holiday = holidayOn(date, holidayState);
  const [mode, setMode] = useState<WorkMode>(existing?.mode ?? (holiday || !isUsualWorkDay(date, workDays) ? "wfh" : "office"));
  const [hours, setHours] = useState(existing?.mode === "wfh" ? String(existing.hours) : String(defaultHours));
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [receiptMarker, setReceiptMarker] = useState(existing?.receiptMarker ?? false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    const trimmed = notes.trim();
    if (trimmed.length > 500) {
      setError("Keep the note to 500 characters.");
      return;
    }
    if (mode === "wfh") {
      const parsed = Number(hours);
      if (!isValidHours(parsed) || parsed <= 0) {
        setError("Enter the hours you actually worked, in tenths, up to 24.");
        return;
      }
      onSave({ date, mode, hours: parsed, notes: trimmed, receiptMarker });
      return;
    }
    onSave({ date, mode, hours: 0, notes: trimmed, receiptMarker });
  }

  return (
    <Modal title={formatLongDate(date)} onClose={onClose}>
      {holiday ? (
        <div
          className={cx(
            "mb-4 flex gap-3 rounded-2xl border p-3 text-sm",
            holiday.scope === "national" ? "border-rose/40 bg-rose/10" : "border-gold/40 bg-gold/10",
          )}
        >
          {holiday.scope === "national" ? <Flag size={18} className="mt-0.5 shrink-0 text-rose" /> : <MapPin size={18} className="mt-0.5 shrink-0 text-gold" />}
          <p>
            <span className="block font-medium">
              {holiday.scope === "national" ? "National public holiday" : `${holidayStateLabel(holidayState)} public holiday`} · {holiday.name}
            </span>
            {holiday.detail ? <span className="mt-1 block text-fog">{holiday.detail}</span> : null}
            <span className="mt-1 block text-fog">Log hours only if you actually worked.</span>
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {WORK_MODES.map((item) => {
          const Icon = MODE_ICONS[item.id];
          const selected = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setMode(item.id)}
              className={cx(
                "focus-ring flex min-h-16 items-center gap-2 rounded-2xl border px-3 text-left text-sm",
                selected ? "border-mint bg-mint/15 text-mint" : "border-line bg-ink text-paper",
              )}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-fog">
        {mode === "wfh" && wfhMethod === "actual" ? "A record of the hours you worked from home." : modeById(mode).hint}
      </p>

      {mode === "wfh" ? (
        <div className="mt-4">
          <Field label="Hours worked from home" hint={`A standard day is ${formatHours(defaultHours)} hours. Change that in the menu. Use tenths, up to 24.`}>
            <TextBox
              type="number"
              inputMode="decimal"
              min={0.1}
              max={24}
              step={0.1}
              value={hours}
              onChange={(event) => setHours(event.target.value)}
            />
          </Field>
        </div>
      ) : null}

      <div className="mt-4">
        <Field label="Note" hint="Optional. A diary of actual hours, not an estimate.">
          <TextArea maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </div>

      <label className="mt-4 flex items-start gap-3 rounded-2xl border border-line px-3 py-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-[var(--mint)]"
          checked={receiptMarker}
          onChange={(event) => setReceiptMarker(event.target.checked)}
        />
        <span>
          <span className="flex items-center gap-2 font-medium">
            <Paperclip size={14} /> Receipt to file
          </span>
          <span className="mt-1 block text-fog">Flag a paper receipt you have not typed in yet.</span>
        </span>
      </label>

      {expenses.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {expenses.map((expense) => (
            <li key={expense.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{expense.description}</span>
              <span className="font-mono text-fog">{formatCents(toCents(expense.amount))}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <button type="button" className={cx(buttonClass.ghost, "mt-4 w-full")} onClick={onAddExpense}>
        Log an expense for this day
      </button>

      {error ? <p className="mt-3 text-sm text-rose">{error}</p> : null}

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {existing ? (
          <button type="button" className={buttonClass.danger} onClick={onClear}>
            Remove log
          </button>
        ) : (
          <span />
        )}
        <button type="button" className={buttonClass.primary} onClick={save}>
          Save day
        </button>
      </div>
    </Modal>
  );
}
