import { IMMEDIATE_ASSET_CENTS } from "@/lib/ato-rules";
import { toCents, wholeDollarsFromCents } from "@/lib/money";
import type { DepreciatingAsset, DepreciationMethod } from "@/lib/types";

export interface DepreciationYear {
  label: string;
  start: string;
  end: string;
  daysHeld: number;
  openingCents: number;
  declineCents: number;
  claimCents: number;
  closingCents: number;
  immediate: boolean;
}

const MAX_YEARS = 40;

function utcDay(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function daysInclusive(start: string, end: string): number {
  return utcDay(end) - utcDay(start) + 1;
}

function julyYear(iso: string): number {
  const [year, month] = iso.split("-").map(Number);
  return month >= 7 ? year : year - 1;
}

function yearLabel(july: number): string {
  const end = String(july + 1).slice(2);
  return `${july}–${end}`;
}

/** $300 or under, and used mainly for work, is an immediate deduction. */
export function isImmediateAsset(cost: number, workUsePercent: number): boolean {
  return toCents(cost) <= IMMEDIATE_ASSET_CENTS && workUsePercent > 50;
}

export function depreciationMethodLabel(asset: Pick<DepreciatingAsset, "cost" | "workUsePercent" | "method">): string {
  if (isImmediateAsset(asset.cost, asset.workUsePercent)) return "Immediate deduction";
  return asset.method === "diminishing-value" ? "Diminishing value" : "Prime cost";
}

function declineForYear(openingCents: number, costCents: number, days: number, life: number, method: DepreciationMethod): number {
  if (openingCents <= 0 || days <= 0 || life <= 0) return 0;
  const basis = method === "diminishing-value" ? openingCents : costCents;
  const rate = method === "diminishing-value" ? 2 : 1;
  const raw = Math.round((basis * days * rate) / (365 * life));
  return Math.min(openingCents, Math.max(0, raw));
}

/** Year-by-year decline in value from the first-used year until the cost is written off. */
export function depreciationSchedule(asset: DepreciatingAsset): DepreciationYear[] {
  const costCents = toCents(asset.cost);
  if (costCents <= 0 || !asset.purchased) return [];
  const immediate = isImmediateAsset(asset.cost, asset.workUsePercent);
  const life = asset.effectiveLifeYears;
  let opening = costCents;
  const rows: DepreciationYear[] = [];
  const first = julyYear(asset.purchased);

  for (let index = 0; index < MAX_YEARS && opening > 0; index += 1) {
    const july = first + index;
    const start = `${july}-07-01`;
    const end = `${july + 1}-06-30`;
    const heldStart = asset.purchased > start ? asset.purchased : start;
    const daysHeld = heldStart <= end ? daysInclusive(heldStart, end) : 0;
    let declineCents = 0;
    if (immediate) declineCents = index === 0 ? opening : 0;
    else if (index === MAX_YEARS - 1) declineCents = opening;
    else declineCents = declineForYear(opening, costCents, daysHeld, life, asset.method);
    if (!immediate && declineCents === 0 && opening > 0 && daysHeld > 0) declineCents = opening;
    const claimCents = Math.round((declineCents * asset.workUsePercent) / 100);
    const closingCents = opening - declineCents;
    rows.push({
      label: yearLabel(july),
      start,
      end,
      daysHeld,
      openingCents: opening,
      declineCents,
      claimCents,
      closingCents,
      immediate,
    });
    opening = closingCents;
  }

  return rows;
}

export function depreciationForPeriod(asset: DepreciatingAsset, start: string): DepreciationYear | undefined {
  return depreciationSchedule(asset).find((row) => row.start === start);
}

export function summariseDecline(
  assets: readonly DepreciatingAsset[],
  year: { start: string },
): { cents: number; dollars: number; rows: Array<{ id: string; description: string; claimCents: number; method: string }> } {
  const rows = assets.map((asset) => {
    const claim = depreciationForPeriod(asset, year.start);
    return {
      id: asset.id,
      description: asset.description,
      claimCents: claim?.claimCents ?? 0,
      method: depreciationMethodLabel(asset),
    };
  });
  const cents = rows.reduce((sum, row) => sum + row.claimCents, 0);
  return { cents, dollars: wholeDollarsFromCents(cents), rows };
}
