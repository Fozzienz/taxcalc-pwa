"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import type { FinancialYear } from "@/lib/ato-rules";
import { downloadTaxTrackPdf, downloadTaxTrackWorkbook } from "@/lib/generateTaxTrackReport";
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
  const data = {
    dayLogs: Object.fromEntries(logs.map((log) => [log.date, log])),
    expenses,
    rentalExpenses: rentals?.enabled ? rentals.expenses : [],
  };
  const options = { rentals: rentals?.enabled === true, properties: rentals?.properties ?? [], assets };

  async function run(kind: "excel" | "pdf") {
    if (busy) return;
    setBusy(kind);
    try {
      if (kind === "excel") await downloadTaxTrackWorkbook(year, data, options);
      else await downloadTaxTrackPdf(year, data, options);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button type="button" className={buttonClass.ghost} disabled={busy !== null} onClick={() => void run("excel")}>
        <FileSpreadsheet size={16} /> {busy === "excel" ? "Preparing Excel…" : "Excel report"}
      </button>
      <button type="button" className={buttonClass.ghost} disabled={busy !== null} onClick={() => void run("pdf")}>
        <FileText size={16} /> {busy === "pdf" ? "Preparing PDF…" : "PDF report"}
      </button>
    </>
  );
}
