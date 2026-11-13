import { wholeDollarsFromCents } from "@/lib/money";
import type { Expense } from "@/lib/types";

/** Cents per kilometre applies to the first 5,000 work kilometres of each car. */
export const CAR_KM_CAP = 5000;

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
    if (expense.category !== "car" || (expense.kilometres ?? 0) <= 0) continue;
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
      const take = Math.min(hundredths(trip.kilometres ?? 0), room);
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
  const trips = expenses.filter((expense) => expense.category === "car");
  const byVehicle = new Map<string, { kilometres: number; claimHundredths: number; cents: number }>();
  for (const trip of trips) {
    const name = vehicleName(trip.vehicle);
    const current = byVehicle.get(name) ?? { kilometres: 0, claimHundredths: 0, cents: 0 };
    const logged = hundredths(trip.kilometres ?? 0);
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
