export type YearId = "2025-26" | "2026-27" | "2027-28";

export type WorkMode = "wfh" | "office" | "leave" | "rdo";

export type ExpenseCategory =
  | "clothing"
  | "laundry"
  | "donations"
  | "self-education"
  | "tools"
  | "subscriptions"
  | "car"
  | "tax-affairs"
  | "other";

export type PaymentMethod = "card" | "cash" | "other";

export type RentalCategory =
  | "rent"
  | "other-income"
  | "advertising"
  | "body-corporate"
  | "borrowing"
  | "cleaning"
  | "council-rates"
  | "gardening"
  | "insurance"
  | "loan-interest"
  | "land-tax"
  | "legal"
  | "pest-control"
  | "agent-fees"
  | "repairs"
  | "stationery"
  | "water"
  | "other";

export interface DayLog {
  date: string;
  mode: WorkMode;
  hours: number;
  notes: string;
  receiptMarker: boolean;
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  merchant: string;
  paymentMethod: PaymentMethod;
  notes: string;
  dgrConfirmed: boolean;
  isEquipment: boolean;
  workUsePercent: number;
  /** Work kilometres when the category is car. Null for every other expense. */
  kilometres: number | null;
  /** Which car the kilometres belong to. Blank means one car. */
  vehicle: string;
  /** Key for a compressed JPEG kept in this browser. Null when no photo is attached. */
  receiptId: string | null;
}

export type DepreciationMethod = "prime-cost" | "diminishing-value";

export interface DepreciatingAsset {
  id: string;
  description: string;
  /** Day the asset was first used to earn income. */
  purchased: string;
  cost: number;
  effectiveLifeYears: number;
  workUsePercent: number;
  method: DepreciationMethod;
  notes: string;
}
export interface RentalProperty {
  id: string;
  address: string;
}

export interface RentalExpense {
  id: string;
  propertyId: string;
  date: string;
  amount: number;
  category: RentalCategory;
  description: string;
  notes: string;
}

export interface YearData {
  dayLogs: Record<string, DayLog>;
  expenses: Expense[];
  rentalExpenses?: RentalExpense[];
}

export interface AppState {
  version: 1;
  activeYear: YearId;
  settings: {
    defaultWfhHours: number;
    /** Off until the person turns rental properties on in the menu. */
    rentalProperties?: boolean;
  };
  properties?: RentalProperty[];
  assets?: DepreciatingAsset[];
  years: Record<YearId, YearData>;
}

export interface CategoryDefinition {
  id: ExpenseCategory;
  label: string;
  official: string;
}

export const CATEGORIES: readonly CategoryDefinition[] = [
  { id: "clothing", label: "Clothing / uniforms", official: "Clothing, laundry and dry-cleaning" },
  { id: "laundry", label: "Laundry", official: "Clothing, laundry and dry-cleaning" },
  { id: "donations", label: "Donations", official: "Gifts or donations" },
  { id: "self-education", label: "Self-education", official: "Self-education expenses" },
  { id: "tools", label: "Tools / equipment", official: "Other work-related expenses" },
  { id: "subscriptions", label: "Subscriptions", official: "Other work-related expenses" },
  { id: "car", label: "Car (cents per km)", official: "Work-related car expenses" },
  { id: "tax-affairs", label: "Tax agent fees", official: "Cost of managing tax affairs" },
  { id: "other", label: "Other work expenses", official: "Other work-related expenses" },
] as const;

export const WORK_MODES: readonly {
  id: WorkMode;
  label: string;
  short: string;
  hint: string;
}[] = [
  {
    id: "wfh",
    label: "Work from home",
    short: "WFH",
    hint: "Counts toward the fixed-rate hours.",
  },
  {
    id: "office",
    label: "Office",
    short: "Office",
    hint: "Does not add working-from-home hours.",
  },
  {
    id: "leave",
    label: "Leave",
    short: "Leave",
    hint: "Annual, sick, or other leave.",
  },
  {
    id: "rdo",
    label: "RDO",
    short: "RDO",
    hint: "Rostered day off.",
  },
] as const;

export const RENTAL_INCOME_CATEGORIES: readonly { id: RentalCategory; label: string; hint: string }[] = [
  { id: "rent", label: "Rent received", hint: "Gross rent paid to you for this property." },
  { id: "other-income", label: "Other rental income", hint: "Other rent-related income, such as a reimbursement." },
] as const;

export const RENTAL_EXPENSE_CATEGORIES: readonly { id: RentalCategory; label: string; hint: string }[] = [
  { id: "advertising", label: "Advertising for tenants", hint: "Advertising to find a tenant." },
  { id: "body-corporate", label: "Body corporate fees", hint: "Body corporate or strata fees." },
  { id: "borrowing", label: "Borrowing expenses", hint: "Loan establishment costs. Not the principal, and not the interest." },
  { id: "cleaning", label: "Cleaning", hint: "Cleaning for the rental." },
  { id: "council-rates", label: "Council rates", hint: "Council rates for the property." },
  { id: "gardening", label: "Gardening", hint: "Garden and lawn care for the rental." },
  { id: "insurance", label: "Insurance", hint: "Building, contents, or landlord insurance." },
  { id: "loan-interest", label: "Loan interest", hint: "Interest on a loan for the property. Not the principal." },
  { id: "land-tax", label: "Land tax", hint: "Land tax charged on the property." },
  { id: "legal", label: "Legal expenses", hint: "Legal costs for the rental, such as lease preparation." },
  { id: "pest-control", label: "Pest control", hint: "Pest control for the rental." },
  { id: "agent-fees", label: "Property agent fees", hint: "Agent management fees and commissions." },
  { id: "repairs", label: "Repairs and maintenance", hint: "Work that restores the property. A new asset or an improvement is capital." },
  { id: "stationery", label: "Stationery, phone and postage", hint: "Phone, stationery, and postage for the rental." },
  { id: "water", label: "Water charges", hint: "Water rates and usage you paid for the rental." },
  { id: "other", label: "Other rental expenses", hint: "Another rental expense. Check it before you lodge." },
] as const;

export const RENTAL_CATEGORIES = [...RENTAL_INCOME_CATEGORIES, ...RENTAL_EXPENSE_CATEGORIES] as const;

const RENTAL_INCOME_IDS = new Set<RentalCategory>(RENTAL_INCOME_CATEGORIES.map((item) => item.id));

export function isRentalIncome(category: RentalCategory): boolean {
  return RENTAL_INCOME_IDS.has(category);
}

export function rentalCategoryById(id: RentalCategory) {
  const category = RENTAL_CATEGORIES.find((item) => item.id === id);
  if (!category) throw new Error(`Unknown rental category ${id}`);
  return category;
}

export const PAYMENT_METHODS: readonly { id: PaymentMethod; label: string }[] = [
  { id: "card", label: "Card" },
  { id: "cash", label: "Cash" },
  { id: "other", label: "Other" },
] as const;

export function categoryById(id: ExpenseCategory): CategoryDefinition {
  const category = CATEGORIES.find((item) => item.id === id);
  if (!category) throw new Error(`Unknown category ${id}`);
  return category;
}

export function modeById(id: WorkMode) {
  const mode = WORK_MODES.find((item) => item.id === id);
  if (!mode) throw new Error(`Unknown work mode ${id}`);
  return mode;
}
