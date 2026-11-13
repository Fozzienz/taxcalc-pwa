"use client";

import { useState } from "react";
import { Laptop } from "lucide-react";
import type { FinancialYear } from "@/lib/ato-rules";
import { depreciationMethodLabel, depreciationSchedule, isImmediateAsset } from "@/lib/depreciation";
import { formatCents, toCents } from "@/lib/money";
import type { DepreciatingAsset, DepreciationMethod } from "@/lib/types";
import { buttonClass, Field, inputClass, Panel } from "@/components/ui";

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
  onSave,
  onDelete,
}: {
  year: FinancialYear;
  assets: DepreciatingAsset[];
  onSave: (asset: DepreciatingAsset) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<DepreciatingAsset>(() => blank(todayIso()));
  const [price, setPrice] = useState("");
  const [life, setLife] = useState("4");
  const [usePercent, setUsePercent] = useState("100");
  const [openId, setOpenId] = useState<string | null>(null);
  const cost = Number(price);
  const years = Number(life);
  const workUse = Number(usePercent);
  const previewAsset: DepreciatingAsset | null =
    draft.description.trim() && Number.isFinite(cost) && cost > 0 && Number.isFinite(years) && years >= 1 && years <= 40 && Number.isInteger(workUse) && workUse >= 1 && workUse <= 100
      ? { ...draft, description: draft.description.trim(), cost, effectiveLifeYears: years, workUsePercent: workUse }
      : null;
  const preview = previewAsset ? depreciationSchedule(previewAsset) : [];
  const thisYear = preview.find((row) => row.start === year.start);
  const immediate = previewAsset ? isImmediateAsset(previewAsset.cost, previewAsset.workUsePercent) : false;

  function load(asset: DepreciatingAsset) {
    setDraft(asset);
    setPrice(String(asset.cost));
    setLife(String(asset.effectiveLifeYears));
    setUsePercent(String(asset.workUsePercent));
    setOpenId(asset.id);
  }

  function clear() {
    setDraft(blank(todayIso()));
    setPrice("");
    setLife("4");
    setUsePercent("100");
  }

  function save() {
    if (!previewAsset) return;
    onSave(previewAsset);
    clear();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <div className="flex items-start gap-3">
          <Laptop className="mt-0.5 text-mint" size={18} aria-hidden />
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Depreciating assets</h2>
            <p className="mt-1 text-sm leading-6 text-fog">
              Laptops, tools, and equipment. Over $300, TaxTrack spreads the purchase price over the effective life. $300 or under, used mainly for work, is an immediate deduction in {year.label} when that is the year you first used it.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Description">
            <input className={inputClass} value={draft.description} placeholder="Laptop" onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </Field>
          <Field label="First used" hint="The day you first used it to earn income.">
            <input className={inputClass} type="date" value={draft.purchased} onChange={(event) => setDraft({ ...draft, purchased: event.target.value })} />
          </Field>
          <Field label="Purchase price (AUD)">
            <input className={inputClass} inputMode="decimal" value={price} placeholder="0.00" onChange={(event) => setPrice(event.target.value)} />
          </Field>
          <Field label="Work use %">
            <input className={inputClass} inputMode="numeric" value={usePercent} onChange={(event) => setUsePercent(event.target.value)} />
          </Field>
          <Field label="Effective life (years)" hint="Used when the cost is over $300.">
            <input className={inputClass} inputMode="decimal" value={life} onChange={(event) => setLife(event.target.value)} />
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
        <Field label="Notes">
          <input className={inputClass} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        </Field>
        {previewAsset ? (
          <p className="mt-3 text-sm text-fog">
            {depreciationMethodLabel(previewAsset)}
            {thisYear ? ` · ${year.label} claim ${formatCents(thisYear.claimCents)}` : ` · nothing in ${year.label}`}
            {thisYear ? ` · ${thisYear.daysHeld} days` : ""}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={buttonClass.primary} disabled={!previewAsset} onClick={save}>
            {draft.id ? "Save asset" : "Add asset"}
          </button>
          {draft.id ? (
            <button type="button" className={buttonClass.ghost} onClick={clear}>
              Cancel
            </button>
          ) : null}
        </div>
      </Panel>

      <div className="space-y-3">
        {assets.length === 0 ? (
          <Panel>
            <p className="text-sm text-fog">No assets yet. A tool over $300 logged under Expenses stays out of that total until you add it here.</p>
          </Panel>
        ) : (
          assets.map((asset) => {
            const schedule = depreciationSchedule(asset);
            const open = openId === asset.id;
            const current = schedule.find((row) => row.start === year.start);
            return (
              <Panel key={asset.id}>
                <div className="flex items-start justify-between gap-3 px-4 py-3">
                  <button type="button" className="min-w-0 text-left" onClick={() => load(asset)}>
                    <p className="text-sm font-semibold">{asset.description}</p>
                    <p className="mt-1 text-xs text-fog">
                      {asset.purchased.split("-").reverse().join("/")} · {formatCents(toCents(asset.cost))} · {depreciationMethodLabel(asset)}
                      {isImmediateAsset(asset.cost, asset.workUsePercent) ? "" : ` · ${asset.effectiveLifeYears}y`}
                      {current ? ` · ${year.label} ${formatCents(current.claimCents)}` : ""}
                    </p>
                  </button>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button type="button" className="text-xs font-semibold text-mint" onClick={() => setOpenId(open ? null : asset.id)}>
                      {open ? "Hide" : "Show"}
                    </button>
                    <button type="button" className="text-xs font-semibold text-rose" onClick={() => onDelete(asset.id)}>
                      Delete
                    </button>
                  </div>
                </div>
                {open ? (
                  <div className="border-t border-line px-4 py-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-fog">
                          <th className="pb-2 text-left font-semibold">Income year</th>
                          <th className="pb-2 text-right font-semibold">Days</th>
                          <th className="pb-2 text-right font-semibold">Claim</th>
                        </tr>
                      </thead>
                      <tbody>
                        {schedule.map((row) => (
                          <tr key={row.start} className={row.start === year.start ? "text-mint" : undefined}>
                            <td className="py-1">{row.label}</td>
                            <td className="py-1 text-right font-mono">{row.daysHeld}</td>
                            <td className="py-1 text-right font-mono">{formatCents(row.claimCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </Panel>
            );
          })
        )}
      </div>
    </div>
  );
}
