import type { FinancialYear } from "@/lib/ato-rules";
import { FIXED_RATE_INCLUDES } from "@/lib/ato-rules";
import { calculateClaims, type ClaimFigures } from "@/lib/calculations";
import { formatLongDate, formatPeriod } from "@/lib/dates";
import { formatCents, formatHours, formatWholeDollars, toCents, wholeDollarsFromCents } from "@/lib/money";
import { categoryById, type DepreciatingAsset, type Expense, type RentalProperty, type YearData } from "@/lib/types";
import { formatKilometres, summariseCar } from "@/lib/car";
import { summariseDecline } from "@/lib/depreciation";
import { summariseRentals } from "@/lib/rentals";

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

export function buildSummary(
  year: FinancialYear,
  data: YearData,
  options: { rentals?: boolean; properties?: readonly RentalProperty[]; assets?: readonly DepreciatingAsset[] } = {},
): SummaryModel {
  const figures = calculateClaims({
    centsPerHour: year.wfhCentsPerHour,
    carCentsPerKm: year.carCentsPerKm,
    dayLogs: Object.values(data.dayLogs),
    expenses: data.expenses,
  });
  const clothing = combined([figures.clothing.cents, figures.laundry.cents]);
  const otherWork = combined([figures.tools.cents, figures.subscriptions.cents, figures.other.cents]);
  const car = summariseCar(data.expenses, year.carCentsPerKm);
  const rental = summariseRentals(data.rentalExpenses ?? [], options.properties ?? []);
  const decline = summariseDecline(options.assets ?? [], year);
  const totalDollars =
    figures.wfhDollars +
    clothing.dollars +
    figures.selfEducation.wholeDollars +
    figures.donations.wholeDollars +
    otherWork.dollars +
    figures.car.wholeDollars +
    figures.taxAffairs.wholeDollars +
    (options.rentals ? rental.dollars : 0) +
    ((options.assets ?? []).length > 0 ? decline.dollars : 0);

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
    ...(figures.car.count > 0
      ? [
          {
            id: "car",
            title: "Work-related car expenses",
            kicker: "Cents per kilometre",
            rows: [
              { label: "Kilometres logged", value: `${formatKilometres(car.kilometres)} km` },
              ...(Math.abs(car.claimKilometres - car.kilometres) > 0.001
                ? [{ label: "Kilometres that count", value: `${formatKilometres(car.claimKilometres)} km` }]
                : []),
              { label: "Rate", value: `${formatCents(year.carCentsPerKm)} per km` },
              ...(car.vehicles.length > 1
                ? car.vehicles.map((row) => ({
                    label: row.vehicle,
                    value: `${formatKilometres(row.claimKilometres)} km · ${formatCents(row.cents)}`,
                  }))
                : []),
              { label: "Enter", value: formatWholeDollars(figures.car.wholeDollars), strong: true },
            ],
            notes: [
              `The ${formatCents(year.carCentsPerKm)} rate covers fuel, registration, insurance, servicing, and decline in value. Do not claim those again.`,
              "The claim stops at 5,000 km for each car. Keep a note of how you worked the kilometres out. Trips between home and your regular workplace are not included.",
              ...(year.id === "2027-28" ? ["Confirm the 2027–28 cents per kilometre rate before you lodge."] : []),
            ],
          },
        ]
      : []),
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

  if ((options.assets ?? []).length > 0) {
    blocks.push({
      id: "decline",
      title: "Decline in value",
      kicker: "Depreciating assets · days held divided by 365",
      rows: [
        ...decline.rows.map((row) => ({ label: row.description, value: formatCents(row.claimCents) })),
        { label: "Enter", value: formatWholeDollars(decline.dollars), strong: true },
      ],
      notes: [
        "Prime cost spreads the purchase price over the effective life. Diminishing value uses 200% of that rate on the opening value. An item of $300 or less, used mainly for work, is an immediate deduction in the year you first used it.",
      ],
    });
  }

  if (options.rentals) {
    blocks.push({
      id: "rentals",
      title: "Rental properties",
      kicker: "Rent received, and the rental expenses you logged",
      rows: [
        { label: "Rent received", value: formatCents(rental.incomeCents) },
        { label: "Rent received, whole dollars", value: formatWholeDollars(rental.incomeDollars) },
        ...rental.byProperty.map((property) => ({ label: property.address, value: formatCents(property.cents) })),
        ...rental.byCategory.filter((row) => row.cents > 0).map((row) => ({ label: row.label, value: formatCents(row.cents) })),
        { label: "Enter", value: formatWholeDollars(rental.dollars), strong: true },
      ],
      notes: [
        "Rent received is income. Enter is the rental expenses, with the cents dropped. TaxTrack does not split private use, work out decline in value, or decide if a repair is a capital improvement.",
      ],
    });
  }

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
    "A tool over $300 logged under Expenses stays at its full cost in Not in the total. Log it under Assets for the yearly decline in value.",
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
  const rentalEnter = model.blocks.find((block) => block.id === "rentals")?.rows.find((row) => row.label === "Enter")?.value;
  const declineEnter = model.blocks.find((block) => block.id === "decline")?.rows.find((row) => row.label === "Enter")?.value;
  const carEnter = model.blocks.find((block) => block.id === "car")?.rows.find((row) => row.label === "Enter")?.value;
  lines.push(
    `Working from home ${formatWholeDollars(model.figures.wfhDollars)} + clothing and laundry ${formatWholeDollars(clothingDollars)} + self-education ${formatWholeDollars(model.figures.selfEducation.wholeDollars)} + other work expenses ${formatWholeDollars(otherWorkDollars)} + donations ${formatWholeDollars(model.figures.donations.wholeDollars)} + tax affairs ${formatWholeDollars(model.figures.taxAffairs.wholeDollars)}${carEnter ? ` + car expenses ${carEnter}` : ""}${declineEnter ? ` + decline in value ${declineEnter}` : ""}${rentalEnter ? ` + rental properties ${rentalEnter}` : ""}.`,
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
