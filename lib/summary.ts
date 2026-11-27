import type { FinancialYear } from "@/lib/ato-rules";
import { FIXED_RATE_INCLUDES } from "@/lib/ato-rules";
import { calculateClaims, type ClaimFigures } from "@/lib/calculations";
import { formatLongDate, formatPeriod } from "@/lib/dates";
import { formatCents, formatHours, formatWholeDollars, toCents, wholeDollarsFromCents } from "@/lib/money";
import { categoryById, type CarMethod, type DepreciatingAsset, type Expense, type RentalProperty, type WfhMethod, type YearData } from "@/lib/types";
import { formatKilometres, isCarCost, isCarTrip, summariseCar, summariseLogbook } from "@/lib/car";
import { summariseDecline } from "@/lib/depreciation";
import { summariseRentals } from "@/lib/rentals";

export interface SummaryRow {
  label: string;
  value: string;
  strong?: boolean;
  /** A money amount. Zero amounts stay off the summary unless the reader asks for them. */
  cents?: number;
  /** Hours, days, or a rate. These fold onto one line on screen. */
  fold?: boolean;
}

export interface SummaryBlock {
  id: string;
  title: string;
  kicker: string;
  rows: SummaryRow[];
  notes: string[];
  /** False when there is nothing to enter, and no hours or rental income to keep. */
  shown: boolean;
}

export interface SummaryModel {
  wfhMethod: WfhMethod;
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
  const wfhMethod: WfhMethod = data.wfhMethod === "actual" ? "actual" : "fixed";
  const carMethod: CarMethod = data.carMethod === "logbook" ? "logbook" : "cents";
  const asOf = new Date().toISOString().slice(0, 10);
  const figures = calculateClaims({
    centsPerHour: year.wfhCentsPerHour,
    carCentsPerKm: year.carCentsPerKm,
    dayLogs: Object.values(data.dayLogs),
    expenses: data.expenses,
    wfhMethod,
    carMethod,
    logbook: data.logbook,
    asOf,
  });
  const clothing = combined([figures.clothing.cents, figures.laundry.cents]);
  const otherWork = combined([figures.tools.cents, figures.subscriptions.cents, figures.other.cents]);
  const car = summariseCar(data.expenses, year.carCentsPerKm);
  const logbook = carMethod === "logbook" ? summariseLogbook(data.expenses, data.logbook, asOf) : null;
  const hasCarTrips = data.expenses.some((expense) => isCarTrip(expense) && (expense.kilometres ?? 0) > 0);
  const hasCarCosts = data.expenses.some((expense) => isCarCost(expense));
  const rental = summariseRentals(data.rentalExpenses ?? [], options.properties ?? []);
  const carShare = { applies: carMethod === "logbook", share: logbook?.ready ? logbook.share : null };
  const decline = summariseDecline(options.assets ?? [], year, carShare);
  const logbookCars = (options.assets ?? []).filter((asset) => asset.logbookCar);
  const homeDollars = wholeDollarsFromCents(wfhMethod === "actual" ? figures.runningCents : figures.wfhCents);
  const totalDollars =
    homeDollars +
    clothing.dollars +
    figures.selfEducation.wholeDollars +
    figures.donations.wholeDollars +
    otherWork.dollars +
    figures.car.wholeDollars +
    figures.travel.wholeDollars +
    figures.taxAffairs.wholeDollars +
    (options.rentals ? rental.dollars : 0) +
    ((options.assets ?? []).length > 0 ? decline.dollars : 0);

