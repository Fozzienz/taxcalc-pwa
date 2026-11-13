import { assetTreatment, yearById } from "../lib/ato-rules";
import { backupFilename, mergeBackups, validateBackup } from "../lib/backup";
import { calculateClaims } from "../lib/calculations";
import { calendarCells, financialYearIdFor, isWeekend, monthsOf, visibleFinancialYears } from "../lib/dates";
import { holidayOn } from "../lib/holidays";
import { deductionCents, portionCents, toCents } from "../lib/money";
import { buildSummary } from "../lib/summary";
import { buildCsvReport } from "../lib/report";
import { buildTaxTrackWorkbook } from "../lib/reportWorkbook";
import { parseChangelog, readChangelog } from "../lib/changelog";
import { summariseRentals } from "../lib/rentals";
import { depreciationSchedule } from "../lib/depreciation";
import { summariseCar } from "../lib/car";
import { createUserVaultBundle, decryptJson, encryptJson, rewrapVaultForNewPassword, unlockVaultWithPassword, unlockVaultWithRecoveryKey } from "../lib/crypto/vaultCrypto";
import * as XLSX from "xlsx";
import type { DepreciatingAsset, Expense, YearData } from "../lib/types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const wfhCents = deductionCents(8430, 70);
assert(wfhCents === 59010, `843 hours should be 59010 cents, got ${wfhCents}`);
assert(Math.floor(wfhCents / 100) === 590, "ATO example should disregard cents to $590");
assert(deductionCents(76, 70) === 532, "7.6 hours should be $5.32");
assert(Math.floor(deductionCents(76, 70) / 100) === 5, "7.6 hours should enter as $5");

assert(assetTreatment({ category: "tools", amount: 300, isEquipment: false }) === "immediate", "$300 is an immediate write-off");
assert(assetTreatment({ category: "tools", amount: 300.01, isEquipment: false }) === "depreciating", "$300.01 is depreciating");
assert(assetTreatment({ category: "tools", amount: 400, isEquipment: false }) === "depreciating", "partial work use does not change the $300 test");
assert(portionCents(250, 80) === 20000, "80% of $250 is $200");
assert(assetTreatment({ category: "self-education", amount: 1800, isEquipment: false }) === "not-an-asset", "course fees are not assets");
assert(assetTreatment({ category: "self-education", amount: 1800, isEquipment: true }) === "depreciating", "marked equipment over $300 depreciates");

assert(holidayOn("2026-05-04")?.name === "Labour Day" && holidayOn("2026-05-04")?.scope === "qld", "2026 Labour Day");
assert(holidayOn("2026-08-12")?.name.includes("Ekka") && holidayOn("2026-08-12")?.detail?.includes("Brisbane"), "2026 Ekka");
assert(holidayOn("2026-10-05")?.name === "King's Birthday", "2026 King's Birthday");
assert(holidayOn("2025-10-06")?.scope === "qld", "2025 King's Birthday");
assert(holidayOn("2027-10-04")?.name === "King's Birthday", "2027 King's Birthday");
assert(holidayOn("2025-05-05")?.name === "Labour Day", "2025 Labour Day");
assert(holidayOn("2027-05-03")?.name === "Labour Day", "2027 Labour Day");
assert(holidayOn("2025-08-13")?.detail?.includes("Brisbane"), "2025 Ekka");
assert(holidayOn("2027-08-11")?.detail?.includes("Brisbane"), "2027 Ekka");
assert(holidayOn("2026-01-26")?.scope === "national", "2026 Australia Day");
assert(holidayOn("2025-01-27")?.name === "Australia Day", "2025 Australia Day observed Monday");
assert(holidayOn("2026-04-25")?.name === "Anzac Day", "2026 Anzac Day stays on Saturday");
assert(holidayOn("2027-04-26")?.name === "Anzac Day", "2027 Anzac Day observed Monday");
assert(holidayOn("2027-04-25") === undefined, "25 April 2027 is not the observed holiday");
assert(holidayOn("2028-01-01")?.scope === "national" && holidayOn("2028-01-03")?.scope === "qld", "2028 New Year Saturday gets a Monday holiday");
assert(holidayOn("2028-04-16")?.name === "Easter Sunday", "2028 Easter Sunday");
assert(holidayOn("2028-04-14")?.name === "Good Friday", "2028 Good Friday");
assert(holidayOn("2028-04-25")?.name === "Anzac Day", "2028 Anzac Day stays on Tuesday");
assert(holidayOn("2028-05-01")?.name === "Labour Day", "2028 Labour Day is the first Monday in May");
assert(visibleFinancialYears(new Date(2026, 10, 11)).every((year) => year.id !== "2027-28"), "2027-28 is hidden before it starts");
assert(visibleFinancialYears(new Date(2027, 6, 1)).some((year) => year.id === "2027-28"), "2027-28 appears on 1 July 2027");
assert(financialYearIdFor(new Date(2026, 10, 11)) === "2026-27", "November 2026 is the 2026-27 income year");
assert(financialYearIdFor(new Date(2027, 6, 1)) === "2027-28", "1 July 2027 is the 2027-28 income year");
assert(holidayOn("2026-12-24")?.partDay === true, "Christmas Eve is part-day");
assert(holidayOn("2026-12-28")?.scope === "qld", "2026 additional Boxing Day");
assert(isWeekend("2026-04-25") === true, "Anzac Day 2026 is a Saturday");
assert(isWeekend("2026-04-24") === false, "24 April 2026 is a Friday");

