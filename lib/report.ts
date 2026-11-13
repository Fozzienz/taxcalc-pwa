import { assetTreatment, DISCLAIMER, type FinancialYear } from "@/lib/ato-rules";
import { expenseClaimCents } from "@/lib/calculations";
import { carClaims } from "@/lib/car";
import { formatPeriod, formatTimestamp } from "@/lib/dates";
import { formatCents, formatHours, formatWholeDollars, toCents, wholeDollarsFromCents } from "@/lib/money";
import { depreciationForPeriod, depreciationMethodLabel } from "@/lib/depreciation";
import { buildSummary, type SummaryModel } from "@/lib/summary";
import { categoryById, modeById, rentalCategoryById, type DepreciatingAsset, type Expense, type RentalProperty, type YearData } from "@/lib/types";

export interface YearReport {
  filenameBase: string;
  yearLabel: string;
  period: string;
  prepared: string;
  summaryRows: Array<{ item: string; detail: string; enter: string; enterDollars: number }>;
  totalEnter: string;
  totalDollars: number;
  hourRows: Array<{ date: string; mode: string; hours: number; counts: string; notes: string }>;
  hourNote: string;
  wfhHours: number;
  wfhDays: number;
  rateAud: number;
  expenseRows: Array<{
    date: string;
    description: string;
    merchant: string;
    category: string;
    payment: string;
    amountAud: number;
    workUse: number;
    claimAud: number;
    claimLabel: string;
    amountLabel: string;
    included: string;
    notes: string;
  }>;
  exclusions: string[];
  footnotes: string[];
  rentalRows: Array<{
    date: string;
    address: string;
    category: string;
    description: string;
    amountAud: number;
    amountLabel: string;
    notes: string;
  }> | null;
  assetRows: Array<{
    description: string;
    purchased: string;
    method: string;
    life: number | "";
    workUse: number;
    daysHeld: number;
    claimAud: number;
    claimLabel: string;
  }> | null;
}

function auDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function aud(cents: number): number {
  return Math.round(cents) / 100;
}

function inclusion(expense: Expense, claimCents: number): string {
  if (expense.category === "car" && claimCents <= 0) return "No - over 5,000 km for this car";
  if (assetTreatment(expense) === "depreciating") return "No - depreciating asset, not in the total";
  if (expense.category === "donations" && toCents(expense.amount) < 200) return "No - under $2";
  if (expense.category === "donations" && !expense.dgrConfirmed) return "No - DGR not confirmed";
  return "Yes";
}

function enterDollars(summary: SummaryModel, id: string): number {
  const figures = summary.figures;
  if (id === "wfh") return figures.wfhDollars;
  if (id === "clothing") return wholeDollarsFromCents(figures.clothing.cents + figures.laundry.cents);
  if (id === "donations") return figures.donations.wholeDollars;
  if (id === "education") return figures.selfEducation.wholeDollars;
  if (id === "other") return wholeDollarsFromCents(figures.tools.cents + figures.subscriptions.cents + figures.other.cents);
  if (id === "car") return figures.car.wholeDollars;
  if (id === "tax") return figures.taxAffairs.wholeDollars;
  if (id === "decline") {
    const enter = summary.blocks.find((block) => block.id === "decline")?.rows.find((row) => row.label === "Enter")?.value ?? "";
    return Number(enter.replace(/[^0-9-]/g, "")) || 0;
  }
  if (id === "rentals") {
    const enter = summary.blocks.find((block) => block.id === "rentals")?.rows.find((row) => row.label === "Enter")?.value ?? "";
    return Number(enter.replace(/[^0-9-]/g, "")) || 0;
  }
  return 0;
}

