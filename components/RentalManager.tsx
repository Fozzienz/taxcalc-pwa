"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import type { FinancialYear } from "@/lib/ato-rules";
import { formatCents, toCents } from "@/lib/money";
import { RENTAL_EXPENSE_CATEGORIES, RENTAL_INCOME_CATEGORIES, rentalCategoryById, type RentalCategory, type RentalExpense, type RentalProperty } from "@/lib/types";
import { buttonClass, cx, Field, inputClass, Modal, Panel } from "@/components/ui";

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
  const [category, setCategory] = useState<RentalCategory>("council-rates");
  const [record, setRecord] = useState<"income" | "expense">("expense");
  const [date, setDate] = useState(year.start);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const selected = properties.find((property) => property.id === selectedId) ?? properties[0];
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

  function saveExpense() {
    if (!selected) return;
    const value = Number(amount);
    if (!description.trim() || !Number.isFinite(value) || value <= 0) return;
    onSave({
      id: "",
      propertyId: selected.id,
      date,
      amount: Math.round(value * 100) / 100,
      category,
      description: description.trim(),
      notes: notes.trim(),
    });
    setAmount("");
    setDescription("");
    setNotes("");
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 text-mint" size={18} aria-hidden />
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
              <input
                className={inputClass}
                name="address-line1"
                autoComplete="section-rental address-line1"
                value={street}
                onChange={(event) => setStreet(event.target.value)}
              />
            </Field>
            <Field label="Suburb">
              <input
                className={inputClass}
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
                <input
                  className={inputClass}
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
                      ? "block w-full border-b border-line bg-mint/10 px-4 py-3 text-left text-sm font-semibold leading-5 break-words text-mint last:border-b-0"
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
              <Field label="Address">
                <input
                  key={selected.id}
                  className={inputClass}
                  name="street-address"
                  autoComplete="section-rental street-address"
                  defaultValue={selected.address}
                  onBlur={(event) => {
                    const next = event.target.value.trim();
                    if (next) onRenameProperty(selected.id, next);
                    else event.target.value = selected.address;
                  }}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Date">
                  <input className={inputClass} type="date" min={year.start} max={year.end} value={date} onChange={(event) => setDate(event.target.value)} />
                </Field>
                <Field label="Amount">
                  <input className={inputClass} inputMode="decimal" value={amount} placeholder="0.00" onChange={(event) => setAmount(event.target.value)} />
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
                <Field label="Description">
                  <input className={inputClass} value={description} onChange={(event) => setDescription(event.target.value)} />
                </Field>
              </div>
              <Field label="Notes">
                <input className={inputClass} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonClass.primary} onClick={saveExpense}>
                  {record === "income" ? "Add rent" : "Add expense"}
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
              <ul className="divide-y divide-line">
                {rows.length === 0 ? <li className="py-3 text-sm text-fog">No rent or expenses for this address in {year.label}.</li> : null}
                {rows.map((expense) => (
                  <li key={expense.id} className="flex items-start justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-semibold">{expense.description}</p>
                      <p className="mt-1 text-xs text-fog">
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
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}
