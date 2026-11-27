"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useSyncExternalStore } from "react";
import { ChevronDown, CircleHelp, ImagePlus, Receipt } from "lucide-react";
import { assetTreatment, CATEGORY_HINTS, type FinancialYear } from "@/lib/ato-rules";
import { carClaims, carCostLabel, CAR_COSTS, formatKilometres, isCarCost, isCarTrip, logbookCostClaims, summariseLogbook, vehicleName } from "@/lib/car";
import { defaultEntryDate, formatMonth, isRealIsoDate, isWithin } from "@/lib/dates";
import { createId } from "@/lib/id";
import { prepareReceipt, receiptKind, receiptLabel } from "@/lib/receiptImage";
import { ReceiptPreview } from "@/components/ReceiptPreview";
import { putReceipt, readCachedReceipt, subscribeReceipts } from "@/lib/receiptStore";
import { formatCents, formatMoney, portionCents, toCents } from "@/lib/money";
import {
  canShareWork,
  CATEGORIES,
  categoryById,
  isRunningCost,
  PAYMENT_METHODS,
  type CarCostKind,
  type CarLogbook,
  type CarMethod,
  type Expense,
  type ExpenseCategory,
  type PaymentMethod,
  type TaxAffair,
  type TripPurpose,
  type WfhMethod,
} from "@/lib/types";
import { buttonClass, cx, Field, inputClass, Modal, Panel, TextBox } from "@/components/ui";

interface FormState {
  id: string;
  date: string;
  amount: string;
  category: ExpenseCategory;
  description: string;
  merchant: string;
  paymentMethod: PaymentMethod;
  notes: string;
  dgrConfirmed: boolean;
  isEquipment: boolean;
  workUsePercent: string;
  shareMode: "all" | "percent" | "amount";
  workAmount: string;
  taxAffair: TaxAffair;
  kilometres: string;
  vehicle: string;
  carRecord: "trip" | "cost";
  carCost: CarCostKind;
  tripFrom: string;
  tripTo: string;
  tripPurpose: TripPurpose;
  tripTimes: string;
  receiptId: string | null;
  pendingImage: string | null;
  removeReceipt: boolean;
}

function blankForm(year: FinancialYear): FormState {
  return {
    id: "",
    date: defaultEntryDate(year),
    amount: "",
    category: "tools",
    description: "",
    merchant: "",
    paymentMethod: "card",
    notes: "",
    dgrConfirmed: false,
    isEquipment: false,
    workUsePercent: "100",
    shareMode: "all",
    workAmount: "",
    taxAffair: "other",
    kilometres: "",
    vehicle: "",
    carRecord: "trip",
    carCost: "fuel",
    tripFrom: "",
    tripTo: "",
    tripPurpose: "work",
    tripTimes: "1",
    receiptId: null,
    pendingImage: null,
    removeReceipt: false,
  };
}

function fromExpense(expense: Expense): FormState {
  return {
    id: expense.id,
    date: expense.date,
    amount: expense.amount.toFixed(2),
    category: expense.category,
    description: expense.description,
    merchant: expense.merchant,
    paymentMethod: expense.paymentMethod,
    notes: expense.notes,
    dgrConfirmed: expense.dgrConfirmed,
    isEquipment: expense.isEquipment,
    workUsePercent: String(expense.workUsePercent),
    shareMode: typeof expense.workAmount === "number" ? "amount" : expense.workUsePercent < 100 ? "percent" : "all",
    workAmount: typeof expense.workAmount === "number" ? expense.workAmount.toFixed(2) : "",
    taxAffair: expense.taxAffair === "litigation" ? "litigation" : "other",
    kilometres: expense.kilometres == null ? "" : String(expense.kilometres),
    vehicle: expense.vehicle ?? "",
    carRecord: expense.carRecord === "cost" ? "cost" : "trip",
    carCost: expense.carCost ?? "fuel",
    tripFrom: expense.tripFrom ?? "",
    tripTo: expense.tripTo ?? "",
    tripPurpose: expense.tripPurpose === "self-education" ? "self-education" : "work",
    tripTimes: String(expense.tripTimes ?? 1),
    receiptId: expense.receiptId,
    pendingImage: null,
    removeReceipt: false,
  };
}

function useReceipt(id: string | null): string | null {
  return useSyncExternalStore(subscribeReceipts, () => readCachedReceipt(id), () => null);
}

