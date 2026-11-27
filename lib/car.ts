import { toCents, wholeDollarsFromCents } from "@/lib/money";
import type { CarCostKind, CarLogbook, Expense } from "@/lib/types";

/** Cents per kilometre applies to the first 5,000 work kilometres of each car. */
export const CAR_KM_CAP = 5000;

/** A logbook must cover 12 continuous weeks. */
export const LOGBOOK_DAYS = 84;

export const CAR_COSTS: readonly { id: CarCostKind; label: string }[] = [
  { id: "fuel", label: "Fuel" },
  { id: "registration", label: "Registration" },
  { id: "insurance", label: "Insurance" },
  { id: "service", label: "Servicing" },
  { id: "other", label: "Other running cost" },
];

export function carCostLabel(kind: CarCostKind | undefined): string {
  return CAR_COSTS.find((item) => item.id === kind)?.label ?? "Running cost";
}

export function isCarCost(expense: Expense): boolean {
  return expense.category === "car" && expense.carRecord === "cost";
}

export function isCarTrip(expense: Expense): boolean {
  return expense.category === "car" && expense.carRecord !== "cost";
}

export function tripTimes(expense: Expense): number {
  const times = expense.tripTimes;
  if (typeof times !== "number" || !Number.isInteger(times) || times < 1) return 1;
  return Math.min(times, 99);
}

export function vehicleName(vehicle: string | null | undefined): string {
  const trimmed = vehicle?.trim() ?? "";
  return trimmed || "Car";
}

export function formatKilometres(kilometres: number): string {
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }).format(kilometres);
}

function hundredths(kilometres: number): number {
  return Math.round(kilometres * 100);
}

/** Claim for each car trip, in date order, stopping at 5,000 km per vehicle. */
export function carClaims(expenses: readonly Expense[], centsPerKm: number): Map<string, number> {
  const byVehicle = new Map<string, Expense[]>();
  for (const expense of expenses) {
    if (!isCarTrip(expense) || (expense.kilometres ?? 0) <= 0) continue;
    const name = vehicleName(expense.vehicle);
    const list = byVehicle.get(name) ?? [];
    list.push(expense);
    byVehicle.set(name, list);
  }

  const claims = new Map<string, number>();
  for (const list of byVehicle.values()) {
    const ordered = [...list].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    let used = 0;
    let claimed = 0;
    for (const trip of ordered) {
      const room = Math.max(0, CAR_KM_CAP * 100 - used);
      const take = Math.min(hundredths(trip.kilometres ?? 0) * tripTimes(trip), room);
      used += take;
      const next = Math.round((used * centsPerKm) / 100);
      claims.set(trip.id, next - claimed);
      claimed = next;
    }
  }
  return claims;
}

export function summariseCar(expenses: readonly Expense[], centsPerKm: number): {
  cents: number;
  dollars: number;
  kilometres: number;
  claimKilometres: number;
  vehicles: Array<{ vehicle: string; kilometres: number; claimKilometres: number; cents: number }>;
} {
  const claims = carClaims(expenses, centsPerKm);
  const trips = expenses.filter((expense) => isCarTrip(expense) && (expense.kilometres ?? 0) > 0);
  const byVehicle = new Map<string, { kilometres: number; claimHundredths: number; cents: number }>();
  for (const trip of trips) {
    const name = vehicleName(trip.vehicle);
    const current = byVehicle.get(name) ?? { kilometres: 0, claimHundredths: 0, cents: 0 };
    const logged = hundredths(trip.kilometres ?? 0) * tripTimes(trip);
    const claimCents = claims.get(trip.id) ?? 0;
    current.kilometres += logged;
    current.cents += claimCents;
    byVehicle.set(name, current);
  }
  for (const [name, row] of byVehicle) {
    const loggedHundredths = row.kilometres;
    const claimHundredths = Math.min(loggedHundredths, CAR_KM_CAP * 100);
    byVehicle.set(name, { ...row, claimHundredths });
  }
  const vehicles = [...byVehicle.entries()]
    .map(([vehicle, row]) => ({
      vehicle,
      kilometres: row.kilometres / 100,
      claimKilometres: row.claimHundredths / 100,
      cents: row.cents,
    }))
    .sort((a, b) => a.vehicle.localeCompare(b.vehicle));
  const kilometres = vehicles.reduce((sum, row) => sum + row.kilometres, 0);
  const claimKilometres = vehicles.reduce((sum, row) => sum + row.claimKilometres, 0);
  const cents = vehicles.reduce((sum, row) => sum + row.cents, 0);
  return { cents, dollars: wholeDollarsFromCents(cents), kilometres, claimKilometres, vehicles };
}