const july = calendarCells(2025, 6);
assert(july[0] === null && july[1]?.day === 1, "1 July 2025 is a Tuesday");
const months = monthsOf("2025-07-01", "2026-06-30");
assert(months.length === 12 && months[0].month === 6 && months[11].month === 5, "financial year has 12 months");
assert(backupFilename(new Date(2026, 10, 11, 17, 42)) === "taxtrack-backup-2026-11-11-1742.json", "backup filename");

function expense(partial: Partial<Expense> & Pick<Expense, "id" | "amount" | "category">): Expense {
  return {
    date: "2025-08-01",
    description: partial.description ?? partial.id,
    merchant: "",
    paymentMethod: "card",
    notes: "",
    dgrConfirmed: false,
    isEquipment: false,
    workUsePercent: 100,
    kilometres: null,
    vehicle: "",
    receiptId: null,
    ...partial,
  };
}

const claims = calculateClaims({
  centsPerHour: 70,
  carCentsPerKm: 88,
  dayLogs: [{ date: "2025-07-14", mode: "wfh", hours: 7.6, notes: "", receiptMarker: false }],
  expenses: [
    expense({ id: "clothes-a", amount: 10.6, category: "clothing" }),
    expense({ id: "clothes-b", amount: 10.6, category: "clothing" }),
    expense({ id: "gift", amount: 2, category: "donations", dgrConfirmed: true }),
    expense({ id: "gift-held", amount: 20, category: "donations" }),
    expense({ id: "gift-small", amount: 1.5, category: "donations", dgrConfirmed: true }),
    expense({ id: "keyboard", amount: 250, category: "tools", workUsePercent: 80 }),
    expense({ id: "monitor", amount: 649, category: "tools", description: "Office monitor" }),
  ],
});
assert(claims.wfhCents === 532 && claims.wfhDollars === 5, "single standard day");
assert(claims.clothing.cents === 2120 && claims.clothing.wholeDollars === 21, "clothing cents are summed before the dollar floor");
assert(claims.donations.cents === 200, "only the confirmed $2 gift is claimable");
assert(claims.tools.cents === 20000, "80% of the $250 keyboard");
assert(claims.depreciating.length === 1 && claims.depreciating[0].description === "Office monitor", "monitor is depreciating");
assert(claims.heldDonations.length === 1 && claims.smallDonations.length === 1, "donation holds");

const year = yearById("2025-26");
const data: YearData = {
  dayLogs: {
    "2025-07-14": { date: "2025-07-14", mode: "wfh", hours: 7.6, notes: "", receiptMarker: false },
  },
  expenses: [expense({ id: "monitor", amount: 649, category: "tools", description: "Office monitor" }), expense({ id: "gift", amount: 20, category: "donations", dgrConfirmed: true })],
};
const summary = buildSummary(year, data);
assert(summary.totalDollars === 25, `total should be WFH $5 plus donation $20, got ${summary.totalDollars}`);
assert(summary.text.includes("TOTAL TO ENTER: $25"), "summary total text");
assert(summary.text.includes("Office monitor"), "asset stays visible");
assert(summary.text.includes("Cents disregarded"), "whole dollar note");
assert(!summary.text.includes("Enter: $649"), "full asset cost is not an enter amount");

