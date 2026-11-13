import { DEFAULT_WFH_HOURS, FINANCIAL_YEARS, isYearId, type FinancialYear } from "@/lib/ato-rules";
import { isRealIsoDate, isValidHours, isWithin, financialYearIdFor } from "@/lib/dates";
import type {
  AppState,
  DayLog,
  DepreciatingAsset,
  DepreciationMethod,
  Expense,
  ExpenseCategory,
  PaymentMethod,
  RentalCategory,
  RentalExpense,
  RentalProperty,
  WorkMode,
  YearData,
  YearId,
} from "@/lib/types";
import { CATEGORIES, RENTAL_CATEGORIES } from "@/lib/types";
import { createId } from "@/lib/id";
import { isReceiptFile } from "@/lib/receiptImage";

export const BACKUP_NOTE =
  "Private TaxTrack backup. This file is a copy you keep. The app encrypts records on the device before they are stored.";

export const BACKUP_FILE_LIMIT = 40_000_000;

export interface BackupExpense extends Expense {
  receiptImage?: string;
}

export interface BackupYear {
  dayLogs: DayLog[];
  expenses: BackupExpense[];
  rentalExpenses: RentalExpense[];
}

export interface BackupFile {
  app: "taxtrack";
  version: 1;
  exportedAt?: string;
  note?: string;
  activeYear: YearId;
  settings: { defaultWfhHours: number; rentalProperties: boolean };
  properties: RentalProperty[];
  assets: DepreciatingAsset[];
  years: Record<YearId, BackupYear>;
}

export type ValidationResult = { ok: true; data: BackupFile } | { ok: false; errors: string[] };

