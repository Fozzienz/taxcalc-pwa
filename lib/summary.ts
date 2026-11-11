import type { FinancialYear } from "@/lib/ato-rules";
import { FIXED_RATE_INCLUDES } from "@/lib/ato-rules";
import { calculateClaims, type ClaimFigures } from "@/lib/calculations";
import { formatLongDate, formatPeriod } from "@/lib/dates";
import { formatCents, formatHours, formatWholeDollars, toCents, wholeDollarsFromCents } from "@/lib/money";
import { categoryById, type Expense, type YearData } from "@/lib/types";

export interface SummaryRow {
  label: string;
  value: string;
  strong?: boolean;
}

export interface SummaryBlock {
  id: string;
  title: string;
  kicker: string;
  rows: SummaryRow[];
  notes: string[];
}

export interface SummaryModel {
  totalDollars: number;
  blocks: SummaryBlock[];
  exclusionTitle: string;
  exclusionRows: string[];
  footnotes: string[];
  text: string;
  figures: ClaimFigures;
}

function combined(cents: number[]): { cents: number; dollars: number } {
  const total = cents.reduce((sum, value) => sum + value, 0);
  return { cents: total, dollars: wholeDollarsFromCents(total) };
}

function assetLine(expense: Expense): string {
  const use = expense.workUsePercent === 100 ? "" : ` · ${expense.workUsePercent}% work use`;
  return `${formatLongDate(expense.date)} · ${expense.description} · cost ${formatMoneySafe(expense)} · ${categoryById(expense.category).label}${use}`;
}

function formatMoneySafe(expense: Expense): string {
  return formatCents(toCents(expense.amount));
}

export function buildSummary(year: FinancialYear, data: YearData): SummaryModel {
  const figures = calculateClaims({
    centsPerHour: year.wfhCentsPerHour,
    dayLogs: Object.values(data.dayLogs),
    expenses: data.expenses,
  });
  const clothing = combined([figures.clothing.cents, figures.laundry.cents]);
  const otherWork = combined([figures.tools.cents, figures.subscriptions.cents, figures.other.cents]);
  const totalDollars =
    figures.wfhDollars +
    clothing.dollars +
    figures.selfEducation.wholeDollars +
    figures.donations.wholeDollars +
    otherWork.dollars +
    figures.taxAffairs.wholeDollars;

  const blocks: SummaryBlock[] = [
    {
      id: "wfh",
      title: "Working from home",
      kicker: "Other work-related expenses · fixed rate method",
      rows: [
        { label: "Hours logged", value: formatHours(figures.wfhHours) },
        { label: "Days logged", value: String(figures.wfhDays) },
        { label: "Fixed rate", value: formatCents(year.wfhCentsPerHour) },
        { label: "Exact amount", value: formatCents(figures.wfhCents) },
        { label: "Enter", value: formatWholeDollars(figures.wfhDollars), strong: true },
      ],
      notes: [
        "If myTax asks for hours, enter the hours and use its calculation. If it asks for dollars, enter the whole-dollar amount. Do not enter both.",
        `The ${formatCents(year.wfhCentsPerHour)} rate already includes ${FIXED_RATE_INCLUDES.map((item) => item.toLowerCase()).join(", ")}. Do not claim those again.`,
      ],
    },
    {
      id: "clothing",
      title: "Clothing, laundry and dry-cleaning",
      kicker: "Work-related clothing expenses",
      rows: [
        { label: "Clothing and uniforms", value: formatCents(figures.clothing.cents) },
        { label: "Laundry", value: formatCents(figures.laundry.cents) },
        { label: "Enter", value: formatWholeDollars(clothing.dollars), strong: true },
      ],
      notes: [
        "Only occupation-specific clothing, protective clothing, and compulsory uniforms belong here.",
        ...(figures.laundryNeedsEvidence
          ? ["This laundry total is over $150, so written evidence is required before you claim it."]
          : []),
      ],
    },
    {
      id: "donations",
      title: "Gifts or donations",
      kicker: "Deductible gift recipients",
      rows: [
        { label: "Confirmed DGR gifts", value: formatCents(figures.donations.cents) },
        { label: "Enter", value: formatWholeDollars(figures.donations.wholeDollars), strong: true },
      ],
      notes: ["Gifts must be $2 or more to an organisation with DGR status."],
    },
    {
      id: "education",
      title: "Self-education expenses",
      kicker: "Current work only",
      rows: [
        { label: "Claimable self-education", value: formatCents(figures.selfEducation.cents) },
        { label: "Enter", value: formatWholeDollars(figures.selfEducation.wholeDollars), strong: true },
      ],
      notes: [
        "The study must relate to your current work. HELP and HECS repayments are not deductible.",
        "Equipment over $300 is listed with depreciating assets and is not in this figure.",
      ],
    },
    {
      id: "other",
      title: "Other work expenses",
      kicker: "Other work-related expenses, excluding the fixed rate",
      rows: [
        { label: "Tools and equipment, $300 or under", value: formatCents(figures.tools.cents) },
        { label: "Subscriptions", value: formatCents(figures.subscriptions.cents) },
        { label: "Other", value: formatCents(figures.other.cents) },
        { label: "Enter", value: formatWholeDollars(otherWork.dollars), strong: true },
      ],
      notes: [
        "This is separate from the working-from-home figure. If myTax has one box for all other work-related expenses, add the two whole-dollar amounts together.",
      ],
    },
    {
      id: "tax",
      title: "Cost of managing tax affairs",
      kicker: "Tax agent fees",
      rows: [
        { label: "Fees logged", value: formatCents(figures.taxAffairs.cents) },
        { label: "Enter", value: formatWholeDollars(figures.taxAffairs.wholeDollars), strong: true },
      ],
      notes: ["Claim the fee in the year you paid it."],
    },
  ];

  const exclusionRows = [
    ...figures.depreciating.map((expense) => `Depreciating asset · ${assetLine(expense)}`),
    ...figures.heldDonations.map(
      (expense) => `DGR not confirmed · ${formatLongDate(expense.date)} · ${expense.description} · ${formatMoneySafe(expense)}`,
    ),
    ...figures.smallDonations.map(
      (expense) => `Under $2 · ${formatLongDate(expense.date)} · ${expense.description} · ${formatMoneySafe(expense)}`,
    ),
  ];

  const footnotes = [
    `${year.label} income year (${formatPeriod(year.start, year.end)}).`,
    "Whole dollars. Cents disregarded, not rounded.",
    year.rateNote,
    "TaxTrack does not calculate decline in value. A depreciating asset is listed at its full cost and kept out of the total.",
    ...(figures.workExpensesNeedEvidence
      ? ["Work-related expenses are over $300, so written evidence is required for the expenses you claim."]
      : []),
    "Estimates only. TaxTrack is not the ATO and not a registered tax agent.",
  ];

  const model: Omit<SummaryModel, "text"> = {
    totalDollars,
    blocks,
    exclusionTitle: "Not in the total",
    exclusionRows,
    footnotes,
    figures,
  };

  return { ...model, text: plainText(year, model, clothing.dollars, otherWork.dollars) };
}