const base = validateBackup({
  app: "daybook",
  version: 1,
  activeYear: "2025-26",
  settings: { defaultWfhHours: 7.6 },
  years: {
    "2025-26": {
      dayLogs: [
        { date: "2025-07-14", mode: "wfh", hours: 7.6, notes: "", receiptMarker: false },
        { date: "2025-07-16", mode: "office", hours: 0, notes: "local only", receiptMarker: false },
      ],
      expenses: [expense({ id: "exp-1", amount: 40, category: "subscriptions", description: "Software" })],
    },
  },
});
const incoming = validateBackup({
  app: "daybook",
  version: 1,
  exportedAt: "2026-11-11T07:42:00.000Z",
  activeYear: "2025-26",
  settings: { defaultWfhHours: 7.6 },
  years: {
    "2025-26": {
      dayLogs: [
        { date: "2025-07-14", mode: "office", hours: 0, notes: "updated", receiptMarker: true },
        { date: "2025-07-15", mode: "leave", hours: 0, notes: "", receiptMarker: false },
      ],
      expenses: [
        expense({ id: "exp-1", amount: 55, category: "subscriptions", description: "Software" }),
        expense({ id: "exp-2", amount: 12, category: "laundry", description: "Washes" }),
      ],
    },
  },
});
assert(base.ok && incoming.ok, "fixtures should validate");
if (base.ok && incoming.ok) {
  assert(base.data.app === "taxtrack", "older Daybook files are read as TaxTrack");
  const merged = mergeBackups(base.data, incoming.data);
  const days = new Map(merged.years["2025-26"].dayLogs.map((log) => [log.date, log]));
  assert(days.get("2025-07-14")?.mode === "office", "merge updates the same day");
  assert(days.get("2025-07-16")?.notes === "local only", "merge keeps local-only days");
  assert(days.has("2025-07-15"), "merge adds new days");
  const expenses = new Map(merged.years["2025-26"].expenses.map((item) => [item.id, item]));
  assert(expenses.get("exp-1")?.amount === 55 && expenses.has("exp-2"), "merge updates and adds expenses");
}

assert(!validateBackup({ hello: true }).ok, "random JSON is rejected");
assert(!validateBackup({ app: "daybook", version: 1, activeYear: "2025-26", settings: { defaultWfhHours: 7.6 }, years: { "2024-25": { dayLogs: [], expenses: [] } } }).ok, "unknown year is rejected");
const outside = validateBackup({
  app: "daybook",
  version: 1,
  activeYear: "2025-26",
  settings: { defaultWfhHours: 7.6 },
  years: {
    "2025-26": {
      dayLogs: [{ date: "2025-06-30", mode: "wfh", hours: 7.6, notes: "", receiptMarker: false }],
      expenses: [],
    },
  },
});
assert(!outside.ok, "a day outside the income year is rejected");
assert(toCents(10.6) === 1060, "cents conversion");

const photo = validateBackup({
  app: "taxtrack",
  version: 1,
  activeYear: "2025-26",
  settings: { defaultWfhHours: 7.6 },
  years: {
    "2025-26": {
      dayLogs: [],
      expenses: [{ ...expense({ id: "shot", amount: 12, category: "other" }), receiptImage: "data:image/png;base64,aaaa" }],
    },
  },
});
assert(!photo.ok, "a PNG receipt is rejected");
const jpeg = validateBackup({
  app: "taxtrack",
  version: 1,
  activeYear: "2025-26",
  settings: { defaultWfhHours: 7.6 },
  years: {
    "2025-26": {
      dayLogs: [],
      expenses: [{ ...expense({ id: "shot", amount: 12, category: "other" }), receiptImage: "data:image/jpeg;base64,abcd" }],
    },
  },
});
assert(jpeg.ok && jpeg.data.years["2025-26"].expenses[0]?.receiptImage === "data:image/jpeg;base64,abcd", "a compressed JPEG is kept");
const pdf = validateBackup({
  app: "taxtrack",
  version: 1,
  activeYear: "2025-26",
  settings: { defaultWfhHours: 7.6 },
  years: {
    "2025-26": {
      dayLogs: [],
      expenses: [{ ...expense({ id: "invoice", amount: 12, category: "other" }), receiptImage: "data:application/pdf;base64,JVBERg==" }],
    },
  },
});
assert(pdf.ok && pdf.data.years["2025-26"].expenses[0]?.receiptImage?.startsWith("data:application/pdf"), "a PDF invoice is kept");
const word = validateBackup({
  app: "taxtrack",
  version: 1,
  activeYear: "2027-28",
  settings: { defaultWfhHours: 7.6 },
  years: {
    "2027-28": {
      dayLogs: [],
      expenses: [
        {
          ...expense({ id: "letter", amount: 12, category: "other", date: "2027-08-02" }),
          receiptImage: "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,UEsDBA==",
        },
      ],
    },
  },
});
assert(word.ok, "a Word invoice in 2027-28 is kept");