export interface LogbookSummary {
  ready: boolean;
  weeks: number;
  workKilometres: number;
  totalKilometres: number | null;
  /** One decimal. Null until the odometer and 12 weeks are both in. */
  percent: number | null;
  /** Work kilometres divided by the odometer difference. Null until the logbook is ready. */
  share: number | null;
  costCents: number;
  claimCents: number;
  dollars: number;
  note: string;
}

function dayNumber(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const time = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(time) ? null : Math.round(time / 86_400_000);
}

function percentLabel(percent: number): string {
  return `${new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format(percent)}%`;
}

/** Work kilometres in the logbook, over the odometer difference, applied to the running costs. */
export function summariseLogbook(expenses: readonly Expense[], logbook: CarLogbook | undefined, asOf: string): LogbookSummary {
  const costCents = expenses.filter(isCarCost).reduce((sum, expense) => sum + toCents(expense.amount), 0);
  const workHundredths = expenses
    .filter(isCarTrip)
    .reduce((sum, expense) => sum + hundredths(expense.kilometres ?? 0) * tripTimes(expense), 0);
  const workKilometres = workHundredths / 100;
  const start = logbook?.started ? dayNumber(logbook.started) : null;
  const end = dayNumber(asOf);
  const weeks = start !== null && end !== null && end >= start ? Math.floor((end - start) / 7) : 0;
  const opening = logbook?.openingKilometres;
  const closing = logbook?.closingKilometres;
  const total =
    typeof opening === "number" && typeof closing === "number" && closing > opening ? Math.round((closing - opening) * 100) / 100 : null;
  const empty: LogbookSummary = {
    ready: false,
    weeks,
    workKilometres,
    totalKilometres: total,
    percent: null,
    share: null,
    costCents,
    claimCents: 0,
    dollars: 0,
    note: "",
  };

  if (!logbook?.started || typeof opening !== "number") {
    return { ...empty, note: "Add the start date and the opening odometer." };
  }
  if (weeks < 12) {
    return { ...empty, note: `${weeks} of 12 weeks. The claim waits until the logbook covers 12 continuous weeks.` };
  }
  if (total === null) {
    return { ...empty, note: "Add the odometer reading at the end of the 12 weeks." };
  }

  const totalHundredths = Math.round(total * 100);
  const used = Math.min(workHundredths, totalHundredths);
  const percent = Math.round((used / totalHundredths) * 1000) / 10;
  const claimCents = costCents === 0 || totalHundredths === 0 ? 0 : Math.round((costCents * used) / totalHundredths);
  const note =
    workHundredths > totalHundredths
      ? "Work kilometres are higher than the odometer difference, so the claim uses 100% of the car costs."
      : `${percentLabel(percent)} work use over ${formatKilometres(total)} km. The logbook covers ${weeks} weeks.`;
  return {
    ready: true,
    weeks,
    workKilometres,
    totalKilometres: total,
    percent,
    share: totalHundredths === 0 ? null : used / totalHundredths,
    costCents,
    claimCents,
    dollars: wholeDollarsFromCents(claimCents),
    note,
  };
}

/** Share of the logbook claim on each running cost, so the lines add up to the total. */
export function logbookCostClaims(expenses: readonly Expense[], summary: LogbookSummary): Map<string, number> {
  const claims = new Map<string, number>();
  const costs = expenses.filter(isCarCost);
  if (!summary.ready || summary.claimCents <= 0 || summary.costCents <= 0) {
    for (const cost of costs) claims.set(cost.id, 0);
    return claims;
  }
  let allocated = 0;
  costs.forEach((cost, index) => {
    if (index === costs.length - 1) {
      claims.set(cost.id, summary.claimCents - allocated);
      return;
    }
    const share = Math.round((toCents(cost.amount) * summary.claimCents) / summary.costCents);
    allocated += share;
    claims.set(cost.id, share);
  });
  return claims;
}