const CATEGORY_IDS = new Set<ExpenseCategory>(CATEGORIES.map((item) => item.id));
const RENTAL_IDS = new Set<RentalCategory>(RENTAL_CATEGORIES.map((item) => item.id));
const MODES = new Set<WorkMode>(["wfh", "office", "leave", "rdo"]);
const PAYMENTS = new Set<PaymentMethod>(["card", "cash", "other"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function push(errors: string[], message: string) {
  if (errors.length < 12) errors.push(message);
  else if (errors.length === 12) errors.push("Further problems were hidden. Fix these and check the file again.");
}

function emptyBackupYear(): BackupYear {
  return { dayLogs: [], expenses: [], rentalExpenses: [] };
}

export function createEmptyState(today = new Date()): AppState {
  const years = {} as Record<YearId, YearData>;
  for (const year of FINANCIAL_YEARS) years[year.id] = { dayLogs: {}, expenses: [], rentalExpenses: [] };
  return {
    version: 1,
    activeYear: financialYearIdFor(today),
    settings: { defaultWfhHours: DEFAULT_WFH_HOURS, rentalProperties: false },
    properties: [],
    assets: [],
    years,
  };
}

export function stateToBackup(state: AppState, exportedAt?: string): BackupFile {
  const years = {} as BackupFile["years"];
  for (const year of FINANCIAL_YEARS) {
    const data = state.years[year.id] ?? { dayLogs: {}, expenses: [], rentalExpenses: [] };
    years[year.id] = {
      dayLogs: Object.values(data.dayLogs).sort((a, b) => a.date.localeCompare(b.date)),
      expenses: [...data.expenses].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
      rentalExpenses: [...(data.rentalExpenses ?? [])].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    };
  }
  return {
    app: "taxtrack",
    version: 1,
    ...(exportedAt ? { exportedAt } : {}),
    note: BACKUP_NOTE,
    activeYear: state.activeYear,
    settings: {
      defaultWfhHours: state.settings.defaultWfhHours,
      rentalProperties: state.settings.rentalProperties === true,
    },
    properties: [...(state.properties ?? [])].sort((a, b) => a.address.localeCompare(b.address) || a.id.localeCompare(b.id)),
    assets: [...(state.assets ?? [])].sort((a, b) => a.purchased.localeCompare(b.purchased) || a.description.localeCompare(b.description)),
    years,
  };
}

export function backupToState(file: BackupFile): AppState {
  const years = {} as Record<YearId, YearData>;
  for (const year of FINANCIAL_YEARS) {
    const source = file.years[year.id] ?? emptyBackupYear();
    const dayLogs: Record<string, DayLog> = {};
    for (const log of source.dayLogs) dayLogs[log.date] = log;
    years[year.id] = {
      dayLogs,
      expenses: source.expenses.map((expense) => ({
        id: expense.id,
        date: expense.date,
        amount: expense.amount,
        category: expense.category,
        description: expense.description,
        merchant: expense.merchant,
        paymentMethod: expense.paymentMethod,
        notes: expense.notes,
        dgrConfirmed: expense.dgrConfirmed,
        isEquipment: expense.isEquipment,
        workUsePercent: expense.workUsePercent,
        kilometres: expense.kilometres,
        vehicle: expense.vehicle,
        receiptId: expense.receiptId,
      })),
      rentalExpenses: (source.rentalExpenses ?? []).map((expense) => ({ ...expense })),
    };
  }
  return {
    version: 1,
    activeYear: file.activeYear,
    settings: {
      defaultWfhHours: file.settings.defaultWfhHours,
      rentalProperties: file.settings.rentalProperties === true,
    },
    properties: file.properties.map((property) => ({ ...property })),
    assets: (file.assets ?? []).map((asset) => ({ ...asset })),
    years,
  };
}

export function backupFilename(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `taxtrack-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.json`;
}

export function describeBackup(file: BackupFile): { days: number; expenses: number; exportedAt: string | null } {
  let days = 0;
  let expenses = 0;
  for (const year of FINANCIAL_YEARS) {
    days += file.years[year.id].dayLogs.length;
    expenses += file.years[year.id].expenses.length;
  }
  return { days, expenses, exportedAt: file.exportedAt ?? null };
}

export function mergeBackups(current: BackupFile, incoming: BackupFile): BackupFile {
  const years = {} as BackupFile["years"];
  for (const year of FINANCIAL_YEARS) {
    const days = new Map(current.years[year.id].dayLogs.map((log) => [log.date, log]));
    for (const log of incoming.years[year.id].dayLogs) days.set(log.date, log);
    const expenses = new Map(current.years[year.id].expenses.map((expense) => [expense.id, expense]));
    for (const expense of incoming.years[year.id].expenses) expenses.set(expense.id, expense);
    const rentalExpenses = new Map((current.years[year.id].rentalExpenses ?? []).map((expense) => [expense.id, expense]));
    for (const expense of incoming.years[year.id].rentalExpenses ?? []) rentalExpenses.set(expense.id, expense);
    years[year.id] = {
      dayLogs: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
      expenses: [...expenses.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
      rentalExpenses: [...rentalExpenses.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    };
  }
  const properties = new Map((current.properties ?? []).map((property) => [property.id, property]));
  for (const property of incoming.properties ?? []) properties.set(property.id, property);
  const assets = new Map((current.assets ?? []).map((asset) => [asset.id, asset]));
  for (const asset of incoming.assets ?? []) assets.set(asset.id, asset);
  return {
    app: "taxtrack",
    version: 1,
    note: BACKUP_NOTE,
    activeYear: incoming.activeYear,
    settings: {
      defaultWfhHours: incoming.settings.defaultWfhHours,
      rentalProperties: incoming.settings.rentalProperties === true,
    },
    properties: [...properties.values()].sort((a, b) => a.address.localeCompare(b.address) || a.id.localeCompare(b.id)),
    assets: [...assets.values()].sort((a, b) => a.purchased.localeCompare(b.purchased) || a.description.localeCompare(b.description)),
    years,
  };
}

function readBoundedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length > max) return null;
  return trimmed;
}

function validateDays(value: unknown, year: FinancialYear, errors: string[]): DayLog[] {
  if (!Array.isArray(value)) {
    push(errors, `${year.label} day logs must be an array.`);
    return [];
  }
  if (value.length > 4000) push(errors, `${year.label} has too many day logs.`);
  const seen = new Set<string>();
  const logs: DayLog[] = [];
  value.forEach((item, index) => {
    const label = `${year.label} day ${index + 1}`;
    if (!isRecord(item)) {
      push(errors, `${label} must be an object.`);
      return;
    }
    const date = item.date;
    if (typeof date !== "string" || !isRealIsoDate(date) || !isWithin(date, year.start, year.end)) {
      push(errors, `${label} needs a real date inside ${year.label}.`);
      return;
    }
    if (seen.has(date)) {
      push(errors, `${label} repeats ${date}.`);
      return;
    }
    seen.add(date);
    if (!MODES.has(item.mode as WorkMode)) {
      push(errors, `${label} has an unknown work mode.`);
      return;
    }
    const mode = item.mode as WorkMode;
    if (!isValidHours(item.hours) || (mode === "wfh" ? item.hours <= 0 : item.hours !== 0)) {
      push(errors, `${label} has hours TaxTrack cannot use.`);
      return;
    }
    const notes = readBoundedString(item.notes, 500);
    if (notes === null) {
      push(errors, `${label} has a note that is missing or too long.`);
      return;
    }
    if (typeof item.receiptMarker !== "boolean") {
      push(errors, `${label} needs a true or false receipt marker.`);
      return;
    }
    logs.push({ date, mode, hours: item.hours, notes, receiptMarker: item.receiptMarker });
  });
  return logs;
}

function validateExpenses(value: unknown, year: FinancialYear, errors: string[]): BackupExpense[] {
  if (!Array.isArray(value)) {
    push(errors, `${year.label} expenses must be an array.`);
    return [];
  }
  if (value.length > 4000) push(errors, `${year.label} has too many expenses.`);
  const seen = new Set<string>();
  const expenses: BackupExpense[] = [];
  value.forEach((item, index) => {
    const label = `${year.label} expense ${index + 1}`;
    if (!isRecord(item)) {
      push(errors, `${label} must be an object.`);
      return;
    }
    const id = readBoundedString(item.id, 80);
    if (!id || !/^[\w.-]+$/.test(id)) {
      push(errors, `${label} needs a simple id.`);
      return;
    }
    if (seen.has(id)) {
      push(errors, `${label} repeats an id.`);
      return;
    }
    seen.add(id);
    const date = item.date;
    if (typeof date !== "string" || !isRealIsoDate(date) || !isWithin(date, year.start, year.end)) {
      push(errors, `${label} needs a real date inside ${year.label}.`);
      return;
    }
    if (typeof item.amount !== "number" || !Number.isFinite(item.amount) || item.amount <= 0 || item.amount > 1_000_000) {
      push(errors, `${label} needs an amount greater than zero.`);
      return;
    }
    const cents = Math.round(item.amount * 100);
    if (Math.abs(item.amount * 100 - cents) > 1e-6) {
      push(errors, `${label} has more than two decimal places.`);
      return;
    }
    if (!CATEGORY_IDS.has(item.category as ExpenseCategory)) {
      push(errors, `${label} has an unknown category.`);
      return;
    }
    const description = readBoundedString(item.description, 160);
    if (!description) {
      push(errors, `${label} needs a description.`);
      return;
    }
    const merchant = readBoundedString(item.merchant, 80);
    if (merchant === null) {
      push(errors, `${label} has a merchant name that is too long.`);
      return;
    }
    if (!PAYMENTS.has(item.paymentMethod as PaymentMethod)) {
      push(errors, `${label} has an unknown payment method.`);
      return;
    }
    const notes = readBoundedString(item.notes, 500);
    if (notes === null) {
      push(errors, `${label} has a note that is missing or too long.`);
      return;
    }
    if (typeof item.dgrConfirmed !== "boolean" || typeof item.isEquipment !== "boolean") {
      push(errors, `${label} has a confirmation field TaxTrack cannot read.`);
      return;
    }
    const workUsePercent = item.workUsePercent;
    if (typeof workUsePercent !== "number" || !Number.isInteger(workUsePercent) || workUsePercent < 1 || workUsePercent > 100) {
      push(errors, `${label} needs a work-use percentage from 1 to 100.`);
      return;
    }
    let kilometres: number | null = null;
    if (item.kilometres !== undefined && item.kilometres !== null) {
      if (typeof item.kilometres !== "number" || !Number.isFinite(item.kilometres) || item.kilometres <= 0 || item.kilometres > 20_000) {
        push(errors, `${label} needs a kilometre figure greater than zero.`);
        return;
      }
      const hundredths = Math.round(item.kilometres * 100);
      if (Math.abs(item.kilometres * 100 - hundredths) > 1e-6) {
        push(errors, `${label} has more than two decimal places on the kilometres.`);
        return;
      }
      kilometres = hundredths / 100;
    }
    if (item.category === "car" && kilometres === null) {
      push(errors, `${label} needs the work kilometres.`);
      return;
    }
    const vehicle = item.vehicle === undefined ? "" : readBoundedString(item.vehicle, 80);
    if (vehicle === null) {
      push(errors, `${label} has a vehicle name that is too long.`);
      return;
    }
    let receiptId: string | null = null;
    if (item.receiptId !== undefined && item.receiptId !== null) {
      if (typeof item.receiptId !== "string" || item.receiptId.length > 80 || !/^[\w.-]+$/.test(item.receiptId)) {
        push(errors, `${label} has a receipt id TaxTrack cannot use.`);
        return;
      }
      receiptId = item.receiptId;
    }
    let receiptImage: string | undefined;
    if (item.receiptImage !== undefined && item.receiptImage !== null) {
      if (!isReceiptFile(item.receiptImage)) {
        push(errors, `${label} has a receipt file that is not a JPEG photo, PDF, or Word document.`);
        return;
      }
      receiptImage = item.receiptImage;
      receiptId = receiptId ?? createId();
    }
    expenses.push({
      id,
      date,
      amount: item.amount,
      category: item.category as ExpenseCategory,
      description,
      merchant,
      paymentMethod: item.paymentMethod as PaymentMethod,
      notes,
      dgrConfirmed: item.dgrConfirmed,
      isEquipment: item.isEquipment,
      workUsePercent,
      kilometres,
      vehicle,
      receiptId,
      ...(receiptImage ? { receiptImage } : {}),
    });
  });
  return expenses;
}

function validateProperties(value: unknown, errors: string[]): RentalProperty[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    push(errors, "Rental properties must be a list.");
    return [];
  }
  const seen = new Set<string>();
  const properties: RentalProperty[] = [];
  value.forEach((item, index) => {
    const label = `Rental property ${index + 1}`;
    if (!isRecord(item)) {
      push(errors, `${label} must be an object.`);
      return;
    }
    const id = readBoundedString(item.id, 80);
    if (!id || !/^[\w.-]+$/.test(id)) {
      push(errors, `${label} needs a simple id.`);
      return;
    }
    if (seen.has(id)) {
      push(errors, `${label} repeats an id.`);
      return;
    }
    seen.add(id);
    const address = readBoundedString(item.address, 160);
    if (!address) {
      push(errors, `${label} needs an address.`);
      return;
    }
    properties.push({ id, address });
  });
  return properties;
}

function validateRentalExpenses(value: unknown, year: FinancialYear, propertyIds: Set<string>, errors: string[]): RentalExpense[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    push(errors, `${year.label} rental expenses must be an array.`);
    return [];
  }
  const seen = new Set<string>();
  const expenses: RentalExpense[] = [];
  value.forEach((item, index) => {
    const label = `${year.label} rental expense ${index + 1}`;
    if (!isRecord(item)) {
      push(errors, `${label} must be an object.`);
      return;
    }
    const id = readBoundedString(item.id, 80);
    if (!id || !/^[\w.-]+$/.test(id)) {
      push(errors, `${label} needs a simple id.`);
      return;
    }
    if (seen.has(id)) {
      push(errors, `${label} repeats an id.`);
      return;
    }
    seen.add(id);
    const propertyId = readBoundedString(item.propertyId, 80);
    if (!propertyId || !propertyIds.has(propertyId)) {
      push(errors, `${label} needs a property from this backup.`);
      return;
    }
    const date = item.date;
    if (typeof date !== "string" || !isRealIsoDate(date) || !isWithin(date, year.start, year.end)) {
      push(errors, `${label} needs a real date inside ${year.label}.`);
      return;
    }
    if (typeof item.amount !== "number" || !Number.isFinite(item.amount) || item.amount <= 0 || item.amount > 1_000_000) {
      push(errors, `${label} needs an amount greater than zero.`);
      return;
    }
    const cents = Math.round(item.amount * 100);
    if (Math.abs(item.amount * 100 - cents) > 1e-6) {
      push(errors, `${label} has more than two decimal places.`);
      return;
    }
    if (!RENTAL_IDS.has(item.category as RentalCategory)) {
      push(errors, `${label} has an unknown rental category.`);
      return;
    }
    const description = readBoundedString(item.description, 160);
    if (!description) {
      push(errors, `${label} needs a description.`);
      return;
    }
    const notes = readBoundedString(item.notes, 500);
    if (notes === null) {
      push(errors, `${label} has a note that is missing or too long.`);
      return;
    }
    expenses.push({
      id,
      propertyId,
      date,
      amount: item.amount,
      category: item.category as RentalCategory,
      description,
      notes,
    });
  });
  return expenses;
}