export function ExpenseManager({
  year,
  wfhMethod,
  carMethod,
  logbook,
  onCarMethod,
  onLogbook,
  onWfhMethod,
  expenses,
  draftDate,
  editingId,
  onSave,
  onDelete,
  onDismiss,
}: {
  year: FinancialYear;
  wfhMethod: WfhMethod;
  carMethod: CarMethod;
  logbook: CarLogbook | undefined;
  onCarMethod: (method: CarMethod) => void;
  onLogbook: (logbook: CarLogbook) => void;
  onWfhMethod: (method: WfhMethod) => void;
  expenses: Expense[];
  draftDate: string | null;
  editingId: string | null;
  onSave: (expense: Expense) => void;
  onDelete: (id: string) => void;
  onDismiss?: () => void;
}) {
  const [seenYear, setSeenYear] = useState(year.id);
  const [form, setForm] = useState<FormState>(() => {
    if (editingId) {
      const expense = expenses.find((item) => item.id === editingId);
      if (expense) return fromExpense(expense);
    }
    const next = blankForm(year);
    return draftDate ? { ...next, date: draftDate } : next;
  });
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openMonths, setOpenMonths] = useState<Set<string> | null>(null);
  const [editorOpen, setEditorOpen] = useState(() => Boolean(editingId || draftDate));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [workLoads, setWorkLoads] = useState("");
  const [mixedLoads, setMixedLoads] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const [viewing, setViewing] = useState<{ src: string; title: string } | null>(null);
  const [logbookStart, setLogbookStart] = useState(logbook?.started ?? "");
  const [logbookOpening, setLogbookOpening] = useState(logbook ? String(logbook.openingKilometres) : "");
  const [logbookClosing, setLogbookClosing] = useState(logbook?.closingKilometres == null ? "" : String(logbook.closingKilometres));
  const [logbookError, setLogbookError] = useState<string | null>(null);
  const [carHelp, setCarHelp] = useState(false);
  const [wfhHelp, setWfhHelp] = useState(false);
  const storedReceipt = useReceipt(form.removeReceipt ? null : form.receiptId);
  const receiptPreview = form.pendingImage ?? storedReceipt;

  if (seenYear !== year.id) {
    setSeenYear(year.id);
    setForm(blankForm(year));
    setEditorOpen(false);
    setError(null);
  }

  const amountValue = Number(form.amount);
  const equipment = form.category === "tools" || ((form.category === "self-education" || form.category === "other") && form.isEquipment);
  const preview =
    Number.isFinite(amountValue) && amountValue > 0
      ? assetTreatment({ category: form.category, amount: amountValue, isEquipment: form.category === "tools" || form.isEquipment })
      : "not-an-asset";
  const workUse = Number(form.workUsePercent);
  const suggestedLaundry = (Number(workLoads) || 0) + (Number(mixedLoads) || 0) * 0.5;

  function updateCategory(category: ExpenseCategory) {
    setForm((current) => ({
      ...current,
      category,
      dgrConfirmed: category === "donations" ? current.dgrConfirmed : false,
      isEquipment: category === "self-education" || category === "other" ? current.isEquipment : false,
      workUsePercent: canShareWork(category) ? current.workUsePercent : "100",
      shareMode: canShareWork(category) ? current.shareMode : "all",
      taxAffair: category === "tax-affairs" ? current.taxAffair : "other",
      kilometres: category === "car" ? current.kilometres : "",
      vehicle: category === "car" ? current.vehicle : "",
    }));
  }

  async function attachReceipt(file: File | undefined) {
    if (!file) return;
    setCompressing(true);
    setError(null);
    try {
      const pendingImage = await prepareReceipt(file);
      setForm((current) => ({ ...current, pendingImage, removeReceipt: false }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That photo could not be prepared.");
    } finally {
      setCompressing(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!isRealIsoDate(form.date) || !isWithin(form.date, year.start, year.end)) {
      setError(`Choose a date inside the ${year.label} income year.`);
      return;
    }
    const description = form.description.trim();
    const runningCost = form.category === "car" && form.carRecord === "cost";
    const carTrip = form.category === "car" && !runningCost;
    if (!description || description.length > 160) {
      setError(carTrip ? "Add where you went and why." : "Add a short description.");
      return;
    }
    let amount = Number(form.amount);
    let kilometres: number | null = null;
    let times = 1;
    if (carTrip) {
      const entered = Number(form.kilometres);
      if (!Number.isFinite(entered) || entered <= 0 || entered > 20_000) {
        setError("Enter the work kilometres for this trip.");
        return;
      }
      const hundredths = Math.round(entered * 100);
      if (Math.abs(entered * 100 - hundredths) > 0.001) {
        setError("Use kilometres to two decimal places, such as 18.5.");
        return;
      }
      if (carMethod === "logbook") {
        const count = Number(form.tripTimes || "1");
        if (!Number.isInteger(count) || count < 1 || count > 99) {
          setError("Times must be a whole number from 1 to 99.");
          return;
        }
        if (form.tripFrom.trim().length > 80 || form.tripTo.trim().length > 80) {
          setError("Keep the from and to short.");
          return;
        }
        times = count;
        kilometres = hundredths / 100;
        amount = 0;
      } else {
        const tripCents = Math.round((hundredths * year.carCentsPerKm) / 100);
        if (tripCents <= 0) {
          setError("That distance is too short to make a claim.");
          return;
        }
        kilometres = hundredths / 100;
        amount = tripCents / 100;
      }
    } else {
      if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
        setError("Enter an amount greater than zero.");
        return;
      }
      const cents = Math.round(amount * 100);
      if (Math.abs(amount * 100 - cents) > 0.001) {
        setError("Use dollars and cents, such as 24.50.");
        return;
      }
      amount = cents / 100;
    }
    if (form.vehicle.trim().length > 80) {
      setError("Keep the vehicle name short.");
      return;
    }
    let workUsePercent = 100;
    let workAmount: number | undefined;
    if (canShareWork(form.category) && form.shareMode === "percent") {
      const percent = Number(form.workUsePercent);
      if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
        setError("Work use must be a whole percentage from 1 to 100.");
        return;
      }
      workUsePercent = percent;
    }
    if (canShareWork(form.category) && form.shareMode === "amount") {
      const share = Number(form.workAmount);
      if (!Number.isFinite(share) || share < 0 || share > amount) {
        setError("Work dollars cannot be more than the bill.");
        return;
      }
      const shareCents = Math.round(share * 100);
      if (Math.abs(share * 100 - shareCents) > 0.001) {
        setError("Use dollars and cents for the work amount, such as 24.50.");
        return;
      }
      workAmount = shareCents / 100;
    }
    if (form.notes.trim().length > 500) {
      setError("Keep the note to 500 characters.");
      return;
    }
    let receiptId = form.removeReceipt ? null : form.receiptId;
    if (!form.removeReceipt && form.pendingImage) {
      receiptId = receiptId ?? createId();
      try {
        await putReceipt(receiptId, form.pendingImage);
      } catch {
        setError("This browser could not store the receipt file.");
        return;
      }
    }
    const editing = Boolean(form.id);
    onSave({
      id: form.id || createId(),
      date: form.date,
      amount,
      category: form.category,
      description,
      merchant: carTrip ? "" : form.merchant.trim(),
      paymentMethod: form.paymentMethod,
      notes: form.notes.trim(),
      dgrConfirmed: form.category === "donations" ? form.dgrConfirmed : false,
      isEquipment: form.category === "self-education" || form.category === "other" ? form.isEquipment : false,
      workUsePercent,
      ...(workAmount !== undefined ? { workAmount } : {}),
      ...(form.category === "tax-affairs" && form.taxAffair === "litigation" ? { taxAffair: "litigation" as const } : {}),
      kilometres,
      vehicle: carTrip ? form.vehicle.trim() : "",
      ...(carMethod === "logbook" && carTrip
        ? {
            carRecord: "trip" as const,
            ...(form.tripFrom.trim() ? { tripFrom: form.tripFrom.trim() } : {}),
            ...(form.tripTo.trim() ? { tripTo: form.tripTo.trim() } : {}),
            tripPurpose: form.tripPurpose,
            ...(times > 1 ? { tripTimes: times } : {}),
          }
        : {}),
      ...(runningCost ? { carRecord: "cost" as const, carCost: form.carCost } : {}),
      receiptId,
    });
    setForm(blankForm(year));
    setWorkLoads("");
    setMixedLoads("");
    setError(null);
    setConfirmDelete(false);
    setEditorOpen(false);
    setOpenMonths((current) => new Set([...(current ?? []), form.date.slice(0, 7)]));
    setSavedNote(editing ? "Expense updated." : "Expense added.");
    onDismiss?.();
  }

  function openNew() {
    const next = blankForm(year);
    setForm(draftDate ? { ...next, date: draftDate } : next);
    setWorkLoads("");
    setMixedLoads("");
    setError(null);
    setConfirmDelete(false);
    setEditorOpen(true);
  }

  function openExpense(expense: Expense) {
    setForm(fromExpense(expense));
    setWorkLoads("");
    setMixedLoads("");
    setError(null);
    setConfirmDelete(false);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setForm(blankForm(year));
    setWorkLoads("");
    setMixedLoads("");
    setError(null);
    setConfirmDelete(false);
    onDismiss?.();
  }

  const visible = expenses
    .filter((expense) => {
      const haystack = `${expense.description} ${expense.merchant} ${expense.notes} ${expense.vehicle ?? ""} ${expense.tripFrom ?? ""} ${expense.tripTo ?? ""} ${categoryById(expense.category).label}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description));
  const today = new Date().toISOString().slice(0, 10);
  const tripClaims =
    carMethod === "logbook" ? logbookCostClaims(expenses, summariseLogbook(expenses, logbook, today)) : carClaims(expenses, year.carCentsPerKm);
  const logbookSummary = carMethod === "logbook" ? summariseLogbook(expenses, logbook, today) : null;
  const previousTrips = [...expenses]
    .filter((expense) => isCarTrip(expense) && expense.id !== form.id && (expense.kilometres ?? 0) > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((expense, index, list) => {
      const key = `${expense.tripFrom ?? ""}|${expense.tripTo ?? ""}|${expense.description}|${expense.kilometres}`;
      return list.findIndex((item) => `${item.tripFrom ?? ""}|${item.tripTo ?? ""}|${item.description}|${item.kilometres}` === key) === index;
    });

  function commitLogbook(next: { start?: string; opening?: string; closing?: string } = {}) {
    const start = (next.start ?? logbookStart).trim();
    const openText = (next.opening ?? logbookOpening).trim();
    const closeText = (next.closing ?? logbookClosing).trim();
    if (!start && !openText && !closeText) {
      setLogbookError(null);
      return;
    }
    if (!isRealIsoDate(start) || !isWithin(start, year.start, year.end)) {
      setLogbookError(`Choose a start date inside the ${year.label} income year.`);
      return;
    }
    const opening = Number(openText);
    if (!openText || !Number.isInteger(opening) || opening < 0 || opening > 2_000_000) {
      setLogbookError("Enter the opening odometer as a whole number.");
      return;
    }
    let closingKilometres: number | null = null;
    if (closeText) {
      const closing = Number(closeText);
      if (!Number.isInteger(closing) || closing <= opening || closing > 2_000_000) {
        setLogbookError("The closing odometer must be higher than the opening reading.");
        return;
      }
      closingKilometres = closing;
    }
    setLogbookError(null);
    onLogbook({ started: start, openingKilometres: opening, closingKilometres });
  }
  const searching = query.trim().length > 0;
  const months = new Map<string, Expense[]>();
  for (const expense of visible) {
    const key = expense.date.slice(0, 7);
    const list = months.get(key) ?? [];
    list.push(expense);
    months.set(key, list);
  }
  const monthGroups = [...months.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const newestMonth = monthGroups[0]?.[0] ?? "";

  function toggleMonth(key: string) {
    setOpenMonths((current) => {
      const base = current ?? new Set(searching ? monthGroups.map(([id]) => id) : newestMonth ? [newestMonth] : []);
      const next = new Set(base);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const editorTitle = form.id ? form.description.trim() || "Edit expense" : "Add expense";

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Receipt className="mt-0.5 text-amber-700 dark:text-amber-300" size={18} aria-hidden />
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Receipts and expenses</h2>
              <p className="mt-1 text-sm leading-6 text-fog">
                Card payments, cash expenses, and work kilometres for {year.label}. A tool over $300 stays out of this total. Add it under Assets for the yearly decline in value.
              </p>
            </div>
          </div>
          <button type="button" className={cx(buttonClass.primary, "shrink-0")} onClick={openNew}>
            Add expense
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold">Working from home</p>
              <button type="button" className="focus-ring rounded-full p-1 text-fog hover:text-paper" aria-label="How the working from home methods work" onClick={() => setWfhHelp(true)}>
                <CircleHelp size={16} />
              </button>
            </div>
            <p className="mt-1 max-w-xl text-xs leading-5 text-fog">
              {wfhMethod === "actual"
                ? "Hours stay as a record. Claim the work share of energy, phone, internet, and stationery instead of 70 cents an hour."
                : "Hours on the calendar use the 70 cent rate. Energy, phone, internet, and stationery stay out of the claim."}
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-1 rounded-lg border border-line bg-ink p-1 sm:w-72 sm:shrink-0" role="group" aria-label="Working from home method">
            {(
              [
                ["fixed", "Fixed rate"],
                ["actual", "Actual costs"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={wfhMethod === value}
                className={wfhMethod === value ? "focus-ring w-full rounded-md bg-mint px-3 py-2 text-center text-sm font-semibold text-ink" : "focus-ring w-full rounded-md px-3 py-2 text-center text-sm font-semibold text-fog"}
                onClick={() => onWfhMethod(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold">Car</p>
              <button type="button" className="focus-ring rounded-full p-1 text-fog hover:text-paper" aria-label="How the car methods work" onClick={() => setCarHelp(true)}>
                <CircleHelp size={16} />
              </button>
            </div>
            <p className="mt-1 max-w-xl text-xs leading-5 text-fog">
              {carMethod === "logbook"
                ? "Record each work trip, then the fuel and other running costs. The claim is the work-use percentage, after 12 continuous weeks and a closing odometer."
                : `Work kilometres use ${formatCents(year.carCentsPerKm)} a kilometre, up to 5,000 km for each car. The rate already covers fuel, registration, insurance, servicing, and decline in value.`}
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-1 rounded-lg border border-line bg-ink p-1 sm:w-72 sm:shrink-0" role="group" aria-label="Car method">
            {(
              [
                ["cents", "Cents per km"],
                ["logbook", "Logbook"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={carMethod === value}
                className={carMethod === value ? "focus-ring w-full rounded-md bg-mint px-3 py-2 text-center text-sm font-semibold text-ink" : "focus-ring w-full rounded-md px-3 py-2 text-center text-sm font-semibold text-fog"}
                onClick={() => onCarMethod(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {carMethod === "logbook" ? (
          <div className="mt-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Logbook started">
                <input
                  className={inputClass}
                  type="date"
                  min={year.start}
                  max={year.end}
                  value={logbookStart}
                  onChange={(event) => setLogbookStart(event.target.value)}
                  onBlur={() => commitLogbook()}
                />
              </Field>
              <Field label="Opening odometer">
                <TextBox
                  inputMode="numeric"
                  placeholder="0"
                  value={logbookOpening}
                  onChange={(event) => setLogbookOpening(event.target.value)}
                  onBlur={() => commitLogbook()}
                  onClear={() => {
                    setLogbookOpening("");
                    commitLogbook({ opening: "" });
                  }}
                />
              </Field>
              <Field label="Closing odometer" hint="After 12 weeks.">
                <TextBox
                  inputMode="numeric"
                  placeholder="Later"
                  value={logbookClosing}
                  onChange={(event) => setLogbookClosing(event.target.value)}
                  onBlur={() => commitLogbook()}
                  onClear={() => {
                    setLogbookClosing("");
                    commitLogbook({ closing: "" });
                  }}
                />
              </Field>
            </div>
            {logbookError ? <p className="mt-2 text-sm text-rose">{logbookError}</p> : null}
            {logbookSummary ? <p className="mt-2 text-sm text-fog">{logbookSummary.note}</p> : null}
          </div>
        ) : null}
        {savedNote ? <p className="mt-3 text-sm text-mint">{savedNote}</p> : null}
      </Panel>
      {editorOpen ? (
      <Modal wide title={editorTitle} onClose={closeEditor}>
        <form onSubmit={save} autoComplete="off">
          {form.category === "car" && carMethod === "logbook" ? (
            <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg border border-line bg-ink p-1" role="group" aria-label="Car record">
              {(
                [
                  ["trip", "Trip"],
                  ["cost", "Running cost"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={form.carRecord === value}
                  className={form.carRecord === value ? "focus-ring rounded-md bg-mint px-3 py-2 text-sm font-semibold text-ink" : "focus-ring rounded-md px-3 py-2 text-sm font-semibold text-fog"}
                  onClick={() => setForm({ ...form, carRecord: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={form.category === "car" && !(carMethod === "logbook" && form.carRecord === "cost") ? "Purpose" : "Description"} required>
              <TextBox
                required
                maxLength={160}
                value={form.description}
                placeholder={form.category === "car" && form.carRecord === "cost" && carMethod === "logbook" ? "Fuel, March" : form.category === "car" ? "Client meeting, Brisbane" : "Desk chair"}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>
            <Field label="Date" required>
              <input className={inputClass} type="date" required min={year.start} max={year.end} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </Field>
            {form.category === "car" && form.carRecord !== "cost" ? (
              <Field label="Kilometres" required hint={carMethod === "logbook" ? "Work kilometres for this trip. A repeat uses Times." : `The ${year.label} rate is ${formatCents(year.carCentsPerKm)} a kilometre.`}>
                <TextBox inputMode="decimal" placeholder="0" value={form.kilometres} onChange={(event) => setForm({ ...form, kilometres: event.target.value })} />
              </Field>
            ) : (
              <Field label="Amount (AUD)" required hint="Full cost for equipment. Work-related amount for other expenses.">
                <TextBox inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
              </Field>
            )}
            <Field
              label="Category"
              hint={
                form.category === "car" && carMethod === "logbook"
                  ? "A trip records kilometres. A running cost is the bill the percentage applies to."
                  : CATEGORY_HINTS[form.category]
              }
            >
              <select className={inputClass} value={form.category} onChange={(event) => updateCategory(event.target.value as ExpenseCategory)}>
                {CATEGORIES.filter((category) => wfhMethod === "actual" || !isRunningCost(category.id) || category.id === form.category).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </Field>
            {canShareWork(form.category) ? (
              <Field label="Work share" hint={equipment ? "The $300 test uses the full cost. The claim uses this share." : "Leave this on all of it when the expense is fully for work."}>
                <select className={inputClass} value={form.shareMode} onChange={(event) => setForm({ ...form, shareMode: event.target.value as FormState["shareMode"] })}>
                  <option value="all">All of it</option>
                  <option value="percent">A percentage</option>
                  <option value="amount">A dollar amount</option>
                </select>
              </Field>
            ) : null}
            {canShareWork(form.category) && form.shareMode === "percent" ? (
              <Field label="Work use %">
                <TextBox inputMode="numeric" value={form.workUsePercent} onChange={(event) => setForm({ ...form, workUsePercent: event.target.value })} />
              </Field>
            ) : null}
            {canShareWork(form.category) && form.shareMode === "amount" ? (
              <Field label="Work dollars" hint="The part of the bill that was for work.">
                <TextBox inputMode="decimal" placeholder="0.00" value={form.workAmount} onChange={(event) => setForm({ ...form, workAmount: event.target.value })} />
              </Field>
            ) : null}
            {form.category === "tax-affairs" ? (
              <Field label="Type" hint="ATO interest is left out. The ATO prefills that.">
                <select className={inputClass} value={form.taxAffair} onChange={(event) => setForm({ ...form, taxAffair: event.target.value as TaxAffair })}>
                  <option value="other">Other costs of managing tax affairs</option>
                  <option value="litigation">Litigation</option>
                </select>
              </Field>
            ) : null}
            {form.category === "car" && form.carRecord === "cost" ? (
              <Field label="Cost">
                <select className={inputClass} value={form.carCost} onChange={(event) => setForm({ ...form, carCost: event.target.value as CarCostKind })}>
                  {CAR_COSTS.map((cost) => (
                    <option key={cost.id} value={cost.id}>
                      {cost.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : form.category === "car" && carMethod === "logbook" ? (
              <Field label="Times" hint="Use this when the same trip happened more than once.">
                <TextBox inputMode="numeric" value={form.tripTimes} onChange={(event) => setForm({ ...form, tripTimes: event.target.value })} />
              </Field>
            ) : form.category === "car" ? (
              <Field label="Vehicle" hint="The 5,000 km cap is per car. Leave this blank if you use one car.">
                <TextBox maxLength={80} placeholder="Car" value={form.vehicle} onChange={(event) => setForm({ ...form, vehicle: event.target.value })} />
              </Field>
            ) : (
              <Field label="Paid by">
                <select className={inputClass} value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as PaymentMethod })}>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {form.category === "car" && form.carRecord !== "cost" ? null : (
              <Field label="Merchant" hint="Optional.">
                <TextBox maxLength={80} value={form.merchant} onChange={(event) => setForm({ ...form, merchant: event.target.value })} />
              </Field>
            )}
          </div>
          {form.category === "car" && carMethod === "logbook" && form.carRecord !== "cost" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="From">
                <TextBox maxLength={80} placeholder="Home" value={form.tripFrom} onChange={(event) => setForm({ ...form, tripFrom: event.target.value })} />
              </Field>
              <Field label="To">
                <TextBox maxLength={80} placeholder="Client" value={form.tripTo} onChange={(event) => setForm({ ...form, tripTo: event.target.value })} />
              </Field>
              <Field label="Why">
                <select className={inputClass} value={form.tripPurpose} onChange={(event) => setForm({ ...form, tripPurpose: event.target.value as TripPurpose })}>
                  <option value="work">Work</option>
                  <option value="self-education">Self-education</option>
                </select>
              </Field>
            </div>
          ) : null}
          {form.category === "car" && carMethod === "logbook" && form.carRecord !== "cost" && previousTrips.length > 0 ? (
            <div className="mt-3">
              <Field label="Use a trip again">
                <select
                  className={inputClass}
                  value=""
                  onChange={(event) => {
                    const trip = previousTrips.find((item) => item.id === event.target.value);
                    if (!trip) return;
                    setForm({
                      ...form,
                      description: trip.description,
                      kilometres: trip.kilometres == null ? "" : String(trip.kilometres),
                      tripFrom: trip.tripFrom ?? "",
                      tripTo: trip.tripTo ?? "",
                      tripPurpose: trip.tripPurpose === "self-education" ? "self-education" : "work",
                      tripTimes: "1",
                      vehicle: trip.vehicle ?? "",
                    });
                  }}
                >
                  <option value="">Choose a saved trip</option>
                  {previousTrips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.tripFrom && trip.tripTo ? `${trip.tripFrom} to ${trip.tripTo}` : trip.description}
                      {trip.kilometres ? ` · ${trip.kilometres} km` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}
          {form.category === "car" && carMethod === "logbook" && form.carRecord === "cost" ? (
            <div className="mt-3 sm:max-w-xs">
              <Field label="Paid by">
                <select className={inputClass} value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as PaymentMethod })}>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}
          <Field label="Note">
            <TextBox maxLength={500} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </Field>

          {form.category === "laundry" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Work-only loads">
                <TextBox inputMode="numeric" value={workLoads} onChange={(event) => setWorkLoads(event.target.value)} />
              </Field>
              <Field label="Mixed loads">
                <TextBox inputMode="numeric" value={mixedLoads} onChange={(event) => setMixedLoads(event.target.value)} />
              </Field>
              <button type="button" className={buttonClass.ghost} disabled={suggestedLaundry <= 0} onClick={() => setForm({ ...form, amount: suggestedLaundry.toFixed(2) })}>
                Use {formatMoney(suggestedLaundry)}
              </button>
            </div>
          ) : null}

          {form.category === "donations" ? (
            <label className="mt-3 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 size-4 accent-[var(--mint)]" checked={form.dgrConfirmed} onChange={(event) => setForm({ ...form, dgrConfirmed: event.target.checked })} />
              <span>This organisation is a deductible gift recipient. Until you confirm, the gift stays out of the total.</span>
            </label>
          ) : null}

          {form.category === "self-education" || form.category === "other" ? (
            <label className="mt-3 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 size-4 accent-[var(--mint)]" checked={form.isEquipment} onChange={(event) => setForm({ ...form, isEquipment: event.target.checked })} />
              <span>This is equipment, so the $300 test applies.</span>
            </label>
          ) : null}

          <div
            className={cx("mt-4 rounded-xl border p-3", dragOver ? "border-dashed border-mint" : "border-line")}
            onDragEnter={(event) => {
              event.preventDefault();
              dragDepth.current += 1;
              setDragOver(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              dragDepth.current -= 1;
              if (dragDepth.current <= 0) {
                dragDepth.current = 0;
                setDragOver(false);
              }
            }}
            onDrop={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              dragDepth.current = 0;
              setDragOver(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void attachReceipt(file);
            }}
          >
            <p className="text-sm font-medium">Receipt or invoice</p>
            <p className="mt-1 text-xs leading-5 text-fog">Drop a photo, PDF, or Word file. It is encrypted with your records before upload, and it travels with a backup.</p>
            {dragOver ? <p className="mt-2 text-sm text-mint">Drop the file to attach it</p> : null}
            {receiptPreview ? (
              <button type="button" className="mt-3 block text-left" onClick={() => setViewing({ src: receiptPreview, title: form.description.trim() || "Receipt" })}>
                <ReceiptBody src={receiptPreview} compact />
              </button>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <label className={cx(buttonClass.ghost, "cursor-pointer", compressing && "opacity-50")}>
                <ImagePlus size={16} /> {compressing ? "Preparing file…" : receiptPreview ? "Replace file" : "Attach file"}
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={compressing}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void attachReceipt(file);
                  }}
                />
              </label>
              {receiptPreview ? (
                <button type="button" className={buttonClass.ghost} onClick={() => setForm((current) => ({ ...current, pendingImage: null, removeReceipt: true }))}>
                  Remove file
                </button>
              ) : null}
            </div>
          </div>

          {form.category === "car" && carMethod !== "logbook" && Number.isFinite(Number(form.kilometres)) && Number(form.kilometres) > 0 ? (
            <p className="mt-3 text-sm text-fog">{carPreview(form.kilometres, form.vehicle, expenses, form.id, year.carCentsPerKm)}</p>
          ) : null}
          {form.category === "car" && carMethod === "logbook" && form.carRecord !== "cost" ? (
            <p className="mt-3 text-sm text-fog">
              {form.tripPurpose === "self-education"
                ? "A trip from home or work to the course and back can be claimable. A trip that continues on to work or home after the course is not. "
                : ""}
              This trip adds kilometres to the logbook. It does not add a dollar amount.
            </p>
          ) : null}
          {form.category === "car" && carMethod === "logbook" && form.carRecord === "cost" ? (
            <p className="mt-3 text-sm text-fog">This cost counts once the logbook is ready. The claim is the work-use percentage of the bill.</p>
          ) : null}
          {preview === "immediate" && Number.isFinite(workUse) ? (
            <p className="mt-3 text-sm text-fog">$300 or under · immediate write-off of {formatMoney(portionCents(amountValue, workUse) / 100)}</p>
          ) : null}
          {preview === "depreciating" ? (
            <p className="mt-3 text-sm text-fog">Over $300 · the full price stays out of this total. Add it under Assets for the yearly claim.</p>
          ) : null}
          {form.category === "donations" && Number.isFinite(amountValue) && amountValue > 0 && amountValue < 2 ? (
            <p className="mt-3 text-sm text-fog">Under $2 · this gift stays out of the total.</p>
          ) : null}
          {error ? <p className="mt-3 text-sm text-rose">{error}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {form.id ? (
              confirmDelete ? (
                <button
                  className={buttonClass.danger}
                  type="button"
                  onClick={() => {
                    onDelete(form.id);
                    closeEditor();
                  }}
                >
                  Confirm delete
                </button>
              ) : (
                <button className={buttonClass.danger} type="button" onClick={() => setConfirmDelete(true)}>
                  Delete
                </button>
              )
            ) : null}
            <button className={buttonClass.ghost} type="button" onClick={closeEditor}>
              Cancel
            </button>
            <button className={buttonClass.primary} type="submit" disabled={compressing}>
              Save
            </button>
          </div>
        </form>
      </Modal>
      ) : null}

      <div className="space-y-3">
        {expenses.length > 0 ? (
          <TextBox
            placeholder="Search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpenMonths(null);
            }}
          />
        ) : null}
        {visible.length === 0 ? (
          <Panel>
            <p className="text-sm text-fog">
              {expenses.length === 0 ? "No expenses yet." : "Nothing matches that search."}
            </p>
          </Panel>
        ) : (
          monthGroups.map(([key, items]) => {
            const [yearText, monthText] = key.split("-");
            const label = formatMonth(Number(yearText), Number(monthText) - 1);
            const cents = items.reduce((sum, expense) => sum + toCents(expense.amount), 0);
            const open = openMonths ? openMonths.has(key) : searching || key === newestMonth;
            return (
              <section key={key} className="panel overflow-hidden rounded-2xl">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={open}
                  onClick={() => toggleMonth(key)}
                >
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="flex items-center gap-2 text-xs text-fog">
                    {items.length} · {formatCents(cents)}
                    <ChevronDown size={16} className={cx("shrink-0 transition", open && "rotate-180")} aria-hidden />
                  </span>
                </button>
                {open ? (
                  <ul className="border-t border-line">
                    {items.map((expense) => {
                      const claimCents = tripClaims.get(expense.id) ?? 0;
                      return (
                        <li key={expense.id} className="border-b border-line last:border-b-0">
                          <button type="button" className="w-full px-4 py-2.5 text-left" onClick={() => openExpense(expense)}>
                            <p className="text-sm font-semibold">{expense.description}</p>
                            <p className="mt-0.5 text-xs text-fog">
                              {expense.category === "car"
                                ? carLine(expense, claimCents, carMethod)
                                : `${expense.date.split("-").reverse().join("/")} · ${formatCents(toCents(expense.amount))} · ${categoryById(expense.category).label}${expense.category === "tax-affairs" && expense.taxAffair === "litigation" ? " · Litigation" : ""}${expense.merchant ? ` · ${expense.merchant}` : ""} · ${expenseStatus(expense, claimCents)}`}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </section>
            );
          })
        )}
      </div>
      {viewing ? <ReceiptPreview src={viewing.src} title={viewing.title} onClose={() => setViewing(null)} /> : null}
      {wfhHelp ? (
        <Modal title="Working from home" onClose={() => setWfhHelp(false)}>
          <div className="space-y-4 text-sm leading-6">
            <p className="text-fog">Use one method for the income year. Do not claim 70 cents an hour and the same power, phone, internet, or stationery bills.</p>
            <div>
              <p className="font-semibold">Fixed rate</p>
              <p className="mt-1 text-fog">
                Log the hours you actually worked from home. TaxTrack multiplies those hours by {formatCents(year.wfhCentsPerHour)}, then drops the cents. Ten hours is $7.
              </p>
              <p className="mt-2 text-fog">
                That rate already covers electricity and gas, phone, internet, and stationery. Keep at least one of those bills, and leave the bills out of Expenses. A desk, computer, or other asset is still claimed on its own, under Assets.
              </p>
            </div>
            <div>
              <p className="font-semibold">Actual costs</p>
              <p className="mt-1 text-fog">
                The hours on the calendar only show that you worked from home. They do not become dollars. Add each bill under Electricity and gas, Phone, Internet, or Stationery, and set the work share.
              </p>
              <p className="mt-2 text-fog">
                Example: a $420 power bill that was 15% for work becomes $63. Phone, internet, and stationery use the same step. A few weeks of your work calls and data is a common way to choose the phone and internet percentage. Keep each bill.
              </p>
            </div>
            <p className="text-fog">Rent, mortgage interest, and council rates on your own home stay out of both methods.</p>
            <a className="inline-flex text-sm font-semibold text-mint" href="/faq#working-from-home">
              Read more in Help
            </a>
          </div>
        </Modal>
      ) : null}
      {carHelp ? (
        <Modal title="Car methods" onClose={() => setCarHelp(false)}>
          <div className="space-y-4 text-sm leading-6">
            <div>
              <p className="font-semibold">Cents per kilometre</p>
              <p className="mt-1 text-fog">
                Enter the work kilometres. TaxTrack multiplies them by this year’s rate, {formatCents(year.carCentsPerKm)} a kilometre, and stops at 5,000 km for each car. That rate already covers fuel, registration, insurance, servicing, and the car’s decline in value. Do not add those receipts.
              </p>
            </div>
            <div>
              <p className="font-semibold">Logbook</p>
              <p className="mt-1 text-fog">
                Keep a log for 12 continuous weeks. Record the odometer at the start, each work trip, and the odometer at the end. Work use is the work kilometres divided by all the kilometres in those weeks.
              </p>
              <p className="mt-2 text-fog">
                Example: the odometer goes from 10,000 to 11,000. That is 1,000 km. The work trips add up to 600 km. Work use is 60%.
              </p>
              <p className="mt-2 text-fog">
                Then add the year’s car bills, such as fuel, registration, insurance, and servicing. The claim is 60% of those bills. A $200 fuel receipt becomes $120. The trips themselves do not add dollars.
              </p>
              <p className="mt-2 text-fog">
                Mark the car under Assets and decline in value uses the same 60%. The claim stays out until the 12 weeks and the closing odometer are both filled in.
              </p>
            </div>
            <a className="inline-flex text-sm font-semibold text-mint" href="/faq#car-kilometres">
              Read more in Help
            </a>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function ReceiptBody({ src, compact = false }: { src: string; compact?: boolean }) {
  const kind = receiptKind(src);
  const label = receiptLabel(src);
  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={label} className={compact ? "h-16 rounded-md border border-line" : "max-h-[70vh] w-full rounded-lg border border-line object-contain"} />
    );
  }
  return <span className="inline-flex rounded-lg border border-line px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300">{label}</span>;
}

function carPreview(kilometres: string, vehicle: string, expenses: Expense[], editingId: string, centsPerKm: number): string {
  const entered = Number(kilometres);
  const hundredths = Math.round(entered * 100);
  const tripCents = Math.round((hundredths * centsPerKm) / 100);
  const name = vehicleName(vehicle);
  const logged = expenses
    .filter((expense) => expense.category === "car" && expense.id !== editingId && vehicleName(expense.vehicle) === name)
    .reduce((sum, expense) => sum + Math.round((expense.kilometres ?? 0) * 100), 0);
  const total = (logged + hundredths) / 100;
  const cap = total > 5000 ? " Only the first 5,000 km for this car count." : "";
  return `${formatKilometres(hundredths / 100)} km × ${formatCents(centsPerKm)} = ${formatCents(tripCents)}.${cap}`;
}

function carLine(expense: Expense, claimCents: number, method: CarMethod): string {
  const date = expense.date.split("-").reverse().join("/");
  if (isCarCost(expense)) {
    const status = method === "logbook" ? (claimCents > 0 ? formatCents(claimCents) : "Waiting on the logbook") : "In the rate";
    return `${date} · ${formatCents(toCents(expense.amount))} · ${carCostLabel(expense.carCost)} · ${status}`;
  }
  const times = expense.tripTimes && expense.tripTimes > 1 ? ` · ${expense.tripTimes} times` : "";
  const route = expense.tripFrom && expense.tripTo ? `${expense.tripFrom} to ${expense.tripTo} · ` : "";
  if (method === "logbook") return `${date} · ${route}${formatKilometres(expense.kilometres ?? 0)} km${times} · Logbook trip`;
  return `${date} · ${formatKilometres(expense.kilometres ?? 0)} km · ${vehicleName(expense.vehicle)} · ${claimCents <= 0 ? "Over 5,000 km" : formatCents(claimCents)}`;
}

function expenseStatus(expense: Expense, claimCents: number): string {
  if (expense.category === "unsure") return "Not in the total";
  if (expense.category === "car") return claimCents <= 0 ? "Over 5,000 km" : formatCents(claimCents);
  const treatment = assetTreatment(expense);
  if (treatment === "depreciating") return "Not in the total";
  if (treatment === "immediate") return expense.workUsePercent === 100 ? "Immediate" : `Immediate · ${expense.workUsePercent}%`;
  if (expense.category === "donations" && toCents(expense.amount) < 200) return "Not deductible";
  if (expense.category === "donations" && !expense.dgrConfirmed) return "Confirm DGR";
  if (typeof expense.workAmount === "number") return `${formatCents(toCents(expense.workAmount))} work`;
  if (canShareWork(expense.category) && expense.workUsePercent < 100) return `${expense.workUsePercent}% work`;
  return PAYMENT_METHODS.find((method) => method.id === expense.paymentMethod)?.label ?? "";
}
