import { assetTreatment, yearById } from "../lib/ato-rules";
import { backupFilename, mergeBackups, validateBackup } from "../lib/backup";
import { calculateClaims } from "../lib/calculations";
import { calendarCells, isWeekend, monthsOf } from "../lib/dates";
import { holidayOn } from "../lib/holidays";
import { deductionCents, portionCents, toCents } from "../lib/money";
import { buildSummary } from "../lib/summary";
import type { Expense, YearData } from "../lib/types";

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
    receiptId: null,
    ...partial,
  };
}

const claims = calculateClaims({
  centsPerHour: 70,
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

console.log("TaxTrack checks passed");
