import * as XLSX from "xlsx";
import type { FinancialYear } from "@/lib/ato-rules";
import { formatKilometres } from "@/lib/car";
import { buildYearReport } from "@/lib/report";
import type { DepreciatingAsset, RentalProperty, YearData } from "@/lib/types";

function sheet(rows: (string | number)[][], widths: number[]) {
  const book = XLSX.utils.aoa_to_sheet(rows);
  book["!cols"] = widths.map((wch) => ({ wch }));
  linkReceiptColumn(book);
  return book;
}

function linkReceiptColumn(book: XLSX.WorkSheet) {
  const ref = book["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  for (let column = range.s.c; column <= range.e.c; column += 1) {
    for (let row = range.s.r; row <= range.e.r; row += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = book[address];
      if (!cell || typeof cell.v !== "string" || !cell.v.startsWith("receipts/")) continue;
      cell.l = { Target: cell.v, Tooltip: "Open the receipt in the zip" };
    }
  }
}

/** Real .xlsx workbook. The daily sheet keeps every logged day. */
export function buildTaxTrackWorkbook(
  year: FinancialYear,
  data: YearData,
  prepared = new Date(),
  options: { rentals?: boolean; properties?: readonly RentalProperty[]; assets?: readonly DepreciatingAsset[]; receiptPaths?: Record<string, string> } = {},
): Uint8Array {
  const report = buildYearReport(year, data, prepared, options);
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: `TaxTrack ${report.yearLabel}`,
    Author: "TaxTrack",
    Subject: "Income year record",
    CreatedDate: prepared,
  };

  const wfhEnter = report.summaryRows.find((row) => row.item === "Working from home")?.enterDollars ?? 0;
  const summaryRows: (string | number)[][] = [
    ["=== TAXTRACK ==="],
    ["=== EOFY SUMMARY ==="],
    ["Product", "TaxTrack"],
    ["Income year", report.yearLabel],
    ["Period", report.period],
    ["Prepared", report.prepared],
    [],
    ["Item", "Whole dollars to enter"],
    ...report.summaryRows.map((row) => [row.item, row.enterDollars]),
    ...(report.emptyNote ? [["Nothing entered", report.emptyNote]] : []),
    ["Total to enter (AUD)", report.totalDollars],
    [],
    ["WFH hours", report.wfhHours],
    ["WFH days", report.wfhDays],
    ["WFH method", report.wfhMethodLabel],
    ["WFH rate (AUD per hour)", report.rateAud],
    ["Est. WFH deduction (AUD)", wfhEnter],
    [],
    ["Records", report.footnotes.find((line) => line.startsWith("Keep this report")) ?? ""],
    ["Disclaimer", report.footnotes[report.footnotes.length - 1] ?? ""],
  ];
  XLSX.utils.book_append_sheet(wb, sheet(summaryRows, [42, 88]), "Summary");

  const monthly: (string | number)[][] = [
    ["=== TAXTRACK ==="],
    ["=== WFH MONTHLY ==="],
    ["Month", "WFH days", "WFH hours", report.wfhMethodLabel === "Actual costs" ? "Claim" : "Exact amount"],
    ...report.monthRows.map((row) => [row.month, row.days, row.hours, row.exactLabel || "See the bills"]),
    [],
    ["Hours that count", report.hourNote],
    ["FY total claim (AUD)", wfhEnter],
  ];
  XLSX.utils.book_append_sheet(wb, sheet(monthly, [18, 14, 14, 24]), "WFH Monthly");

  const daily: (string | number)[][] = [
    ["=== TAXTRACK ==="],
    ["=== WFH DAILY LOG ==="],
    ["Date", "Mode", "Hours", report.wfhMethodLabel === "Actual costs" ? "Worked from home" : "Counts toward the fixed rate", "Notes"],
    ...(report.hourRows.length > 0
      ? report.hourRows.map((row) => [row.date, row.mode, row.hours, row.counts, row.notes])
      : [["No days logged", "", 0, "", ""]]),
  ];
  XLSX.utils.book_append_sheet(wb, sheet(daily, [16, 22, 12, 32, 48]), "WFH Daily Log");

  const expenseRows: (string | number)[][] = [
    ["=== TAXTRACK ==="],
    ["=== EXPENSES ==="],
    ["Date", "Supplier", "Description", "Category", "Full cost (AUD)", "Work use %", "Claim (AUD)", "Receipt", "Notes"],
    ...(report.expenseRows.length > 0
      ? report.expenseRows.map((row) => [
          row.date,
          row.merchant,
          row.description,
          row.category,
          row.amountAud,
          row.workUse,
          row.claimAud,
          row.receiptPath || row.receiptStatus,
          row.notes,
        ])
      : [["No expenses logged"]]),
  ];
  XLSX.utils.book_append_sheet(wb, sheet(expenseRows, [14, 22, 28, 28, 16, 14, 14, 42, 36]), "Expenses");

  if (report.assetRows) {
    const assetSheet: (string | number)[][] = [
      ["=== TAXTRACK ==="],
      ["=== ASSETS & DEPRECIATION ==="],
      ["Description", "First used", "Cost", "Effective life (years)", "Method", "Work use %", "Days held", "Decline in value (AUD)", "Receipt"],
      ...report.assetRows.map((row) => [row.description, row.purchased, row.costLabel, row.life, row.method, row.workUse, row.daysHeld, row.claimAud, row.receiptStatus]),
    ];
    XLSX.utils.book_append_sheet(wb, sheet(assetSheet, [28, 14, 14, 22, 22, 14, 12, 22, 16]), "Assets & Depreciation");
  }

  if (report.mileageRows.length > 0) {
    const mileage: (string | number)[][] = [
      ["=== TAXTRACK ==="],
      ["=== MILEAGE ==="],
      ["Date", "Purpose", "Vehicle", "Kilometres", "Rate", "Claim (AUD)", "Receipt"],
      ...report.mileageRows.map((row) => [row.date, row.purpose, row.vehicle, formatKilometres(row.kilometres), row.rateLabel, row.claimAud, row.receiptPath || row.receiptStatus]),
    ];
    XLSX.utils.book_append_sheet(wb, sheet(mileage, [14, 28, 16, 14, 18, 14, 42]), "Mileage");
  }

  if (report.rentalRows) {
    const rentalSheet: (string | number)[][] = [
      ["=== TAXTRACK ==="],
      ["=== RENTAL PROPERTIES ==="],
      ["Date", "Address", "Category", "Description", "Amount (AUD)", "Receipt", "Notes"],
      ...(report.rentalRows.length > 0
        ? report.rentalRows.map((row) => [row.date, row.address, row.category, row.description, row.amountAud, row.receiptStatus, row.notes])
        : [["No rent or rental expenses logged"]]),
    ];
    XLSX.utils.book_append_sheet(wb, sheet(rentalSheet, [14, 36, 28, 28, 16, 16, 36]), "Rentals");
  }

  const heldRows: (string | number)[][] = [
    ["=== TAXTRACK ==="],
    ["=== NOT IN THE TOTAL ==="],
    ["Item"],
    ...report.exclusions.map((line) => [line]),
  ];
  XLSX.utils.book_append_sheet(wb, sheet(heldRows, [110]), "Held out");

  const written = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer | Uint8Array | number[];
  if (written instanceof Uint8Array) return written;
  return new Uint8Array(written);
}