const reportYear = yearById("2025-26");
const reportData: YearData = {
  dayLogs: {
    "2025-07-14": { date: "2025-07-14", mode: "wfh", hours: 7.6, notes: "Client work", receiptMarker: false },
    "2025-07-15": { date: "2025-07-15", mode: "office", hours: 8, notes: "", receiptMarker: false },
  },
  expenses: [
    expense({ id: "chair", amount: 80, category: "tools", description: "Desk chair", merchant: "Officeworks", date: "2025-08-02" }),
    expense({ id: "monitor", amount: 450, category: "tools", description: "Monitor", date: "2025-08-03" }),
  ],
};
const reportSummary = buildSummary(reportYear, reportData);
const csv = buildCsvReport(reportYear, reportData, new Date("2026-11-13T09:00:00+10:00"));
assert(csv.charCodeAt(0) === 0xfeff, "the spreadsheet starts with a UTF-8 BOM");
assert(csv.includes("=== TAXTRACK ==="), "the spreadsheet names TaxTrack");
assert(csv.includes("=== WORK FROM HOME — Fixed rate ==="), "the hours section uses a banner");
assert(csv.includes("14/07/2025,Work from home,7.6,Yes,Client work"), "the spreadsheet lists the working-from-home day");
assert(csv.includes("15/07/2025,Office,8,No"), "an office day is listed and does not count");
assert(csv.includes("02/08/2025,Desk chair,Officeworks,Tools / equipment,Card,80,100,80,Yes"), "a claimable expense keeps its amount");
assert(csv.includes('03/08/2025,Monitor,,Tools / equipment,Card,450,100,0,"No - depreciating asset, not in the total"'), "a depreciating asset is excluded");
assert(csv.includes(`Total to enter,,${reportSummary.totalDollars}`), "the spreadsheet total matches the on-screen total");
assert(reportSummary.totalDollars === 85, "7.6 hours and an $80 chair enter as $85");
const prepared = new Date("2026-11-13T09:00:00+10:00");
const workbook = XLSX.read(buildTaxTrackWorkbook(reportYear, reportData, prepared));
assert(workbook.SheetNames.join("|") === "Summary|WFH hours|Expenses|Held out", "the workbook has the TaxTrack sheets");
const summarySheet = XLSX.utils.sheet_to_csv(workbook.Sheets.Summary);
const expenseSheet = XLSX.utils.sheet_to_csv(workbook.Sheets.Expenses);
assert(summarySheet.includes("TaxTrack") && summarySheet.includes(String(reportSummary.totalDollars)), "the workbook summary names TaxTrack and matches the total");
assert(expenseSheet.includes("Desk chair") && expenseSheet.includes("Monitor"), "the workbook lists both expenses");
const longReport: YearData = {
  dayLogs: reportData.dayLogs,
  expenses: Array.from({ length: 40 }, (_, index) =>
    expense({
      id: `row-${index}`,
      amount: 12,
      category: "other",
      description: `Stationery pack ${index + 1}`,
      date: "2025-09-01",
    }),
  ),
};
const longExpenses = XLSX.utils.sheet_to_csv(XLSX.read(buildTaxTrackWorkbook(reportYear, longReport, prepared)).Sheets.Expenses);
assert(longExpenses.includes("Stationery pack 1") && longExpenses.includes("Stationery pack 40"), "a long report keeps every expense row");

