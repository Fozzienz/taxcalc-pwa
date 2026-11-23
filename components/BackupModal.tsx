"use client";

import { useState } from "react";
import { Check, Download, Trash2 } from "lucide-react";
import { downloadBackup } from "@/lib/backup";
import { visibleFinancialYears } from "@/lib/dates";
import { yearById } from "@/lib/ato-rules";
import type { AppState, YearId } from "@/lib/types";
import { ReportActions } from "@/components/ReportActions";
import { buttonClass, cx, Modal } from "@/components/ui";

export function BackupModal({
  state,
  notice,
  onClose,
  onReset,
  onDismissNotice,
}: {
  state: AppState;
  notice: string | null;
  onClose: () => void;
  onReset: () => void;
  onDismissNotice: () => void;
}) {
  const years = visibleFinancialYears();
  const [yearId, setYearId] = useState<YearId>(years.some((year) => year.id === state.activeYear) ? state.activeYear : years[0].id);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const year = yearById(yearId);
  const data = state.years[yearId];
  const rentalsOn = state.settings.rentalProperties === true;

  async function exportData() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const filename = await downloadBackup(state, yearId);
      setStatus(`Downloaded ${filename}`);
    } catch {
      setError("The backup could not be built. Try the export again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Data and backup" onClose={onClose} wide>
      <p className="text-sm leading-6 text-fog">
        Signing in opens the same encrypted records on another device. This zip is the copy you keep for the year you choose: the records, the Excel workbook, the PDF, and each receipt or invoice.
      </p>
      {notice ? (
        <p className="mt-3 rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
          {notice}
          <button type="button" className="ml-2 underline" onClick={onDismissNotice}>
            Dismiss
          </button>
        </p>
      ) : null}

      <label className="mt-4 block text-sm">
        <span className="mb-1.5 block text-fog">Income year</span>
        <select
          className="min-h-11 w-full rounded-xl border border-line bg-ink px-3 text-paper"
          value={yearId}
          onChange={(event) => setYearId(event.target.value as YearId)}
        >
          {years.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 rounded-2xl border border-line p-3">
        <p className="text-sm">
          {year.label}: {Object.keys(data.dayLogs).length} day logs · {data.expenses.length} expenses
        </p>
        <button type="button" className={cx(buttonClass.primary, "mt-3 w-full")} disabled={busy} onClick={() => void exportData()}>
          <Download size={16} /> {busy ? "Preparing backup…" : `Export ${year.label} (.zip)`}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-line p-3">
        <p className="text-sm font-medium">Accountant report for {year.label}</p>
        <p className="mt-1 text-xs leading-5 text-fog">Excel downloads a workbook. The PDF is the printout, with the TaxTrack name and logo. The zip includes both.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ReportActions
            year={year}
            logs={Object.values(data.dayLogs)}
            expenses={data.expenses}
            rentals={{
              enabled: rentalsOn,
              properties: state.properties ?? [],
              expenses: data.rentalExpenses ?? [],
            }}
            assets={state.assets ?? []}
          />
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-rose">{error}</p> : null}
      {status ? (
        <p className="mt-4 flex items-start gap-2 text-sm text-mint" aria-live="polite">
          <Check size={16} className="mt-0.5 shrink-0" /> {status}
        </p>
      ) : null}

      <div className="mt-6 border-t border-line pt-4">
        {resetArmed ? (
          <button type="button" className={cx(buttonClass.danger, "w-full")} onClick={onReset}>
            Yes, delete everything in this browser
          </button>
        ) : (
          <button type="button" className={cx(buttonClass.ghost, "w-full")} onClick={() => setResetArmed(true)}>
            <Trash2 size={16} /> Clear this browser
          </button>
        )}
      </div>
    </Modal>
  );
}
