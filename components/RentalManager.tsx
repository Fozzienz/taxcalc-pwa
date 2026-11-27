"use client";

import { useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import type { FinancialYear } from "@/lib/ato-rules";
import { formatMonth, isRealIsoDate, isWithin } from "@/lib/dates";
import { formatCents, toCents } from "@/lib/money";
import { isRentalIncome, RENTAL_EXPENSE_CATEGORIES, RENTAL_INCOME_CATEGORIES, rentalCategoryById, type RentalCategory, type RentalExpense, type RentalProperty } from "@/lib/types";
import { buttonClass, cx, Field, inputClass, Modal, Panel, TextBox } from "@/components/ui";

export function RentalManager({
  year,
  properties,
  expenses,
  onAddProperty,
  onRenameProperty,
  onRemoveProperty,
  onSave,
  onDelete,
}: {
  year: FinancialYear;
  properties: RentalProperty[];
  expenses: RentalExpense[];
  onAddProperty: (address: string) => string;
  onRenameProperty: (id: string, address: string) => void;
  onRemoveProperty: (id: string) => void;
  onSave: (expense: RentalExpense) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [street, setStreet] = useState("");
  const [suburb, setSuburb] = useState("");
  const [stateName, setStateName] = useState("QLD");
  const [postcode, setPostcode] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(properties[0]?.id ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [category, setCategory] = useState<RentalCategory>("council-rates");
  const [record, setRecord] = useState<"income" | "expense">("expense");
  const [date, setDate] = useState(year.start);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [openMonths, setOpenMonths] = useState<Set<string> | null>(null);
  const [monthProperty, setMonthProperty] = useState(properties[0]?.id ?? "");
  const selected = properties.find((property) => property.id === selectedId) ?? properties[0];
  if (selected && monthProperty !== selected.id) {
    setMonthProperty(selected.id);
    setOpenMonths(null);
  }
  const rows = expenses.filter((expense) => expense.propertyId === selected?.id).sort((a, b) => b.date.localeCompare(a.date));

  function closeAddress() {
    setAdding(false);
    setStreet("");
    setSuburb("");
    setStateName("QLD");
    setPostcode("");
    setAddressError(null);
  }

  function addProperty() {
    const line = street.trim();
    const place = suburb.trim();
    const code = postcode.trim();
    if (!line || !place || !/^\d{4}$/.test(code)) {
      setAddressError("Enter the street, suburb, and a 4-digit postcode.");
      return;
    }
    const id = onAddProperty(`${line}, ${place} ${stateName} ${code}`);
    setSelectedId(id);
    setConfirmRemove(false);
    closeAddress();
  }

  function saveRename() {
    const next = renameValue.trim();
    if (!selected || !next) return;
    onRenameProperty(selected.id, next);
    setRenaming(false);
  }

  function saveExpense() {
    if (!selected) return;
    if (!isRealIsoDate(date) || !isWithin(date, year.start, year.end)) {
      setSavedNote(null);
      setFormError(`Choose a date inside the ${year.label} income year.`);
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) {
      setSavedNote(null);
      setFormError("Enter an amount greater than zero.");
      return;
    }
    const cents = Math.round(value * 100);
    if (Math.abs(value * 100 - cents) > 0.001) {
      setSavedNote(null);
      setFormError("Use dollars and cents, such as 400.00.");
      return;
    }
    const title = description.trim() || rentalCategoryById(category).label;
    if (title.length > 160) {
      setSavedNote(null);
      setFormError("Keep the description to 160 characters.");
      return;
    }
    onSave({
      id: "",
      propertyId: selected.id,
      date,
      amount: cents / 100,
      category,
      description: title,
      notes: notes.trim(),
    });
    setAmount("");
    setDescription("");
    setNotes("");
    setFormError(null);
    setOpenMonths((current) => new Set([...(current ?? []), date.slice(0, 7)]));
    setSavedNote(record === "income" ? "Rent added." : "Expense added.");
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 text-violet-700 dark:text-violet-300" size={18} aria-hidden />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Rental properties</h2>
            <p className="mt-1 text-sm leading-6 text-fog">
              For each address, log the rent you were paid and the expenses you paid in {year.label}. Keep rates, water, land tax, insurance, loan interest, agent fees, body corporate, and repairs. TaxTrack adds the amounts. Decline in value and capital improvements stay with your tax agent.
            </p>
          </div>
        </div>
        <button type="button" className={cx(buttonClass.primary, "mt-4")} onClick={() => setAdding(true)}>
          Add address
        </button>
      </Panel>

      {adding ? (
        <Modal title="Add address" onClose={closeAddress}>
          <form
            className="grid gap-3"
            autoComplete="on"
            onSubmit={(event) => {
              event.preventDefault();
              addProperty();
            }}
          >
            <Field label="Street">
              <TextBox
                name="address-line1"
                autoComplete="section-rental address-line1"
                value={street}
                onChange={(event) => setStreet(event.target.value)}
              />
            </Field>
            <Field label="Suburb">
              <TextBox
                name="address-level2"
                autoComplete="section-rental address-level2"
                value={suburb}
                onChange={(event) => setSuburb(event.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="State">
                <select
                  className={inputClass}
                  name="address-level1"
                  autoComplete="section-rental address-level1"
                  value={stateName}
                  onChange={(event) => setStateName(event.target.value)}
                >
                  {["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Postcode">
                <TextBox
                  name="postal-code"
                  autoComplete="section-rental postal-code"
                  inputMode="numeric"
                  maxLength={4}
                  value={postcode}
                  onChange={(event) => setPostcode(event.target.value.replace(/\D/g, "").slice(0, 4))}
                />
              </Field>
            </div>
            <p className="text-xs leading-5 text-fog">Your browser can fill a saved address.</p>
            {addressError ? <p className="text-sm text-rose">{addressError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={buttonClass.primary}>
                Add address
              </button>
              <button type="button" className={buttonClass.ghost} onClick={closeAddress}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {renaming && selected ? (
        <Modal title="Rename address" onClose={() => setRenaming(false)}>
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              saveRename();
            }}
          >
            <Field label="Address">
              <TextBox value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className={buttonClass.primary}>
                Save address
              </button>
              <button type="button" className={buttonClass.ghost} onClick={() => setRenaming(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {properties.length === 0 ? (
        <Panel>
          <p className="text-sm text-fog">Add an address to start a rental record for this income year.</p>
        </Panel>
      ) : (
        <>
          <div className="panel overflow-hidden rounded-2xl" role="tablist" aria-label="Rental properties">
            {properties.map((property) => {
              const active = property.id === selected?.id;
              return (
                <button
                  key={property.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={
                    active
                      ? "block w-full border-b border-line bg-[color-mix(in_srgb,var(--section)_14%,transparent)] px-4 py-3 text-left text-sm font-semibold leading-5 break-words text-[color:var(--section)] last:border-b-0"
                      : "block w-full border-b border-line px-4 py-3 text-left text-sm leading-5 break-words text-paper last:border-b-0"
                  }
                  onClick={() => {
                    setSelectedId(property.id);
                    setConfirmRemove(false);
                  }}
                >
                  {property.address}
                </button>
              );
            })}
          </div>

          {selected ? (
            <Panel className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Date" required>
                  <input className={inputClass} type="date" required min={year.start} max={year.end} value={date} onChange={(event) => setDate(event.target.value)} />
                </Field>
                <Field label="Amount" required>
                  <TextBox inputMode="decimal" required value={amount} placeholder="0.00" onChange={(event) => setAmount(event.target.value)} />
                </Field>
                <Field label="Record">
                  <select
                    className={inputClass}
                    value={record}
                    onChange={(event) => {
                      const next = event.target.value === "income" ? "income" : "expense";
                      setRecord(next);
                      setCategory(next === "income" ? "rent" : "council-rates");
                    }}
                  >
                    <option value="income">Rent received</option>
                    <option value="expense">Expense</option>
                  </select>
                </Field>
                <Field label={record === "income" ? "Income" : "ATO category"} hint={rentalCategoryById(category).hint}>
                  <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value as RentalCategory)}>
                    {(record === "income" ? RENTAL_INCOME_CATEGORIES : RENTAL_EXPENSE_CATEGORIES).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Description" hint="Optional. The category name is used if you leave this blank.">
                  <TextBox maxLength={160} value={description} onChange={(event) => setDescription(event.target.value)} />
                </Field>
              </div>
              <Field label="Notes">
                <TextBox value={notes} onChange={(event) => setNotes(event.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonClass.primary} onClick={saveExpense}>
                  {record === "income" ? "Add rent" : "Add expense"}
                </button>
                <button
                  type="button"
                  className={buttonClass.ghost}
                  onClick={() => {
                    setRenameValue(selected.address);
                    setRenaming(true);
                  }}
                >
                  Rename address
                </button>
                {confirmRemove ? (
                  <button
                    type="button"
                    className={buttonClass.danger}
                    onClick={() => {
                      onRemoveProperty(selected.id);
                      setConfirmRemove(false);
                      setSelectedId("");
                    }}
                  >
                    Remove address and its expenses
                  </button>
                ) : (
                  <button type="button" className={buttonClass.ghost} onClick={() => setConfirmRemove(true)}>
                    Remove address
                  </button>
                )}
              </div>
              {formError ? <p className="text-sm text-rose">{formError}</p> : null}
              {savedNote ? <p className="text-sm text-mint">{savedNote}</p> : null}
              {rows.length === 0 ? <p className="text-sm text-fog">No rent or expenses for this address in {year.label}.</p> : <RentalMonths rows={rows} openMonths={openMonths} onOpenMonths={setOpenMonths} onDelete={onDelete} />}
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}

function RentalMonths({
  rows,
  openMonths,
  onOpenMonths,
  onDelete,
}: {
  rows: RentalExpense[];
  openMonths: Set<string> | null;
  onOpenMonths: (months: Set<string> | null) => void;
  onDelete: (id: string) => void;
}) {
  const groups = new Map<string, RentalExpense[]>();
  for (const row of rows) {
    const key = row.date.slice(0, 7);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const months = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const newest = months[0]?.[0] ?? "";

  function toggle(key: string) {
    const base = openMonths ?? new Set(newest ? [newest] : []);
    const next = new Set(base);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onOpenMonths(next);
  }

  return (
    <div className="space-y-3">
      {months.map(([key, items]) => {
        const [yearText, monthText] = key.split("-");
        const label = formatMonth(Number(yearText), Number(monthText) - 1);
        const open = openMonths ? openMonths.has(key) : key === newest;
        let expenseCents = 0;
        let incomeCents = 0;
        for (const item of items) {
          const cents = toCents(item.amount);
          if (isRentalIncome(item.category)) incomeCents += cents;
          else expenseCents += cents;
        }
        const meta = [
          String(items.length),
          expenseCents > 0 ? formatCents(expenseCents) : "",
          incomeCents > 0 ? `${formatCents(incomeCents)} in` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <section key={key} className="overflow-hidden rounded-xl border border-line">
            <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left" aria-expanded={open} onClick={() => toggle(key)}>
              <span className="text-sm font-semibold">{label}</span>
              <span className="flex items-center gap-2 text-xs text-fog">
                {meta}
                <ChevronDown size={16} className={cx("shrink-0 transition", open && "rotate-180")} aria-hidden />
              </span>
            </button>
            {open ? (
              <ul className="border-t border-line">
                {items.map((expense) => (
                  <li key={expense.id} className="flex items-start justify-between gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
                    <div>
                      <p className="text-sm font-semibold">{expense.description}</p>
                      <p className="mt-0.5 text-xs text-fog">
                        {expense.date.split("-").reverse().join("/")} · {rentalCategoryById(expense.category).label}
                        {expense.notes ? ` · ${expense.notes}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCents(toCents(expense.amount))}</p>
                      <button type="button" className="mt-1 text-xs font-semibold text-rose" onClick={() => onDelete(expense.id)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
