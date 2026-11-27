"use client";

import { useState } from "react";
import { ChevronDown, Laptop } from "lucide-react";
import type { FinancialYear } from "@/lib/ato-rules";
import { formatMonth } from "@/lib/dates";
import { summariseLogbook } from "@/lib/car";
import { assetYearClaim, depreciationMethodLabel, depreciationSchedule, isImmediateAsset } from "@/lib/depreciation";
import { formatCents, toCents } from "@/lib/money";
import type { CarLogbook, CarMethod, DepreciatingAsset, DepreciationMethod, Expense } from "@/lib/types";
import { buttonClass, cx, Field, inputClass, Modal, Panel, TextBox } from "@/components/ui";

function todayIso(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function blank(date: string): DepreciatingAsset {
  return {
    id: "",
    description: "",
    purchased: date,
    cost: 0,
    effectiveLifeYears: 4,
    workUsePercent: 100,
    method: "prime-cost",
    notes: "",
  };
}

export function AssetManager({
  year,
  assets,
  expenses,
  carMethod,
  logbook,
  onSave,
  onDelete,
}: {
  year: FinancialYear;
  assets: DepreciatingAsset[];
  expenses: Expense[];
  carMethod: CarMethod;
  logbook: CarLogbook | undefined;
  onSave: (asset: DepreciatingAsset) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<DepreciatingAsset>(() => blank(todayIso()));
  const [price, setPrice] = useState("");
  const [life, setLife] = useState("4");
  const [usePercent, setUsePercent] = useState("100");
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [openMonths, setOpenMonths] = useState<Set<string> | null>(null);
  const cost = Number(price);
  const years = Number(life);
  const workUse = Number(usePercent);
  const book = carMethod === "logbook" ? summariseLogbook(expenses, logbook, new Date().toISOString().slice(0, 10)) : null;
  const carContext = { applies: carMethod === "logbook", share: book?.ready ? book.share : null };
  const previewAsset: DepreciatingAsset | null =
    draft.description.trim() && Number.isFinite(cost) && cost > 0 && Number.isFinite(years) && years >= 1 && years <= 40 && Number.isInteger(workUse) && workUse >= 1 && workUse <= 100
      ? {
          ...draft,
          description: draft.description.trim(),
          cost,
          effectiveLifeYears: years,
          workUsePercent: workUse,
          ...(draft.logbookCar ? { logbookCar: true } : {}),
        }
      : null;
  const preview = previewAsset ? depreciationSchedule(previewAsset) : [];
  const thisYear = preview.find((row) => row.start === year.start);
  const immediate = previewAsset ? isImmediateAsset(previewAsset.cost, previewAsset.workUsePercent) : false;

  function load(asset: DepreciatingAsset) {
    setDraft(asset);
    setPrice(String(asset.cost));
    setLife(String(asset.effectiveLifeYears));
    setUsePercent(String(asset.workUsePercent));
    setError(null);
    setConfirmDelete(false);
    setEditorOpen(true);
  }

  function clear() {
    setDraft(blank(todayIso()));
    setPrice("");
    setLife("4");
    setUsePercent("100");
  }

  function openNew() {
    clear();
    setError(null);
    setConfirmDelete(false);
    setEditorOpen(true);
  }

  function closeEditor() {
    clear();
    setError(null);
    setConfirmDelete(false);
    setEditorOpen(false);
  }

  function save() {
    if (!draft.description.trim()) {
      setSavedNote(null);
      setError("Add a short description.");
      return;
    }
    if (!Number.isFinite(cost) || cost <= 0) {
      setSavedNote(null);
      setError("Enter a price greater than zero.");
      return;
    }
    if (!previewAsset) {
      setSavedNote(null);
      setError("Check the price, the work use, and the effective life.");
      return;
    }
    const editing = Boolean(draft.id);
    const savedMonth = draft.purchased.slice(0, 7);
    const { logbookCar: _flag, ...rest } = previewAsset;
    onSave(draft.logbookCar ? { ...rest, logbookCar: true } : rest);
    closeEditor();
    setOpenMonths((current) => new Set([...(current ?? []), savedMonth]));
    setSavedNote(editing ? "Asset updated." : "Asset added.");
  }

  const sorted = [...assets].sort((a, b) => b.purchased.localeCompare(a.purchased) || a.description.localeCompare(b.description));
  const months = new Map<string, DepreciatingAsset[]>();
  for (const asset of sorted) {
    const key = /^\d{4}-\d{2}/.test(asset.purchased) ? asset.purchased.slice(0, 7) : "undated";
    const list = months.get(key) ?? [];
    list.push(asset);
    months.set(key, list);
  }
  const monthGroups = [...months.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const newestMonth = monthGroups[0]?.[0] ?? "";

  function toggleMonth(key: string) {
    setOpenMonths((current) => {
      const base = current ?? new Set(newestMonth ? [newestMonth] : []);
      const next = new Set(base);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <Laptop className="mt-0.5 text-rose-700 dark:text-rose-300" size={18} aria-hidden />
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Depreciating assets</h2>
              <p className="mt-1 text-sm leading-6 text-fog">
                Laptops, tools, and equipment. Over $300, TaxTrack spreads the purchase price over the effective life. $300 or under, used mainly for work, is an immediate deduction in {year.label} when that is the year you first used it.
              </p>
            </div>
          </div>
          <button type="button" className={`${buttonClass.primary} shrink-0`} onClick={openNew}>
            Add asset
          </button>
        </div>
        {savedNote ? <p className="mt-3 text-sm text-mint">{savedNote}</p> : null}
      </Panel>
      {editorOpen ? (
      <Modal wide title={draft.id ? draft.description.trim() || "Edit asset" : "Add asset"} onClose={closeEditor}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Description" required>
            <TextBox value={draft.description} placeholder="Laptop" onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </Field>
          <Field label="First used" required hint="The day you first used it to earn income.">
            <input className={inputClass} type="date" value={draft.purchased} onChange={(event) => setDraft({ ...draft, purchased: event.target.value })} />
          </Field>
          <Field label="Purchase price (AUD)" required>
            <TextBox inputMode="decimal" value={price} placeholder="0.00" onChange={(event) => setPrice(event.target.value)} />
          </Field>
          {draft.logbookCar ? (
            <p className="self-end text-sm leading-6 text-fog">
              {book?.percent != null
                ? `Work use is ${new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format(book.percent)}% from the logbook.`
                : "The logbook is not ready, so this year's decline stays out."}
            </p>
          ) : (
            <Field label="Work use %" required>
              <TextBox inputMode="numeric" value={usePercent} onChange={(event) => setUsePercent(event.target.value)} />
            </Field>
          )}
          <Field label="Effective life (years)" required hint="Used when the cost is over $300.">
            <TextBox inputMode="decimal" value={life} onChange={(event) => setLife(event.target.value)} />
          </Field>
          {immediate ? null : (
            <Field label="Calculation">
              <select className={inputClass} value={draft.method} onChange={(event) => setDraft({ ...draft, method: event.target.value as DepreciationMethod })}>
                <option value="prime-cost">Prime cost (straight-line)</option>
                <option value="diminishing-value">Diminishing value (200%)</option>
              </select>
            </Field>
          )}
        </div>
        {carMethod === "logbook" || draft.logbookCar ? (
          <label className="mt-3 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[var(--mint)]"
              checked={draft.logbookCar === true}
              onChange={(event) => setDraft({ ...draft, logbookCar: event.target.checked })}
            />
            <span>This is the car on the logbook. Work use comes from the logbook, so you do not type it twice. A cents-per-kilometre year leaves this decline out, because the rate already includes it.</span>
          </label>
        ) : null}
        <Field label="Notes">
          <TextBox value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </Field>
        {previewAsset ? (
          <p className="mt-3 text-sm text-fog">
            {previewAsset.logbookCar ? "Logbook car" : depreciationMethodLabel(previewAsset)}
            {thisYear ? ` · ${year.label} claim ${formatCents(previewAsset.logbookCar ? assetYearClaim(previewAsset, year.start, carContext) : thisYear.claimCents)}` : ` · nothing in ${year.label}`}
            {thisYear ? ` · ${thisYear.daysHeld} days` : ""}
          </p>
        ) : null}
        {preview.length > 0 && !draft.logbookCar ? (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-xs text-fog">
                <th className="pb-2 text-left font-semibold">Income year</th>
                <th className="pb-2 text-right font-semibold">Days</th>
                <th className="pb-2 text-right font-semibold">Claim</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.start} className={row.start === year.start ? "text-mint" : undefined}>
                  <td className="py-1">{row.label}</td>
                  <td className="py-1 text-right font-mono">{row.daysHeld}</td>
                  <td className="py-1 text-right font-mono">{formatCents(row.claimCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {error ? <p className="mt-3 text-sm text-rose">{error}</p> : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {draft.id ? (
            confirmDelete ? (
              <button
                type="button"
                className={buttonClass.danger}
                onClick={() => {
                  onDelete(draft.id);
                  closeEditor();
                }}
              >
                Confirm delete
              </button>
            ) : (
              <button type="button" className={buttonClass.danger} onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            )
          ) : null}
          <button type="button" className={buttonClass.ghost} onClick={closeEditor}>
            Cancel
          </button>
          <button type="button" className={buttonClass.primary} onClick={save}>
            Save
          </button>
        </div>
      </Modal>
      ) : null}

      <div className="space-y-3">
        {assets.length === 0 ? (
          <Panel>
            <p className="text-sm text-fog">No assets yet. A tool over $300 logged under Expenses stays out of that total until you add it here.</p>
          </Panel>
        ) : (
          monthGroups.map(([key, items]) => {
            const [yearText, monthText] = key.split("-");
            const label = key === "undated" ? "Undated" : formatMonth(Number(yearText), Number(monthText) - 1);
            const cents = items.reduce((sum, asset) => sum + toCents(asset.cost), 0);
            const open = openMonths ? openMonths.has(key) : key === newestMonth;
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
                    {items.map((asset) => {
                      const schedule = depreciationSchedule(asset);
                      const current = assetYearClaim(asset, year.start, carContext);
                      return (
                        <li key={asset.id} className="border-b border-line last:border-b-0">
                          <button type="button" className="w-full px-4 py-2.5 text-left" onClick={() => load(asset)}>
                            <p className="text-sm font-semibold">{asset.description}</p>
                            <p className="mt-0.5 text-xs text-fog">
                              {asset.purchased.split("-").reverse().join("/")} · {formatCents(toCents(asset.cost))} · {depreciationMethodLabel(asset)}
                              {isImmediateAsset(asset.cost, asset.workUsePercent) ? "" : ` · ${asset.effectiveLifeYears}y`}
                              {schedule.some((row) => row.start === year.start) ? ` · ${year.label} ${formatCents(current)}` : ""}
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
    </div>
  );
}
