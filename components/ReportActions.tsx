"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import type { FinancialYear } from "@/lib/ato-rules";
import { downloadTaxTrackPdf, downloadTaxTrackWorkbook } from "@/lib/generateTaxTrackReport";
import { receiptExportPaths } from "@/lib/receiptFilename";
import { attachReceiptImages } from "@/lib/receiptStore";
import type { DayLog, DepreciatingAsset, Expense, RentalExpense, RentalProperty } from "@/lib/types";
import { buttonClass } from "@/components/ui";

export function ReportActions({
  year,
  logs,
  expenses,
  rentals,
  assets = [],
}: {
  year: FinancialYear;
  logs: DayLog[];
  expenses: Expense[];
  rentals?: { enabled: boolean; properties: RentalProperty[]; expenses: RentalExpense[] };
  assets?: readonly DepreciatingAsset[];
}) {
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);
  const [summaryOnly, setSummaryOnly] = useState(false);

  async function run(kind: "excel" | "pdf") {
    if (busy) return;
    setBusy(kind);
    try {
      const imaged = await attachReceiptImages(expenses);
      const data = {
        dayLogs: Object.fromEntries(logs.map((log) => [log.date, log])),
        expenses: imaged,
        rentalExpenses: rentals?.enabled ? rentals.expenses : [],
      };
      const options = {
        rentals: rentals?.enabled === true,
        properties: rentals?.properties ?? [],
        assets,
        receiptPaths: receiptExportPaths(imaged),
        omitDailyLog: kind === "pdf" && summaryOnly,
      };
      if (kind === "excel") await downloadTaxTrackWorkbook(year, data, options);
      else await downloadTaxTrackPdf(year, data, options);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="col-span-2 w-full">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={`${buttonClass.ghost} w-full`} disabled={busy !== null} onClick={() => void run("excel")}>
          <FileSpreadsheet size={16} /> {busy === "excel" ? "Preparing Excel…" : "Excel report"}
        </button>
        <button type="button" className={`${buttonClass.ghost} w-full`} disabled={busy !== null} onClick={() => void run("pdf")}>
          <FileText size={16} /> {busy === "pdf" ? "Preparing PDF…" : "PDF report"}
        </button>
      </div>
      <label className="mt-2 flex items-center justify-center gap-2 text-center text-xs text-fog md:justify-start md:text-left">
        <input type="checkbox" className="size-4 accent-mint" checked={summaryOnly} onChange={(event) => setSummaryOnly(event.target.checked)} />
        Summary only — omit daily WFH log
      </label>
    </div>
  );
}