function validateAssets(value: unknown, errors: string[]): DepreciatingAsset[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    push(errors, "Depreciating assets must be a list.");
    return [];
  }
  const seen = new Set<string>();
  const assets: DepreciatingAsset[] = [];
  value.forEach((item, index) => {
    const label = `Depreciating asset ${index + 1}`;
    if (!isRecord(item)) {
      push(errors, `${label} must be an object.`);
      return;
    }
    const id = readBoundedString(item.id, 80);
    if (!id || !/^[\w.-]+$/.test(id)) {
      push(errors, `${label} needs a simple id.`);
      return;
    }
    if (seen.has(id)) {
      push(errors, `${label} repeats an id.`);
      return;
    }
    seen.add(id);
    const description = readBoundedString(item.description, 160);
    if (!description) {
      push(errors, `${label} needs a description.`);
      return;
    }
    const purchased = item.purchased;
    if (typeof purchased !== "string" || !isRealIsoDate(purchased)) {
      push(errors, `${label} needs the day it was first used.`);
      return;
    }
    if (typeof item.cost !== "number" || !Number.isFinite(item.cost) || item.cost <= 0 || item.cost > 1_000_000) {
      push(errors, `${label} needs a purchase price greater than zero.`);
      return;
    }
    const cents = Math.round(item.cost * 100);
    if (Math.abs(item.cost * 100 - cents) > 1e-6) {
      push(errors, `${label} has more than two decimal places.`);
      return;
    }
    if (typeof item.effectiveLifeYears !== "number" || !Number.isFinite(item.effectiveLifeYears) || item.effectiveLifeYears < 1 || item.effectiveLifeYears > 40) {
      push(errors, `${label} needs an effective life from 1 to 40 years.`);
      return;
    }
    if (typeof item.workUsePercent !== "number" || !Number.isInteger(item.workUsePercent) || item.workUsePercent < 1 || item.workUsePercent > 100) {
      push(errors, `${label} needs a work-use percentage from 1 to 100.`);
      return;
    }
    if (item.method !== "prime-cost" && item.method !== "diminishing-value") {
      push(errors, `${label} needs prime cost or diminishing value.`);
      return;
    }
    const notes = readBoundedString(item.notes, 500);
    if (notes === null) {
      push(errors, `${label} has a note that is missing or too long.`);
      return;
    }
    const method: DepreciationMethod = item.method;
    assets.push({ id, description, purchased, cost: item.cost, effectiveLifeYears: item.effectiveLifeYears, workUsePercent: item.workUsePercent, method, notes });
  });
  return assets;
}

