"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useSyncExternalStore } from "react";
import { ChevronDown, ImagePlus, Receipt } from "lucide-react";
import { assetTreatment, CATEGORY_HINTS, type FinancialYear } from "@/lib/ato-rules";
import { carClaims, formatKilometres, vehicleName } from "@/lib/car";
import { defaultEntryDate, formatMonth, isRealIsoDate, isWithin } from "@/lib/dates";
import { createId } from "@/lib/id";
import { prepareReceipt, receiptKind, receiptLabel } from "@/lib/receiptImage";
import { ReceiptPreview } from "@/components/ReceiptPreview";
import { putReceipt, readCachedReceipt, subscribeReceipts } from "@/lib/receiptStore";
import { formatCents, formatMoney, portionCents, toCents } from "@/lib/money";
import {
  CATEGORIES,
  categoryById,
  isRunningCost,
  PAYMENT_METHODS,
  type Expense,
  type ExpenseCategory,
  type PaymentMethod,
  type WfhMethod,
} from "@/lib/types";
import { buttonClass, cx, Field, inputClass, Modal, Panel } from "@/components/ui";

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
  kilometres: string;
  vehicle: string;
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
    kilometres: "",
    vehicle: "",
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
    kilometres: expense.kilometres == null ? "" : String(expense.kilometres),
    vehicle: expense.vehicle ?? "",
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
  expenses,
  draftDate,
  editingId,
  onSave,
  onDelete,
  onDismiss,
}: {
  year: FinancialYear;
  wfhMethod: WfhMethod;
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
      workUsePercent:
        category === "tools" || category === "self-education" || category === "other" || isRunningCost(category) ? current.workUsePercent : "100",
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
    if (!description || description.length > 160) {
      setError(form.category === "car" ? "Add where you went and why." : "Add a short description.");
      return;
    }
    const carTrip = form.category === "car";
    let amount = Number(form.amount);
    let kilometres: number | null = null;
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
      const tripCents = Math.round((hundredths * year.carCentsPerKm) / 100);
      if (tripCents <= 0) {
        setError("That distance is too short to make a claim.");
        return;
      }
      kilometres = hundredths / 100;
      amount = tripCents / 100;
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
    const percent = Number(form.workUsePercent);
    if (!Number.isInteger(percent) || percent < 1 || percent > 100) {
      setError("Work use must be a whole percentage from 1 to 100.");
      return;
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
      workUsePercent: equipment || isRunningCost(form.category) ? percent : 100,
      kilometres,
      vehicle: carTrip ? form.vehicle.trim() : "",
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
      const haystack = `${expense.description} ${expense.merchant} ${expense.notes} ${expense.vehicle ?? ""} ${categoryById(expense.category).label}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description));
  const tripClaims = carClaims(expenses, year.carCentsPerKm);
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
        {savedNote ? <p className="mt-3 text-sm text-mint">{savedNote}</p> : null}
      </Panel>
      {editorOpen ? (
      <Modal wide title={editorTitle} onClose={closeEditor}>
        <form onSubmit={save} autoComplete="off">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={form.category === "car" ? "Purpose" : "Description"} required>
              <input
                className={inputClass}
                required
                maxLength={160}
                value={form.description}
                placeholder={form.category === "car" ? "Client meeting, Brisbane" : "Desk chair"}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </Field>
            <Field label="Date" required>
              <input className={inputClass} type="date" required min={year.start} max={year.end} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </Field>
            {form.category === "car" ? (
              <Field label="Kilometres" required hint={`The ${year.label} rate is ${formatCents(year.carCentsPerKm)} a kilometre.`}>
                <input className={inputClass} inputMode="decimal" placeholder="0" value={form.kilometres} onChange={(event) => setForm({ ...form, kilometres: event.target.value })} />
              </Field>
            ) : (
              <Field label="Amount (AUD)" required hint="Full cost for equipment. Work-related amount for other expenses.">
                <input className={inputClass} inputMode="decimal" placeholder="0.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
              </Field>
            )}
            <Field label="Category" hint={CATEGORY_HINTS[form.category]}>
              <select className={inputClass} value={form.category} onChange={(event) => updateCategory(event.target.value as ExpenseCategory)}>
                {CATEGORIES.filter((category) => wfhMethod === "actual" || !isRunningCost(category.id) || category.id === form.category).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </Field>
            {equipment || isRunningCost(form.category) ? (
              <Field label="Work use %" hint={isRunningCost(form.category) ? "The claim is this share of the bill." : "The $300 test uses the full cost."}>
                <input className={inputClass} inputMode="numeric" value={form.workUsePercent} onChange={(event) => setForm({ ...form, workUsePercent: event.target.value })} />
              </Field>
            ) : null}
            {form.category === "car" ? (
              <Field label="Vehicle" hint="The 5,000 km cap is per car. Leave this blank if you use one car.">
                <input className={inputClass} maxLength={80} placeholder="Car" value={form.vehicle} onChange={(event) => setForm({ ...form, vehicle: event.target.value })} />
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
            {form.category === "car" ? null : (
              <Field label="Merchant" hint="Optional.">
                <input className={inputClass} maxLength={80} value={form.merchant} onChange={(event) => setForm({ ...form, merchant: event.target.value })} />
              </Field>
            )}
          </div>
          <Field label="Note">
            <input className={inputClass} maxLength={500} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </Field>

          {form.category === "laundry" ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Work-only loads">
                <input className={inputClass} inputMode="numeric" value={workLoads} onChange={(event) => setWorkLoads(event.target.value)} />
              </Field>
              <Field label="Mixed loads">
                <input className={inputClass} inputMode="numeric" value={mixedLoads} onChange={(event) => setMixedLoads(event.target.value)} />
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

          {form.category === "car" && Number.isFinite(Number(form.kilometres)) && Number(form.kilometres) > 0 ? (
            <p className="mt-3 text-sm text-fog">{carPreview(form.kilometres, form.vehicle, expenses, form.id, year.carCentsPerKm)}</p>
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
          <input
            className={inputClass}
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
                                ? `${expense.date.split("-").reverse().join("/")} · ${formatKilometres(expense.kilometres ?? 0)} km · ${vehicleName(expense.vehicle)} · ${expenseStatus(expense, claimCents)}`
                                : `${expense.date.split("-").reverse().join("/")} · ${formatCents(toCents(expense.amount))} · ${categoryById(expense.category).label}${expense.merchant ? ` · ${expense.merchant}` : ""} · ${expenseStatus(expense, claimCents)}`}
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

function expenseStatus(expense: Expense, claimCents: number): string {
  if (expense.category === "car") return claimCents <= 0 ? "Over 5,000 km" : formatCents(claimCents);
  const treatment = assetTreatment(expense);
  if (treatment === "depreciating") return "Not in the total";
  if (treatment === "immediate") return expense.workUsePercent === 100 ? "Immediate" : `Immediate · ${expense.workUsePercent}%`;
  if (expense.category === "donations" && toCents(expense.amount) < 200) return "Not deductible";
  if (expense.category === "donations" && !expense.dgrConfirmed) return "Confirm DGR";
  return PAYMENT_METHODS.find((method) => method.id === expense.paymentMethod)?.label ?? "";
}
