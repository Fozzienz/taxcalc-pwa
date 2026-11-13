import { toCents, wholeDollarsFromCents } from "@/lib/money";
import { isRentalIncome, RENTAL_EXPENSE_CATEGORIES, rentalCategoryById, type RentalExpense, type RentalProperty } from "@/lib/types";

export interface RentalSummary {
  /** Expense cents. Rent received is kept separate. */
  cents: number;
  dollars: number;
  incomeCents: number;
  incomeDollars: number;
  byCategory: Array<{ id: string; label: string; cents: number }>;
  byProperty: Array<{ id: string; address: string; cents: number }>;
}

function sumCents(rows: readonly RentalExpense[]): number {
  return rows.reduce((sum, row) => sum + toCents(row.amount), 0);
}

export function summariseRentals(expenses: readonly RentalExpense[], properties: readonly RentalProperty[]): RentalSummary {
  const costs = expenses.filter((expense) => !isRentalIncome(expense.category));
  const income = expenses.filter((expense) => isRentalIncome(expense.category));
  const byCategory = RENTAL_EXPENSE_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    cents: sumCents(costs.filter((expense) => expense.category === category.id)),
  }));
  const ids = [...new Set(costs.map((expense) => expense.propertyId))];
  const byProperty = ids.map((id) => ({
    id,
    address: properties.find((property) => property.id === id)?.address ?? "Unknown address",
    cents: sumCents(costs.filter((expense) => expense.propertyId === id)),
  }));
  const cents = sumCents(costs);
  const incomeCents = sumCents(income);
  return {
    cents,
    dollars: wholeDollarsFromCents(cents),
    incomeCents,
    incomeDollars: wholeDollarsFromCents(incomeCents),
    byCategory,
    byProperty,
  };
}

export function rentalAddress(properties: readonly RentalProperty[], propertyId: string): string {
  return properties.find((property) => property.id === propertyId)?.address ?? "Unknown address";
}

export function rentalCategoryLabel(expense: RentalExpense): string {
  return rentalCategoryById(expense.category).label;
}
