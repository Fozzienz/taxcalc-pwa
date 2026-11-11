import { assetTreatment, DONATION_MINIMUM_CENTS, LAUNDRY_WRITTEN_EVIDENCE_CENTS, WORK_RELATED_EVIDENCE_CENTS } from "@/lib/ato-rules";
import { deductionCents, portionCents, toCents, wholeDollarsFromCents } from "@/lib/money";
import type { DayLog, Expense, ExpenseCategory } from "@/lib/types";

export interface MoneyTotal {
  cents: number;
  wholeDollars: number;
  count: number;
}

export interface ClaimFigures {
  wfhHours: number;
  wfhDays: number;
  wfhCents: number;
  wfhDollars: number;
  clothing: MoneyTotal;
  laundry: MoneyTotal;
  donations: MoneyTotal;
  selfEducation: MoneyTotal;
  tools: MoneyTotal;
  subscriptions: MoneyTotal;
  other: MoneyTotal;
  taxAffairs: MoneyTotal;
  receiptsCents: number;
  receiptCount: number;
  depreciating: Expense[];
  heldDonations: Expense[];
  smallDonations: Expense[];
  laundryNeedsEvidence: boolean;
  workExpensesNeedEvidence: boolean;
}

function emptyTotal(): MoneyTotal {
  return { cents: 0, wholeDollars: 0, count: 0 };
}

function claimCents(expense: Expense): number {
  const treatment = assetTreatment(expense);
  if (treatment === "depreciating") return 0;
  if (expense.category === "donations") {
    if (toCents(expense.amount) < DONATION_MINIMUM_CENTS || !expense.dgrConfirmed) return 0;
    return toCents(expense.amount);
  }
  if (treatment === "immediate") return portionCents(expense.amount, expense.workUsePercent);
  return toCents(expense.amount);
}

export function calculateClaims(input: {
  centsPerHour: number;
  dayLogs: readonly DayLog[];
  expenses: readonly Expense[];
}): ClaimFigures {
  const wfhTenths = input.dayLogs.reduce((total, log) => {
    if (log.mode !== "wfh" || log.hours <= 0) return total;
    return total + Math.round(log.hours * 10);
  }, 0);
  const wfhCents = deductionCents(wfhTenths, input.centsPerHour);
  const groups: Record<ExpenseCategory, MoneyTotal> = {
    clothing: emptyTotal(),
    laundry: emptyTotal(),
    donations: emptyTotal(),
    "self-education": emptyTotal(),
    tools: emptyTotal(),
    subscriptions: emptyTotal(),
    "tax-affairs": emptyTotal(),
    other: emptyTotal(),
  };

  const depreciating: Expense[] = [];
  const heldDonations: Expense[] = [];
  const smallDonations: Expense[] = [];

  for (const expense of input.expenses) {
    if (assetTreatment(expense) === "depreciating") depreciating.push(expense);
    if (expense.category === "donations") {
      if (toCents(expense.amount) < DONATION_MINIMUM_CENTS) smallDonations.push(expense);
      else if (!expense.dgrConfirmed) heldDonations.push(expense);
    }
    const cents = claimCents(expense);
    if (cents <= 0) continue;
    const bucket = groups[expense.category];
    bucket.cents += cents;
    bucket.count += 1;
  }

  for (const bucket of Object.values(groups)) {
    bucket.wholeDollars = wholeDollarsFromCents(bucket.cents);
  }

  const receiptsCents = input.expenses.reduce((total, expense) => total + toCents(expense.amount), 0);
  const workRelatedCents =
    wfhCents +
    groups.clothing.cents +
    groups.laundry.cents +
    groups["self-education"].cents +
    groups.tools.cents +
    groups.subscriptions.cents +
    groups.other.cents;

  return {
    wfhHours: wfhTenths / 10,
    wfhDays: input.dayLogs.filter((log) => log.mode === "wfh" && log.hours > 0).length,
    wfhCents,
    wfhDollars: wholeDollarsFromCents(wfhCents),
    clothing: groups.clothing,
    laundry: groups.laundry,
    donations: groups.donations,
    selfEducation: groups["self-education"],
    tools: groups.tools,
    subscriptions: groups.subscriptions,
    other: groups.other,
    taxAffairs: groups["tax-affairs"],
    receiptsCents,
    receiptCount: input.expenses.length,
    depreciating,
    heldDonations,
    smallDonations,
    laundryNeedsEvidence: groups.laundry.cents > LAUNDRY_WRITTEN_EVIDENCE_CENTS,
    workExpensesNeedEvidence: workRelatedCents > WORK_RELATED_EVIDENCE_CENTS,
  };
}