export function buildYearReport(
  year: FinancialYear,
  data: YearData,
  prepared = new Date(),
  options: { rentals?: boolean; properties?: readonly RentalProperty[]; assets?: readonly DepreciatingAsset[] } = {},
): YearReport {
  const summary = buildSummary(year, data, options);
  const days = Object.values(data.dayLogs).sort((a, b) => a.date.localeCompare(b.date));
  const expenses = [...data.expenses].sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description));
  const tripClaims = carClaims(expenses, year.carCentsPerKm);

  return {
    filenameBase: `taxtrack-report-${year.id}`,
    yearLabel: year.label,
    period: formatPeriod(year.start, year.end),
    prepared: formatTimestamp(prepared.toISOString()),
    summaryRows: summary.blocks.map((block) => {
      const enter = block.rows.find((row) => row.label === "Enter");
      const detail = block.rows
        .filter((row) => row.label !== "Enter")
        .map((row) => `${row.label}: ${row.value}`)
        .join(". ");
      return { item: block.title, detail, enter: enter?.value ?? formatWholeDollars(0), enterDollars: enterDollars(summary, block.id) };
    }),
    totalEnter: formatWholeDollars(summary.totalDollars),
    totalDollars: summary.totalDollars,
    hourRows: days.map((log) => ({
      date: auDate(log.date),
      mode: modeById(log.mode).label,
      hours: Math.round(log.hours * 10) / 10,
      counts: log.mode === "wfh" && log.hours > 0 ? "Yes" : "No",
      notes: log.notes,
    })),
    hourNote: `${formatHours(summary.figures.wfhHours)} hours over ${summary.figures.wfhDays} ${summary.figures.wfhDays === 1 ? "day" : "days"} count toward the fixed rate. Exact amount ${formatCents(summary.figures.wfhCents)}. Enter ${formatWholeDollars(summary.figures.wfhDollars)}.`,
    wfhHours: Math.round(summary.figures.wfhHours * 10) / 10,
    wfhDays: summary.figures.wfhDays,
    rateAud: aud(year.wfhCentsPerHour),
    expenseRows: expenses.map((expense) => ({
      date: auDate(expense.date),
      description: expense.description,
      merchant: expense.merchant,
      category: categoryById(expense.category).label,
      payment: expense.paymentMethod === "card" ? "Card" : expense.paymentMethod === "cash" ? "Cash" : "Other",
      amountAud: aud(toCents(expense.amount)),
      workUse: expense.workUsePercent,
      claimAud: aud(expenseClaimCents(expense, tripClaims)),
      claimLabel: formatCents(expenseClaimCents(expense, tripClaims)),
      amountLabel: formatCents(toCents(expense.amount)),
      included: inclusion(expense, expenseClaimCents(expense, tripClaims)),
      notes: expense.notes,
    })),
    exclusions: summary.exclusionRows.length > 0 ? summary.exclusionRows : ["Nothing is held out of the estimate."],
    footnotes: [...summary.footnotes, DISCLAIMER],
    rentalRows: options.rentals
      ? [...(data.rentalExpenses ?? [])]
          .sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description))
          .map((expense) => ({
            date: auDate(expense.date),
            address: (options.properties ?? []).find((property) => property.id === expense.propertyId)?.address ?? "Unknown address",
            category: rentalCategoryById(expense.category).label,
            description: expense.description,
            amountAud: aud(toCents(expense.amount)),
            amountLabel: formatCents(toCents(expense.amount)),
            notes: expense.notes,
          }))
      : null,
    assetRows:
      options.assets && options.assets.length > 0
        ? options.assets.map((asset) => {
            const row = depreciationForPeriod(asset, year.start);
            const immediate = depreciationMethodLabel(asset) === "Immediate deduction";
            return {
              description: asset.description,
              purchased: auDate(asset.purchased),
              method: depreciationMethodLabel(asset),
              life: immediate ? "" : asset.effectiveLifeYears,
              workUse: asset.workUsePercent,
              daysHeld: row?.daysHeld ?? 0,
              claimAud: aud(row?.claimCents ?? 0),
              claimLabel: formatCents(row?.claimCents ?? 0),
            };
          })
        : null,
  };
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[,"\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvLine(cells: readonly (string | number)[]): string {
  return cells.map(csvCell).join(",");
}

/** Comma-separated workbook companion, with the same section banners as the Excel file. */
export function buildCsvReport(
  year: FinancialYear,
  data: YearData,
  prepared = new Date(),
  options: { rentals?: boolean; properties?: readonly RentalProperty[]; assets?: readonly DepreciatingAsset[] } = {},
): string {
  const report = buildYearReport(year, data, prepared, options);
  const lines = [
    csvLine(["=== TAXTRACK ==="]),
    csvLine(["Product", "TaxTrack"]),
    csvLine(["Income year", report.yearLabel]),
    csvLine(["Period", report.period]),
    csvLine(["Prepared", report.prepared]),
    csvLine([]),
    csvLine(["=== TOTALS ==="]),
    csvLine(["Item", "Detail", "Whole dollars to enter"]),
    ...report.summaryRows.map((row) => csvLine([row.item, row.detail, row.enterDollars])),
    csvLine(["Total to enter", "", report.totalDollars]),
    csvLine([]),
    csvLine(["=== WORK FROM HOME — Fixed rate ==="]),
    csvLine(["Date", "Mode", "Hours", "Counts toward the fixed rate", "Notes"]),
    ...(report.hourRows.length > 0
      ? report.hourRows.map((row) => csvLine([row.date, row.mode, row.hours, row.counts, row.notes]))
      : [csvLine(["No days logged"])]),
    csvLine(["Hours that count", report.hourNote]),
    csvLine(["FY total claim (AUD)", report.summaryRows.find((row) => row.item === "Working from home")?.enterDollars ?? 0]),
    csvLine([]),
    csvLine(["=== EXPENSES ==="]),
    csvLine(["Date", "Description", "Merchant", "Category", "Payment", "Amount (AUD)", "Work use %", "Claim (AUD)", "In the total", "Notes"]),
    ...(report.expenseRows.length > 0
      ? report.expenseRows.map((row) =>
          csvLine([
            row.date,
            row.description,
            row.merchant,
            row.category,
            row.payment,
            row.amountAud,
            row.workUse,
            row.claimAud,
            row.included,
            row.notes,
          ]),
        )
      : [csvLine(["No expenses logged"])]),
    csvLine([]),
    ...(report.assetRows
      ? [
          csvLine(["=== DECLINE IN VALUE ==="]),
          csvLine(["Description", "First used", "Method", "Effective life (years)", "Work use %", "Days held", "Claim (AUD)"]),
          ...report.assetRows.map((row) => csvLine([row.description, row.purchased, row.method, row.life, row.workUse, row.daysHeld, row.claimAud])),
          csvLine([]),
        ]
      : []),
    ...(report.rentalRows
      ? [
          csvLine(["=== RENTAL PROPERTIES ==="]),
          csvLine(["Date", "Address", "Category", "Description", "Amount (AUD)", "Notes"]),
          ...(report.rentalRows.length > 0
            ? report.rentalRows.map((row) => csvLine([row.date, row.address, row.category, row.description, row.amountAud, row.notes]))
            : [csvLine(["No rent or rental expenses logged"])]),
          csvLine([]),
        ]
      : []),
    csvLine(["=== NOT IN THE TOTAL ==="]),
    ...report.exclusions.map((line) => csvLine([line])),
    csvLine([]),
    csvLine(["=== NOTES ==="]),
    ...report.footnotes.map((line) => csvLine([line])),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