function plainText(
  year: FinancialYear,
  model: Omit<SummaryModel, "text">,
  clothingDollars: number,
  otherWorkDollars: number,
): string {
  const lines = [
    "TAXTRACK FIGURES FOR MYTAX",
    `Income year ${year.label} (${formatPeriod(year.start, year.end)})`,
    "Whole dollars. Cents disregarded, not rounded.",
    "Estimates from your TaxTrack records. Check them before you lodge.",
    "",
  ];

  for (const block of model.blocks) {
    lines.push(block.title.toUpperCase());
    lines.push(block.kicker);
    for (const row of block.rows) {
      lines.push(`${row.label}: ${row.value}`);
    }
    for (const note of block.notes) lines.push(note);
    lines.push("");
  }

  lines.push(`TOTAL TO ENTER: ${formatWholeDollars(model.totalDollars)}`);
  lines.push(
    `Working from home ${formatWholeDollars(model.figures.wfhDollars)} + clothing and laundry ${formatWholeDollars(clothingDollars)} + self-education ${formatWholeDollars(model.figures.selfEducation.wholeDollars)} + other work expenses ${formatWholeDollars(otherWorkDollars)} + donations ${formatWholeDollars(model.figures.donations.wholeDollars)} + tax affairs ${formatWholeDollars(model.figures.taxAffairs.wholeDollars)}.`,
  );
  lines.push("");
  lines.push(model.exclusionTitle.toUpperCase());
  if (model.exclusionRows.length === 0) {
    lines.push("Nothing is held out of the estimate.");
  } else {
    lines.push("These amounts are not in the total. Depreciating assets need a decline-in-value claim, not the full price.");
    for (const row of model.exclusionRows) lines.push(`- ${row}`);
  }
  lines.push("");
  for (const note of model.footnotes) lines.push(`Note: ${note}`);
  return lines.join("\n");
}