  const blocks: SummaryBlock[] = [
    {
      id: "wfh",
      title: "Working from home",
      kicker: wfhMethod === "actual" ? "Other work-related expenses · actual cost method" : "Other work-related expenses · fixed rate method",
      shown: homeDollars > 0 || figures.wfhHours > 0,
      rows:
        wfhMethod === "actual"
          ? [
              { label: "Hours logged", value: formatHours(figures.wfhHours), fold: true },
              { label: "Days logged", value: String(figures.wfhDays), fold: true },
              { label: "Electricity and gas", value: formatCents(figures.energy.cents), cents: figures.energy.cents },
              { label: "Phone", value: formatCents(figures.phone.cents), cents: figures.phone.cents },
              { label: "Internet", value: formatCents(figures.internet.cents), cents: figures.internet.cents },
              { label: "Stationery and consumables", value: formatCents(figures.stationery.cents), cents: figures.stationery.cents },
              { label: "Enter", value: formatWholeDollars(homeDollars), strong: true },
            ]
          : [
              { label: "Hours logged", value: formatHours(figures.wfhHours), fold: true },
              { label: "Days logged", value: String(figures.wfhDays), fold: true },
              { label: "Fixed rate", value: formatCents(year.wfhCentsPerHour), fold: true },
              { label: "Exact amount", value: formatCents(figures.wfhCents), cents: figures.wfhCents },
              { label: "Enter", value: formatWholeDollars(figures.wfhDollars), strong: true },
            ],
      notes:
        wfhMethod === "actual"
          ? [
              "The hours are the record that you worked from home. The claim is the work share of each bill.",
              "A 4-week pattern is a common way to set the phone and internet percentage. Rent, mortgage interest, and council rates on your own home are not included.",
            ]
          : [
              "If myTax asks for hours, enter the hours and use its calculation. If it asks for dollars, enter the whole-dollar amount. Do not enter both.",
              `The ${formatCents(year.wfhCentsPerHour)} rate already includes ${FIXED_RATE_INCLUDES.map((item) => item.toLowerCase()).join(", ")}. Do not claim those again.`,
              ...(figures.runningHeld > 0 ? ["Bills for energy, phone, internet, or stationery are saved and left out while the fixed rate is selected."] : []),
            ],
    },
    {
      id: "clothing",
      title: "Clothing, laundry and dry-cleaning",
      kicker: "Work-related clothing expenses",
      shown: clothing.dollars > 0,
      rows: [
        { label: "Clothing and uniforms", value: formatCents(figures.clothing.cents), cents: figures.clothing.cents },
        { label: "Laundry", value: formatCents(figures.laundry.cents), cents: figures.laundry.cents },
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
      shown: figures.donations.wholeDollars > 0,
      rows: [
        { label: "Confirmed DGR gifts", value: formatCents(figures.donations.cents), cents: figures.donations.cents },
        { label: "Enter", value: formatWholeDollars(figures.donations.wholeDollars), strong: true },
      ],
      notes: ["Gifts must be $2 or more to an organisation with DGR status."],
    },
    {
      id: "education",
      title: "Self-education expenses",
      kicker: "Current work only",
      shown: figures.selfEducation.wholeDollars > 0,
      rows: [
        { label: "Claimable self-education", value: formatCents(figures.selfEducation.cents), cents: figures.selfEducation.cents },
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
      kicker: wfhMethod === "actual" ? "Other work-related expenses, excluding home running costs" : "Other work-related expenses, excluding the fixed rate",
      shown: otherWork.dollars > 0,
      rows: [
        { label: "Tools and equipment, $300 or under", value: formatCents(figures.tools.cents), cents: figures.tools.cents },
        { label: "Subscriptions", value: formatCents(figures.subscriptions.cents), cents: figures.subscriptions.cents },
        { label: "Other", value: formatCents(figures.other.cents), cents: figures.other.cents },
        { label: "Enter", value: formatWholeDollars(otherWork.dollars), strong: true },
      ],
      notes: [
        "This is separate from the working-from-home figure. If myTax has one box for all other work-related expenses, add the two whole-dollar amounts together.",
      ],
    },
    ...(logbook && (hasCarTrips || hasCarCosts || data.logbook?.started)
      ? [
          {
            id: "car",
            title: "Work-related car expenses",
            kicker: "Logbook",
            shown: hasCarTrips || hasCarCosts,
            rows: [
              { label: "Kilometres logged", value: `${formatKilometres(logbook.workKilometres)} km`, fold: true },
              ...(logbook.totalKilometres !== null
                ? [{ label: "Odometer", value: `${formatKilometres(logbook.totalKilometres)} km` }]
                : []),
              { label: "Rate", value: logbook.percent === null ? "Not ready" : `${new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format(logbook.percent)}% work use`, fold: true },
              { label: "Running costs", value: formatCents(logbook.costCents), cents: logbook.costCents },
              { label: "Enter", value: formatWholeDollars(figures.car.wholeDollars), strong: true },
            ],
            notes: [
              logbook.note,
              "Trips record kilometres. They do not add a dollar amount. The claim is that percentage of the fuel and other running costs.",
              ...(logbook.percent !== null
                ? [`Mark the car under Assets. Decline in value uses this ${new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format(logbook.percent)}%, so you do not type it twice.`]
                : []),
              "Trips between home and your regular workplace are not included.",
            ],
          },
        ]
      : hasCarTrips
        ? [
            {
              id: "car",
              title: "Work-related car expenses",
              kicker: "Cents per kilometre",
              shown: true,
              rows: [
                { label: "Kilometres logged", value: `${formatKilometres(car.kilometres)} km`, fold: true },
                ...(Math.abs(car.claimKilometres - car.kilometres) > 0.001
                  ? [{ label: "Kilometres that count", value: `${formatKilometres(car.claimKilometres)} km` }]
                  : []),
                { label: "Rate", value: `${formatCents(year.carCentsPerKm)} per km`, fold: true },
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
      id: "travel",
      title: "Work-related travel",
      kicker: "Nights away",
      shown: figures.travel.wholeDollars > 0,
      rows: [
        { label: "Flights, accommodation, and meals", value: formatCents(figures.travel.cents), cents: figures.travel.cents },
        { label: "Enter", value: formatWholeDollars(figures.travel.wholeDollars), strong: true },
      ],
      notes: ["This is for nights away. It is not the drive to your usual workplace, and it is not a meal allowance."],
    },
    {
      id: "tax",
      title: "Cost of managing tax affairs",
      kicker: "Tax agent fees",
      shown: figures.taxAffairs.wholeDollars > 0,
      rows: [
        ...(figures.litigationCents > 0
          ? [{ label: "Litigation", value: formatCents(figures.litigationCents), cents: figures.litigationCents }]
          : []),
        ...(figures.taxOtherCents > 0
          ? [{ label: "Other costs of managing tax affairs", value: formatCents(figures.taxOtherCents), cents: figures.taxOtherCents }]
          : []),
        { label: "Enter", value: formatWholeDollars(figures.taxAffairs.wholeDollars), strong: true },
      ],
      notes: ["Claim the fee in the year you paid it. ATO interest is not included. The ATO prefills that."],
    },
  ];

  if ((options.assets ?? []).length > 0) {
    blocks.push({
      id: "decline",
      title: "Decline in value",
      kicker: "Depreciating assets · days held divided by 365",
      shown: decline.dollars > 0,
      rows: [
        ...decline.rows.map((row) => ({ label: row.description, value: formatCents(row.claimCents), cents: row.claimCents })),
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
      shown: rental.dollars > 0 || rental.incomeCents > 0,
      rows: [
        { label: "Rent received", value: formatCents(rental.incomeCents), cents: rental.incomeCents },
        { label: "Rent received, whole dollars", value: formatWholeDollars(rental.incomeDollars), cents: rental.incomeCents === 0 ? 0 : undefined },
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
    ...(carMethod === "cents" && hasCarCosts
      ? ["Fuel and other car costs stay out while cents per kilometre is selected. The rate already covers them."]
      : []),
    ...(logbook && !logbook.ready && hasCarCosts
      ? ["Car costs stay out until the logbook has 12 weeks and a closing odometer."]
      : []),
    ...(logbookCars.length > 0 && carMethod !== "logbook"
      ? ["Decline in value of the car stays out. The cents per kilometre rate already includes it."]
      : []),
    ...(logbookCars.length > 0 && logbook && !logbook.ready
      ? ["Decline in value of the car stays out until the logbook is ready."]
      : []),
    ...figures.unsure.map(
      (expense) => `Not sure yet · ${formatLongDate(expense.date)} · ${expense.description} · ${formatMoneySafe(expense)}`,
    ),
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
    wfhMethod,
    totalDollars,
    blocks,
    exclusionTitle: "Not in the total",
    exclusionRows,
    footnotes,
    figures,
  };

  return { ...model, text: plainText(year, model, clothing.dollars, otherWork.dollars, homeDollars) };
}

/** Names the myTax categories that have nothing to enter. */
export function nothingEnteredLine(blocks: readonly SummaryBlock[]): string {
  const names = blocks.filter((block) => !block.shown).map((block) => block.title);
  if (names.length === 0) return "";
  if (names.length === 1) return `Nothing entered for ${names[0]}.`;
  return `Nothing entered for ${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}.`;
}

function enterPart(model: Omit<SummaryModel, "text">, id: string, label: string): string {
  const block = model.blocks.find((item) => item.id === id);
  if (!block?.shown) return "";
  const enter = block.rows.find((row) => row.label === "Enter")?.value;
  if (!enter || enter === formatWholeDollars(0)) return "";
  return `${label} ${enter}`;
}

function plainText(
  year: FinancialYear,
  model: Omit<SummaryModel, "text">,
  clothingDollars: number,
  otherWorkDollars: number,
  homeDollars: number,
): string {
  const lines = [
    "TAXTRACK FIGURES FOR MYTAX",
    `Income year ${year.label} (${formatPeriod(year.start, year.end)})`,
    "Whole dollars. Cents disregarded, not rounded.",
    "Estimates from your TaxTrack records. Check them before you lodge.",
    "",
  ];

  for (const block of model.blocks) {
    if (!block.shown) continue;
    lines.push(block.title.toUpperCase());
    lines.push(block.kicker);
    for (const row of block.rows) {
      if (row.cents === 0) continue;
      lines.push(`${row.label}: ${row.value}`);
    }
    for (const note of block.notes) lines.push(note);
    lines.push("");
  }

  const hidden = nothingEnteredLine(model.blocks);
  if (hidden) lines.push(hidden);
  lines.push(`TOTAL TO ENTER: ${formatWholeDollars(model.totalDollars)}`);
  const parts = [
    homeDollars > 0 ? `Working from home ${formatWholeDollars(homeDollars)}` : "",
    clothingDollars > 0 ? `clothing and laundry ${formatWholeDollars(clothingDollars)}` : "",
    model.figures.selfEducation.wholeDollars > 0 ? `self-education ${formatWholeDollars(model.figures.selfEducation.wholeDollars)}` : "",
    otherWorkDollars > 0 ? `other work expenses ${formatWholeDollars(otherWorkDollars)}` : "",
    model.figures.donations.wholeDollars > 0 ? `donations ${formatWholeDollars(model.figures.donations.wholeDollars)}` : "",
    model.figures.taxAffairs.wholeDollars > 0 ? `tax affairs ${formatWholeDollars(model.figures.taxAffairs.wholeDollars)}` : "",
    enterPart(model, "car", "car expenses"),
    enterPart(model, "decline", "decline in value"),
    enterPart(model, "rentals", "rental properties"),
  ].filter((part) => part.length > 0);
  if (parts.length > 0) lines.push(`${parts.join(" + ")}.`);
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
