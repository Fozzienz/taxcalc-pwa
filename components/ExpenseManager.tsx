"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { AlertTriangle, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { assetTreatment, CATEGORY_HINTS, type FinancialYear } from "@/lib/ato-rules";
import { defaultEntryDate, formatMediumDate, isRealIsoDate, isWithin } from "@/lib/dates";
import { createId } from "@/lib/id";
import { compressReceipt } from "@/lib/receiptImage";
import { putReceipt, readCachedReceipt, subscribeReceipts } from "@/lib/receiptStore";
import { formatMoney, portionCents, toCents } from "@/lib/money";
import {
  CATEGORIES,
  categoryById,
  PAYMENT_METHODS,
  type Expense,
  type ExpenseCategory,
  type PaymentMethod,
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
  expenses,
  draftDate,
  editingId,
  onSave,
  onDelete,
}: {
  year: FinancialYear;
  expenses: Expense[];
  draftDate: string | null;
  editingId: string | null;
  onSave: (expense: Expense) => void;
  onDelete: (id: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
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
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ExpenseCategory | "all" | "review">("all");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [workLoads, setWorkLoads] = useState("");
  const [mixedLoads, setMixedLoads] = useState("");
  const [compressing, setCompressing] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const storedReceipt = useReceipt(form.removeReceipt ? null : form.receiptId);
  const receiptPreview = form.pendingImage ?? storedReceipt;

  if (seenYear !== year.id) {
    setSeenYear(year.id);
    setForm(blankForm(year));
    setError(null);
  }

  useEffect(() => {
    if (!editingId && !draftDate) return;
    formRef.current?.scrollIntoView({ block: "start" });
  }, [editingId, draftDate]);

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
        category === "tools" || category === "self-education" || category === "other" ? current.workUsePercent : "100",
    }));
  }

  async function attachReceipt(file: File | undefined) {
    if (!file) return;
    setCompressing(true);
    setError(null);
    try {
      const pendingImage = await compressReceipt(file);
      setForm((current) => ({ ...current, pendingImage, removeReceipt: false }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That photo could not be prepared.");
    } finally {
      setCompressing(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!isRealIsoDate(form.date) || !isWithin(form.date, year.start, year.end)) {
      setError(`Choose a date inside the ${year.label} income year.`);
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      setError("Enter an amount greater than zero.");
      return;
    }
    const cents = Math.round(amount * 100);
    if (Math.abs(amount * 100 - cents) > 0.001) {
      setError("Use dollars and cents, such as 24.50.");
      return;
    }
    const description = form.description.trim();
    if (!description || description.length > 160) {
      setError("Add a short description.");
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
        setError("This browser could not store the receipt photo.");
        return;
      }
    }
    onSave({
      id: form.id || createId(),
      date: form.date,
      amount: cents / 100,
      category: form.category,
      description,
      merchant: form.merchant.trim(),
      paymentMethod: form.paymentMethod,
      notes: form.notes.trim(),
      dgrConfirmed: form.category === "donations" ? form.dgrConfirmed : false,
      isEquipment: form.category === "self-education" || form.category === "other" ? form.isEquipment : false,
      workUsePercent: equipment ? percent : 100,
      receiptId,
    });
    setForm(blankForm(year));
    setWorkLoads("");
    setMixedLoads("");
    setError(null);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  const visible = expenses
    .filter((expense) => {
      if (filter === "review") return needsReview(expense);
      if (filter !== "all") return expense.category === filter;
      return true;
    })
    .filter((expense) => {
      const haystack = `${expense.description} ${expense.merchant} ${expense.notes} ${categoryById(expense.category).label}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Receipts and expenses</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-fog">
          Log card payments and cash expenses. Items over $300 are flagged as depreciating assets instead of immediate write-offs.
        </p>
      </div>

      <Panel>
        <form ref={formRef} className="space-y-4" onSubmit={save} autoComplete="off">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">{form.id ? "Edit expense" : "Add an expense"}</h3>
            {saved ? <span className="text-sm text-mint">Saved on this device</span> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date">
              <input className={inputClass} type="date" required min={year.start} max={year.end} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            </Field>
            <Field label="Amount" hint="Full cost for equipment. Work-related amount for other expenses.">
              <input className={inputClass} inputMode="decimal" type="number" min="0.01" step="0.01" required placeholder="0.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
            </Field>
          </div>
          <Field label="Category" hint={CATEGORY_HINTS[form.category]}>
            <select className={inputClass} value={form.category} onChange={(event) => updateCategory(event.target.value as ExpenseCategory)}>
              {CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </Field>

          {form.category === "laundry" ? (
            <div className="rounded-2xl border border-line p-3">
              <p className="text-sm font-medium">Laundry basis</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Work-only loads">
                  <input className={inputClass} type="number" min="0" step="1" value={workLoads} onChange={(event) => setWorkLoads(event.target.value)} />
                </Field>
                <Field label="Mixed loads">
                  <input className={inputClass} type="number" min="0" step="1" value={mixedLoads} onChange={(event) => setMixedLoads(event.target.value)} />
                </Field>
              </div>
              <button
                type="button"
                className={cx(buttonClass.ghost, "mt-3")}
                disabled={suggestedLaundry <= 0}
                onClick={() => setForm({ ...form, amount: suggestedLaundry.toFixed(2) })}
              >
                Use {formatMoney(suggestedLaundry)} · $1 a work-only load, 50c mixed
              </button>
            </div>
          ) : null}

          {form.category === "donations" ? (
            <div className="space-y-2">
              {Number.isFinite(amountValue) && amountValue > 0 && amountValue < 2 ? (
                <p className="flex gap-2 text-sm text-gold">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" /> Gifts under $2 are not deductible. This one will stay out of the total.
                </p>
              ) : null}
              <label className="flex items-start gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm">
                <input type="checkbox" className="mt-1 size-4" checked={form.dgrConfirmed} onChange={(event) => setForm({ ...form, dgrConfirmed: event.target.checked })} />
                <span>
                  <span className="block font-medium text-gold">I have checked this organisation is a DGR</span>
                  <span className="mt-1 block text-fog">TaxTrack holds the gift out of the myTax total until you confirm.</span>
                </span>
              </label>
            </div>
          ) : null}

          {form.category === "self-education" || form.category === "other" ? (
            <label className="flex items-start gap-3 rounded-2xl border border-line p-3 text-sm">
              <input type="checkbox" className="mt-1 size-4 accent-[var(--mint)]" checked={form.isEquipment} onChange={(event) => setForm({ ...form, isEquipment: event.target.checked })} />
              <span>
                <span className="block font-medium">This is equipment</span>
                <span className="mt-1 block text-fog">Turn this on for a laptop, desk, or other asset so the $300 test can flag it.</span>
              </span>
            </label>
          ) : null}

          {equipment ? (
            <Field label="Work use %" hint="The $300 test uses the full cost. An immediate write-off uses this percentage. Decline in value is not calculated.">
              <input className={inputClass} type="number" min={1} max={100} step={1} value={form.workUsePercent} onChange={(event) => setForm({ ...form, workUsePercent: event.target.value })} />
            </Field>
          ) : null}

          {preview === "immediate" && Number.isFinite(workUse) ? (
            <p className="rounded-2xl border border-mint/30 bg-mint/10 px-3 py-2 text-sm text-mint">
              $300 or under. Immediate write-off of {formatMoney(portionCents(amountValue, workUse) / 100)}.
            </p>
          ) : null}
          {preview === "depreciating" ? (
            <p className="flex gap-2 rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              Over $300. This is a depreciating asset, so the full price stays out of the immediate deduction.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Description">
              <input className={inputClass} required maxLength={160} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </Field>
            <Field label="Merchant" hint="Optional.">
              <input className={inputClass} maxLength={80} value={form.merchant} onChange={(event) => setForm({ ...form, merchant: event.target.value })} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <Field label="Paid by">
              <select className={inputClass} value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as PaymentMethod })}>
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Note">
              <input className={inputClass} maxLength={500} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            </Field>
          </div>
          <div className="rounded-lg border border-line bg-ink p-3">
            <p className="text-sm font-medium">Receipt photo</p>
            <p className="mt-1 text-xs leading-5 text-fog">
              The photo stays in this browser. TaxTrack shrinks it to a JPEG so the writing stays readable, and the copy travels with a backup file.
            </p>
            {receiptPreview ? (
              <button type="button" className="mt-3 block" onClick={() => setViewing(receiptPreview)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receiptPreview} alt="Receipt preview" className="max-h-40 rounded-lg border border-line" />
              </button>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <label className={cx(buttonClass.ghost, "cursor-pointer", compressing && "opacity-50")}>
                <ImagePlus size={16} /> {compressing ? "Preparing photo…" : receiptPreview ? "Replace photo" : "Attach photo"}
                <input
                  className="sr-only"
                  type="file"
                  accept="image/*"
                  disabled={compressing}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void attachReceipt(file);
                  }}
                />
              </label>
              {receiptPreview ? (
                <button
                  type="button"
                  className={buttonClass.ghost}
                  onClick={() => setForm((current) => ({ ...current, pendingImage: null, removeReceipt: true }))}
                >
                  Remove photo
                </button>
              ) : null}
            </div>
          </div>
          {error ? <p className="text-sm text-rose">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button className={buttonClass.primary} type="submit" disabled={compressing}>
              <Plus size={16} /> {form.id ? "Update expense" : "Save expense"}
            </button>
            {form.id ? (
              <button className={buttonClass.ghost} type="button" onClick={() => setForm(blankForm(year))}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </Panel>

      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-semibold">
            {expenses.length} logged · {formatMoney(expenses.reduce((sum, expense) => sum + toCents(expense.amount), 0) / 100)}
          </h3>
          <input className={cx(inputClass, "sm:max-w-xs")} placeholder="Search receipts" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
          <FilterChip active={filter === "review"} onClick={() => setFilter("review")} label="Review" />
          {CATEGORIES.map((category) => (
            <FilterChip key={category.id} active={filter === category.id} onClick={() => setFilter(category.id)} label={category.label} />
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="mt-6 text-sm text-fog">Nothing in this view yet. Add a receipt above, or clear the filter.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {visible.map((expense) => {
              const treatment = assetTreatment(expense);
              return (
                <li key={expense.id} className="rounded-lg border border-line bg-ink p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{expense.description}</p>
                      <p className="mt-1 text-xs text-fog">
                        {formatMediumDate(expense.date)} · {categoryById(expense.category).label}
                        {expense.merchant ? ` · ${expense.merchant}` : ""} · {PAYMENT_METHODS.find((method) => method.id === expense.paymentMethod)?.label}
                      </p>
                    </div>
                    <p className="font-mono text-sm">{formatMoney(expense.amount)}</p>
                  </div>
                  {expense.receiptId ? <ReceiptThumb id={expense.receiptId} onOpen={setViewing} /> : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {treatment === "immediate" ? <Badge tone="mint">Immediate write-off{expense.workUsePercent === 100 ? "" : ` · ${expense.workUsePercent}%`}</Badge> : null}
                    {treatment === "depreciating" ? <Badge tone="gold">Depreciating asset</Badge> : null}
                    {expense.category === "donations" && !expense.dgrConfirmed && toCents(expense.amount) >= 200 ? <Badge tone="gold">Held — confirm DGR</Badge> : null}
                    {expense.category === "donations" && toCents(expense.amount) < 200 ? <Badge tone="gold">Under $2 — not deductible</Badge> : null}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" className={cx(buttonClass.ghost, "min-h-10 px-3")} onClick={() => setForm(fromExpense(expense))}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      className={cx(buttonClass.danger, "min-h-10 px-3")}
                      onClick={() => {
                        if (pendingDelete === expense.id) onDelete(expense.id);
                        else setPendingDelete(expense.id);
                      }}
                    >
                      <Trash2 size={14} /> {pendingDelete === expense.id ? "Confirm delete" : "Delete"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      {viewing ? (
        <Modal title="Receipt photo" onClose={() => setViewing(null)} wide>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewing} alt="Receipt" className="w-full rounded-lg border border-line" />
        </Modal>
      ) : null}
    </div>
  );
}

function ReceiptThumb({ id, onOpen }: { id: string; onOpen: (src: string) => void }) {
  const src = useReceipt(id);
  if (!src) return null;
  return (
    <button type="button" className="mt-2 block" onClick={() => onOpen(src)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-16 rounded-md border border-line" />
    </button>
  );
}

function needsReview(expense: Expense): boolean {
  if (assetTreatment(expense) === "depreciating") return true;
  if (expense.category !== "donations") return false;
  return !expense.dgrConfirmed || toCents(expense.amount) < 200;
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "focus-ring shrink-0 rounded-full border px-3 py-1.5 text-xs",
        active ? "border-mint bg-mint text-ink" : "border-line text-fog",
      )}
    >
      {label}
    </button>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "mint" | "gold" }) {
  return (
    <span className={cx("rounded-full px-2 py-1 text-[11px] font-medium", tone === "mint" ? "bg-mint/15 text-mint" : "bg-gold/15 text-gold")}>
      {children}
    </span>
  );
}