export function validateBackup(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ["The file must be a JSON object."] };
  if (value.app !== "taxtrack" && value.app !== "daybook") push(errors, "This is not a TaxTrack backup. The app name does not match.");
  if (value.version !== 1) push(errors, "This backup version is not supported. TaxTrack can read version 1 only.");
  if (value.exportedAt !== undefined && (typeof value.exportedAt !== "string" || value.exportedAt.length > 40)) {
    push(errors, "The export timestamp is not readable.");
  }

  let activeYear: YearId = "2025-26";
  if (isYearId(value.activeYear)) activeYear = value.activeYear;
  else push(errors, "The active income year must be 2025-26 or 2026-27.");

  let defaultWfhHours = DEFAULT_WFH_HOURS;
  if (
    isRecord(value.settings) &&
    isValidHours(value.settings.defaultWfhHours) &&
    value.settings.defaultWfhHours > 0
  ) {
    defaultWfhHours = value.settings.defaultWfhHours;
  } else {
    push(errors, "The standard day length must be from 0.1 to 24 hours, in tenths of an hour.");
  }

  let rentalProperties = false;
  if (isRecord(value.settings) && value.settings.rentalProperties !== undefined) {
    if (typeof value.settings.rentalProperties !== "boolean") push(errors, "The rental properties switch must be on or off.");
    else rentalProperties = value.settings.rentalProperties;
  }

  const properties = validateProperties(value.properties, errors);
  const assets = validateAssets(value.assets, errors);
  const propertyIds = new Set(properties.map((property) => property.id));

  if (!isRecord(value.years)) {
    push(errors, "The file needs a years object with your income-year records.");
    return { ok: false, errors };
  }
  for (const key of Object.keys(value.years)) {
    if (!isYearId(key)) push(errors, `Unsupported income year "${key}". TaxTrack reads 2025-26, 2026-27, and 2027-28.`);
  }

  const years = {} as BackupFile["years"];
  for (const year of FINANCIAL_YEARS) {
    const raw = value.years[year.id];
    if (raw === undefined) {
      years[year.id] = emptyBackupYear();
      continue;
    }
    if (!isRecord(raw)) {
      push(errors, `${year.label} must contain day logs and expenses.`);
      years[year.id] = emptyBackupYear();
      continue;
    }
    years[year.id] = {
      dayLogs: validateDays(raw.dayLogs, year, errors),
      expenses: validateExpenses(raw.expenses, year, errors),
      rentalExpenses: validateRentalExpenses(raw.rentalExpenses, year, propertyIds, errors),
    };
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      app: "taxtrack",
      version: 1,
      ...(typeof value.exportedAt === "string" ? { exportedAt: value.exportedAt } : {}),
      activeYear,
      settings: { defaultWfhHours, rentalProperties },
      properties,
      assets,
      years,
    },
  };
}

export async function downloadBackup(state: AppState): Promise<string> {
  const { withReceiptImages } = await import("@/lib/receiptStore");
  const filename = backupFilename(new Date());
  const file = await withReceiptImages(stateToBackup(state, new Date().toISOString()));
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}
