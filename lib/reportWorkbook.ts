import * as XLSX from "xlsx";
import type { FinancialYear } from "@/lib/ato-rules";
import { buildYearReport } from "@/lib/report";
import type { DepreciatingAsset, RentalProperty, YearData } from "@/lib/types";

function sheet(rows: (string | number)[][], widths: number[]) {
  const book = XLSX.utils.aoa_to_sheet(rows);
  book["!cols"] = widths.map((wch) => ({ wch }));
  return book;
}

/** Real .xlsx workbook. Section banners match the StaxQ finance export. */
export function buildTaxTrackWorkbook(
  year: FinancialYear,
  data: YearData,
  prepared = new Date(),
  options: { rentals?: boolean; properties?: readonly RentalProperty[]; assets?: readonly DepreciatingAsset[] } = {},
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
    ["Total to enter (AUD)", report.totalDollars],
    [],
    ["WFH hours", report.wfhHours],
    ["WFH days", report.wfhDays],
    ["WFH method", "Fixed rate"],
    ["WFH rate (AUD per hour)", report.rateAud],
    ["Est. WFH deduction (AUD)", wfhEnter],
    [],
    ["Disclaimer", report.footnotes[report.footnotes.length - 1] ?? ""],
  ];
  XLSX.utils.book_append_sheet(wb, sheet(summaryRows, [42, 88]), "Summary");

  const wfhRows: (string | number)[][] = [
    ["=== TAXTRACK ==="],
    ["=== WORK FROM HOME — Fixed rate ==="],
    ["Date", "Mode", "Hours", "Counts toward the fixed rate", "Notes"],
    ...(report.hourRows.length > 0
      ? report.hourRows.map((row) => [row.date, row.mode, row.hours, row.counts, row.notes])
      : [["No days logged", "", "", "", ""]]),
    [],
    ["Hours that count", report.hourNote],
    ["FY total claim (AUD)", wfhEnter],
  ];
  XLSX.utils.book_append_sheet(wb, sheet(wfhRows, [16, 22, 12, 32, 48]), "WFH hours");

  const expenseRows: (string | number)[][] = [
    ["=== TAXTRACK ==="],
    ["=== EXPENSES ==="],
    ["Date", "Description", "Merchant", "Category", "Payment", "Amount (AUD)", "Work use %", "Claim (AUD)", "In the total", "Notes"],
    ...(report.expenseRows.length > 0
      ? report.expenseRows.map((row) => [
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
        ])
      : [["No expenses logged"]]),
  ];
  XLSX.utils.book_append_sheet(wb, sheet(expenseRows, [14, 28, 20, 28, 12, 16, 14, 14, 42, 36]), "Expenses");

  if (report.assetRows) {
    const assetSheet: (string | number)[][] = [
      ["=== TAXTRACK ==="],
      ["=== DECLINE IN VALUE ==="],
      ["Description", "First used", "Method", "Effective life (years)", "Work use %", "Days held", "Claim (AUD)"],
      ...report.assetRows.map((row) => [row.description, row.purchased, row.method, row.life, row.workUse, row.daysHeld, row.claimAud]),
    ];
    XLSX.utils.book_append_sheet(wb, sheet(assetSheet, [28, 14, 22, 22, 14, 12, 16]), "Decline in value");
  }

  if (report.rentalRows) {
    const rentalSheet: (string | number)[][] = [
      ["=== TAXTRACK ==="],
      ["=== RENTAL PROPERTIES ==="],
      ["Date", "Address", "Category", "Description", "Amount (AUD)", "Notes"],
      ...(report.rentalRows.length > 0
        ? report.rentalRows.map((row) => [row.date, row.address, row.category, row.description, row.amountAud, row.notes])
        : [["No rent or rental expenses logged"]]),
    ];
    XLSX.utils.book_append_sheet(wb, sheet(rentalSheet, [14, 36, 28, 28, 16, 36]), "Rentals");
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
