import type { ExpenseCategory, YearId } from "@/lib/types";
import { toCents } from "@/lib/money";

/**
 * Figures published for the 2025–26 income year.
 *
 * Working-from-home fixed rate: 70 cents per hour for 2024–25 and 2025–26.
 * From 1 July 2024 the ATO practical compliance guideline uses 70 cents.
 * The rate covers energy, phone, internet, stationery, and computer consumables.
 * Hours must be actual hours for the whole income year. Cents on the deduction
 * are disregarded, not rounded. The worked example 843 hours × 70c is $590.
 *
 * A depreciating asset costing $300 or less can be an immediate deduction when
 * it is used mainly for work. Above $300, or where a set costs more than $300,
 * claim decline in value rather than the full price.
 *
 * Laundry of eligible work clothes: $1 a work-only load, or 50 cents a mixed
 * load, is a common basis. Written evidence is required once laundry is over $150.
 * Gifts must be $2 or more to a deductible gift recipient.
 *
 * Sources: ATO fixed rate method, myTax 2026 other work-related expenses,
 * and the Queensland public holiday tables.
 */

export const WFH_CENTS_PER_HOUR = 70;
export const DEFAULT_WFH_HOURS = 7.6;
export const IMMEDIATE_ASSET_CENTS = 30_000;
export const LAUNDRY_WRITTEN_EVIDENCE_CENTS = 15_000;
export const DONATION_MINIMUM_CENTS = 200;
export const WORK_RELATED_EVIDENCE_CENTS = 30_000;

export interface FinancialYear {
  id: YearId;
  label: string;
  start: string;
  end: string;
  wfhCentsPerHour: number;
  rateNote: string;
}

export const FINANCIAL_YEARS: readonly FinancialYear[] = [
  {
    id: "2025-26",
    label: "2025–26",
    start: "2025-07-01",
    end: "2026-06-30",
    wfhCentsPerHour: WFH_CENTS_PER_HOUR,
    rateNote:
      "The ATO fixed rate for the 2025–26 income year is 70 cents for each hour you actually worked from home.",
  },
  {
    id: "2026-27",
    label: "2026–27",
    start: "2026-07-01",
    end: "2027-06-30",
    wfhCentsPerHour: WFH_CENTS_PER_HOUR,
    rateNote:
      "TaxTrack uses 70 cents an hour, the fixed rate published from 1 July 2024 and confirmed for 2024–25 and 2025–26. Confirm the 2026–27 rate before you lodge.",
  },
] as const;

export const FIXED_RATE_INCLUDES = [
  "Electricity and gas",
  "Mobile and home phone",
  "Home and mobile internet",
  "Stationery and computer consumables",
] as const;

export const DISCLAIMER =
  "TaxTrack is an independent organiser for your own records. It is not a registered tax agent, it does not lodge returns, and it is not part of the Australian Taxation Office or myTax. Figures are estimates from what you enter. Check them before you lodge.";

export const CATEGORY_HINTS: Record<ExpenseCategory, string> = {
  clothing:
    "Occupation-specific clothing, protective clothing, and compulsory uniforms. Ordinary clothes are not deductible. Enter the work-related cost.",
  laundry:
    "Eligible work clothes only. A common basis is $1 for a work-only load and 50 cents for a mixed load. Claims over $150 need written evidence.",
  donations:
    "Gifts of $2 or more to a deductible gift recipient. Confirm the DGR status before you rely on this figure.",
  "self-education":
    "Study that maintains or improves skills in your current work. HELP and HECS repayments are not deductible. Mark equipment if this is a laptop, desk, or similar asset.",
  tools:
    "The $300 test uses the full cost. At $300 or under, the work-related portion can be an immediate write-off. Over $300, claim decline in value rather than the full price. A set costing more than $300 works the same way.",
  subscriptions:
    "Work-related software, union, or professional subscriptions. Enter your work-related share. Leave out phone, internet, and stationery if you use the 70 cent rate.",
  "tax-affairs":
    "Tax agent fees are claimed in the year you pay them. That can be the year after the return they relate to.",
  other:
    "Other work expenses that do not fit the categories above. Mark equipment if the $300 asset test should apply.",
};

export type AssetTreatment = "not-an-asset" | "immediate" | "depreciating";

export function isYearId(value: unknown): value is YearId {
  return value === "2025-26" || value === "2026-27";
}

export function yearById(id: YearId): FinancialYear {
  const year = FINANCIAL_YEARS.find((item) => item.id === id);
  if (!year) throw new Error(`Unknown income year ${id}`);
  return year;
}

export function assetTreatment(expense: {
  category: ExpenseCategory;
  amount: number;
  isEquipment: boolean;
}): AssetTreatment {
  const isAsset =
    expense.category === "tools" ||
    ((expense.category === "self-education" || expense.category === "other") && expense.isEquipment);
  if (!isAsset) return "not-an-asset";
  return toCents(expense.amount) > IMMEDIATE_ASSET_CENTS ? "depreciating" : "immediate";
}
