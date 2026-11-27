import { assetTreatment, DONATION_MINIMUM_CENTS, LAUNDRY_WRITTEN_EVIDENCE_CENTS, WORK_RELATED_EVIDENCE_CENTS } from "@/lib/ato-rules";
import { summariseCar, summariseLogbook } from "@/lib/car";
import { deductionCents, portionCents, toCents, wholeDollarsFromCents } from "@/lib/money";
import { isRunningCost, type CarLogbook, type CarMethod, type DayLog, type Expense, type ExpenseCategory, type WfhMethod } from "@/lib/types";

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
  car: MoneyTotal;
  carKilometres: number;
  carClaimKilometres: number;
  travel: MoneyTotal;
  taxAffairs: MoneyTotal;
  litigationCents: number;
  taxOtherCents: number;
  energy: MoneyTotal;
  phone: MoneyTotal;
  internet: MoneyTotal;
  stationery: MoneyTotal;
  runningCents: number;
  /** Running-cost bills saved while the fixed rate is selected. */
  runningHeld: number;
  receiptsCents: number;
  receiptCount: number;
  depreciating: Expense[];
  heldDonations: Expense[];
  smallDonations: Expense[];
  unsure: Expense[];
  laundryNeedsEvidence: boolean;
  workExpensesNeedEvidence: boolean;
}

function emptyTotal(): MoneyTotal {
  return { cents: 0, wholeDollars: 0, count: 0 };
}

export function workShareCents(expense: Pick<Expense, "amount" | "workUsePercent" | "workAmount">): number {
  const full = toCents(expense.amount);
  if (typeof expense.workAmount === "number" && Number.isFinite(expense.workAmount)) {
    return Math.min(full, Math.max(0, toCents(expense.workAmount)));
  }
  return portionCents(expense.amount, expense.workUsePercent);
}

export function expenseClaimCents(expense: Expense, carClaim?: ReadonlyMap<string, number>, wfhMethod: WfhMethod = "fixed"): number {
  if (expense.category === "unsure") return 0;
  if (isRunningCost(expense.category)) {
    if (wfhMethod !== "actual") return 0;
    return workShareCents(expense);
  }
  if (expense.category === "car") return carClaim?.get(expense.id) ?? 0;
  const treatment = assetTreatment(expense);
  if (treatment === "depreciating") return 0;
  if (expense.category === "donations") {
    if (toCents(expense.amount) < DONATION_MINIMUM_CENTS || !expense.dgrConfirmed) return 0;
    return toCents(expense.amount);
  }
  if (treatment === "immediate") return workShareCents(expense);
  return workShareCents(expense);
}

export function calculateClaims(input: {
  centsPerHour: number;
  carCentsPerKm: number;
  dayLogs: readonly DayLog[];
  expenses: readonly Expense[];
  wfhMethod?: WfhMethod;
  carMethod?: CarMethod;
  logbook?: CarLogbook;
  asOf?: string;
}): ClaimFigures {
  const wfhMethod = input.wfhMethod === "actual" ? "actual" : "fixed";
  const carMethod: CarMethod = input.carMethod === "logbook" ? "logbook" : "cents";
  const wfhTenths = input.dayLogs.reduce((total, log) => {
    if (log.mode !== "wfh" || log.hours <= 0) return total;
    return total + Math.round(log.hours * 10);
  }, 0);
  const wfhCents = wfhMethod === "actual" ? 0 : deductionCents(wfhTenths, input.centsPerHour);
  const groups: Record<ExpenseCategory, MoneyTotal> = {
    clothing: emptyTotal(),
    laundry: emptyTotal(),
    donations: emptyTotal(),
    "self-education": emptyTotal(),
    tools: emptyTotal(),
    subscriptions: emptyTotal(),
    energy: emptyTotal(),
    phone: emptyTotal(),
    internet: emptyTotal(),
    stationery: emptyTotal(),
    car: emptyTotal(),
    travel: emptyTotal(),
    "tax-affairs": emptyTotal(),
    other: emptyTotal(),
    unsure: emptyTotal(),
  };

  const depreciating: Expense[] = [];
  const heldDonations: Expense[] = [];
  const smallDonations: Expense[] = [];
  const unsure: Expense[] = [];
  let litigationCents = 0;
  let taxOtherCents = 0;
  const logbook =
    carMethod === "logbook" ? summariseLogbook(input.expenses, input.logbook, input.asOf ?? new Date().toISOString().slice(0, 10)) : null;
  const car = logbook
    ? { cents: logbook.claimCents, kilometres: logbook.workKilometres, claimKilometres: logbook.workKilometres }
    : summariseCar(input.expenses, input.carCentsPerKm);
  let runningHeld = 0;

  for (const expense of input.expenses) {
    if (isRunningCost(expense.category) && wfhMethod !== "actual") runningHeld += 1;
    if (assetTreatment(expense) === "depreciating") depreciating.push(expense);
    if (expense.category === "donations") {
      if (toCents(expense.amount) < DONATION_MINIMUM_CENTS) smallDonations.push(expense);
      else if (!expense.dgrConfirmed) heldDonations.push(expense);
    }
    if (expense.category === "unsure") {
      unsure.push(expense);
      continue;
    }
    if (expense.category === "car") continue;
    const cents = expenseClaimCents(expense, undefined, wfhMethod);
    if (cents <= 0) continue;
    if (expense.category === "tax-affairs") {
      if (expense.taxAffair === "litigation") litigationCents += cents;
      else taxOtherCents += cents;
    }
    const bucket = groups[expense.category];
    bucket.cents += cents;
    bucket.count += 1;
  }

  groups.car.cents = car.cents;
  groups.car.count = input.expenses.filter((expense) => expense.category === "car").length;

  for (const bucket of Object.values(groups)) {
    bucket.wholeDollars = wholeDollarsFromCents(bucket.cents);
  }

  const receiptsCents = input.expenses.reduce((total, expense) => total + toCents(expense.amount), 0);
  const runningCents = groups.energy.cents + groups.phone.cents + groups.internet.cents + groups.stationery.cents;
  const workRelatedCents =
    wfhCents +
    runningCents +
    groups.clothing.cents +
    groups.laundry.cents +
    groups["self-education"].cents +
    groups.tools.cents +
    groups.subscriptions.cents +
    groups.other.cents +
    groups.travel.cents;

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
    car: groups.car,
    travel: groups.travel,
    carKilometres: car.kilometres,
    carClaimKilometres: car.claimKilometres,
    taxAffairs: groups["tax-affairs"],
    litigationCents,
    taxOtherCents,
    energy: groups.energy,
    phone: groups.phone,
    internet: groups.internet,
    stationery: groups.stationery,
    runningCents,
    runningHeld,
    receiptsCents,
    receiptCount: input.expenses.length,
    depreciating,
    heldDonations,
    smallDonations,
    unsure,
    laundryNeedsEvidence: groups.laundry.cents > LAUNDRY_WRITTEN_EVIDENCE_CENTS,
    workExpensesNeedEvidence: workRelatedCents > WORK_RELATED_EVIDENCE_CENTS,
  };
}
