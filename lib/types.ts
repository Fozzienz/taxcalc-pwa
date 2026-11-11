export type YearId = "2025-26" | "2026-27";

export type WorkMode = "wfh" | "office" | "leave" | "rdo";

export type ExpenseCategory =
  | "clothing"
  | "laundry"
  | "donations"
  | "self-education"
  | "tools"
  | "subscriptions"
  | "tax-affairs"
  | "other";

export type PaymentMethod = "card" | "cash" | "other";

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
  /** Key for a compressed JPEG kept in this browser. Null when no photo is attached. */
  receiptId: string | null;
}

export interface YearData {
  dayLogs: Record<string, DayLog>;
  expenses: Expense[];
}

export interface AppState {
  version: 1;
  activeYear: YearId;
  settings: {
    defaultWfhHours: number;
  };
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