const rentalData: YearData = {
  dayLogs: {},
  expenses: [],
  rentalExpenses: [
    { id: "rates", propertyId: "home", date: "2025-08-01", amount: 1200.4, category: "council-rates", description: "Council rates", notes: "" },
    { id: "agent", propertyId: "home", date: "2025-09-01", amount: 80, category: "agent-fees", description: "Management", notes: "" },
    { id: "rent", propertyId: "home", date: "2025-08-15", amount: 500, category: "rent", description: "August rent", notes: "" },
  ],
};
const rentalProperties = [{ id: "home", address: "12 Example Street" }];
const hidden = buildSummary(reportYear, rentalData);
const shown = buildSummary(reportYear, rentalData, { rentals: true, properties: rentalProperties });
assert(hidden.totalDollars === 0, "rental expenses stay out of the total while the feature is off");
assert(shown.totalDollars === 1280, "rental expenses are whole dollars in the total while the feature is on");
assert(summariseRentals(rentalData.rentalExpenses ?? [], rentalProperties).cents === 128040, "rental cents are summed before the dollar floor");
assert(summariseRentals(rentalData.rentalExpenses ?? [], rentalProperties).incomeCents === 50000, "rent received stays out of the expense total");
const rentalCsv = buildCsvReport(reportYear, rentalData, prepared, { rentals: true, properties: rentalProperties });
assert(rentalCsv.includes("=== RENTAL PROPERTIES ===") && rentalCsv.includes("12 Example Street") && rentalCsv.includes("Council rates"), "the spreadsheet lists the rental property");
const rentalBook = XLSX.read(buildTaxTrackWorkbook(reportYear, rentalData, prepared, { rentals: true, properties: rentalProperties }));
assert(rentalBook.SheetNames.includes("Rentals"), "the workbook has a rentals sheet when the feature is on");
const kept = validateBackup({ app: "taxtrack", version: 1, activeYear: "2025-26", settings: { defaultWfhHours: 7.6 }, years: { "2025-26": { dayLogs: [], expenses: [] } } });
assert(kept.ok && kept.data.settings.rentalProperties === false && kept.data.properties.length === 0, "an older backup without rentals still opens");
assert(kept.ok && kept.data.assets.length === 0, "an older backup without assets still opens");

function sampleAsset(overrides: Partial<DepreciatingAsset> = {}): DepreciatingAsset {
  return {
    id: "laptop",
    description: "Laptop",
    purchased: "2025-07-01",
    cost: 2000,
    effectiveLifeYears: 4,
    workUsePercent: 100,
    method: "prime-cost",
    notes: "",
    ...overrides,
  };
}
const prime = depreciationSchedule(sampleAsset());
assert(prime[0]?.claimCents === 50000 && prime[1]?.claimCents === 50000 && prime.length === 4, "prime cost writes off $2,000 as $500 a year");
const diminishing = depreciationSchedule(sampleAsset({ method: "diminishing-value" }));
assert(diminishing[0]?.claimCents === 100000, "diminishing value is $1,000 in the first full year");
const partial = depreciationSchedule(sampleAsset({ method: "diminishing-value", purchased: "2026-01-01" }));
assert(partial[0]?.daysHeld === 181 && partial[0]?.claimCents === 49589, "1 January uses 181 days and $495.89");
assert(buildSummary(reportYear, { dayLogs: {}, expenses: [] }, { assets: [sampleAsset({ method: "diminishing-value", purchased: "2026-01-01" })] }).totalDollars === 495, "the partial-year claim drops the cents");
const immediateAsset = depreciationSchedule(sampleAsset({ cost: 300, purchased: "2025-08-01" }));
assert(immediateAsset.length === 1 && immediateAsset[0]?.claimCents === 30000, "$300 used mainly for work is an immediate deduction");
assert(depreciationSchedule(sampleAsset({ cost: 300.01 })).length > 1, "$300.01 is spread over the effective life");
assert(depreciationSchedule(sampleAsset({ cost: 200, workUsePercent: 50 })).length > 1, "50% work use does not qualify for the immediate deduction");
const half = depreciationSchedule(sampleAsset({ workUsePercent: 50 }));
assert(half[0]?.claimCents === 25000 && half[0]?.closingCents === 150000, "work use reduces the claim while the full decline reduces the value");
const declineSummary = buildSummary(reportYear, { dayLogs: {}, expenses: [] }, { assets: [sampleAsset()] });
assert(declineSummary.totalDollars === 500 && declineSummary.blocks.some((block) => block.id === "decline"), "a full-year prime-cost asset adds $500");
const declineBook = XLSX.read(buildTaxTrackWorkbook(reportYear, { dayLogs: {}, expenses: [] }, prepared, { assets: [sampleAsset()] }));
assert(declineBook.SheetNames.includes("Decline in value"), "the workbook has a decline sheet when assets exist");
assert(!workbook.SheetNames.includes("Decline in value"), "the workbook omits the decline sheet when there are no assets");
const declineCsv = buildCsvReport(reportYear, { dayLogs: {}, expenses: [] }, prepared, { assets: [sampleAsset()] });
assert(declineCsv.includes("=== DECLINE IN VALUE ===") && declineCsv.includes("Laptop"), "the spreadsheet lists the asset");

const carTrip = (id: string, kilometres: number, vehicle = "", date = "2025-08-01") =>
  expense({ id, amount: 1, category: "car", kilometres, vehicle, date, description: id });
const carSummary = summariseCar([carTrip("short", 100)], 88);
assert(carSummary.cents === 8800 && carSummary.dollars === 88, "100 km at 88 cents is $88");
const johan = summariseCar([carTrip("johan", 2514)], 88);
assert(johan.cents === 221232 && johan.dollars === 2212, "2,514 km at 88 cents enters as $2,212");
const cappedKm = summariseCar([carTrip("long", 5085)], 88);
assert(cappedKm.claimKilometres === 5000 && cappedKm.cents === 440000, "kilometres above 5,000 do not increase the claim");
const twoCars = summariseCar([carTrip("ute", 3000, "Ute"), carTrip("hatch", 3000, "Hatch")], 88);
assert(twoCars.cents === 528000, "each car has its own 5,000 km cap");
assert(summariseCar([carTrip("now", 100)], yearById("2026-27").carCentsPerKm).cents === 9100, "2026–27 uses 91 cents a kilometre");
const carOnSummary = buildSummary(reportYear, { dayLogs: {}, expenses: [carTrip("short", 100)] });
assert(carOnSummary.totalDollars === 88 && carOnSummary.blocks.some((block) => block.id === "car"), "car kilometres are in the total");
const legacyExpense = validateBackup({
  app: "taxtrack",
  version: 1,
  activeYear: "2025-26",
  settings: { defaultWfhHours: 7.6 },
  years: {
    "2025-26": {
      dayLogs: [],
      expenses: [
        {
          id: "pen",
          date: "2025-08-01",
          amount: 4,
          category: "other",
          description: "Pen",
          merchant: "",
          paymentMethod: "card",
          notes: "",
          dgrConfirmed: false,
          isEquipment: false,
          workUsePercent: 100,
          receiptId: null,
        },
      ],
    },
  },
});
assert(legacyExpense.ok && legacyExpense.data.years["2025-26"].expenses[0]?.kilometres === null, "an expense without kilometres still opens");

const changelog = parseChangelog("## [Unreleased]\n\n### Added\n\n- 2026-11-13 — Rental properties\n");
assert(changelog.releases[0]?.version === "Unreleased" && changelog.releases[0].subsections[0]?.items[0]?.date === "2026-11-13", "the changelog keeps the date on each item");
const published = readChangelog().releases.filter((release) => release.version !== "Unreleased");
assert(published.some((release) => release.version === "0.2.0"), "the published changelog has the production version");
assert(
  published.every((release) => release.subsections.every((subsection) => subsection.items.every((item) => !item.date && item.text.length < 90))),
  "published changelog bullets are short and undated",
);

checkVault()
  .then(() => console.log("TaxTrack checks passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

async function checkVault() {
  const bundle = await createUserVaultBundle("correct horse");
  assert(/^TAXTRACK(?:-[0-9A-F]{4}){6}$/.test(bundle.recoveryKey), "the recovery key has the TaxTrack shape");
  const encrypted = await encryptJson(bundle.vaultKey, { hours: 7.6 });
  assert(!encrypted.ciphertext.includes("7.6"), "synced text does not contain the hours");
  const passwordKey = await unlockVaultWithPassword("correct horse", bundle.encryptionSalt, bundle.passwordWrappedKey);
  const fromPassword = await decryptJson<{ hours: number }>(passwordKey, encrypted);
  assert(fromPassword.hours === 7.6, "the password unwraps the record");
  const rewrapped = await rewrapVaultForNewPassword(passwordKey, "new horse battery", bundle.encryptionSalt);
  const changedKey = await unlockVaultWithPassword("new horse battery", bundle.encryptionSalt, rewrapped);
  const fromChanged = await decryptJson<{ hours: number }>(changedKey, encrypted);
  assert(fromChanged.hours === 7.6, "a new password unwraps the same record");
  const recoveryKey = await unlockVaultWithRecoveryKey(bundle.recoveryKey, bundle.recoverySalt, bundle.recoveryWrappedKey);
  const fromRecovery = await decryptJson<{ hours: number }>(recoveryKey, encrypted);
  assert(fromRecovery.hours === 7.6, "the recovery key unwraps the record");
}
