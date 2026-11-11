"use client";

import { useRef, useState } from "react";
import { Check, Download, Trash2, Upload } from "lucide-react";
import {
  BACKUP_FILE_LIMIT,
  describeBackup,
  downloadBackup,
  validateBackup,
  type BackupFile,
} from "@/lib/backup";
import { installReceiptImages } from "@/lib/receiptStore";
import { formatTimestamp, isValidHours } from "@/lib/dates";
import type { AppState } from "@/lib/types";
import { buttonClass, cx, Field, inputClass, Modal } from "@/components/ui";

export function BackupModal({
  state,
  notice,
  onClose,
  onMerge,
  onReplace,
  onReset,
  onDefaultHours,
  onDismissNotice,
}: {
  state: AppState;
  notice: string | null;
  onClose: () => void;
  onMerge: (file: BackupFile) => void;
  onReplace: (file: BackupFile) => void;
  onReset: () => void;
  onDefaultHours: (hours: number) => void;
  onDismissNotice: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [ready, setReady] = useState<BackupFile | null>(null);
  const [replaceArmed, setReplaceArmed] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const [hours, setHours] = useState(String(state.settings.defaultWfhHours));
  const counts = describeBackup({
    app: "taxtrack",
    version: 1,
    activeYear: state.activeYear,
    settings: state.settings,
    years: {
      "2025-26": { dayLogs: Object.values(state.years["2025-26"].dayLogs), expenses: state.years["2025-26"].expenses },
      "2026-27": { dayLogs: Object.values(state.years["2026-27"].dayLogs), expenses: state.years["2026-27"].expenses },
    },
  });

  async function exportData() {
    try {
      const filename = await downloadBackup(state);
      setStatus(`Downloaded ${filename}`);
      setErrors([]);
    } catch {
      setErrors(["The backup could not include a receipt photo. Try the export again."]);
    }
  }

  function onFile(file: File | undefined) {
    setReady(null);
    setReplaceArmed(false);
    setErrors([]);
    setStatus(null);
    if (!file) return;
    if (file.size > BACKUP_FILE_LIMIT) {
      setErrors(["That file is larger than 12 MB."]);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(reader.result ?? ""));
      } catch {
        setErrors(["That file is not valid JSON."]);
        return;
      }
      const result = validateBackup(parsed);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setReady(result.data);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function applyImport(mode: "merge" | "replace", file: BackupFile) {
    try {
      const installed = await installReceiptImages(file, mode);
      if (mode === "merge") {
        onMerge(installed);
        setStatus("Merged the file into this browser. Matching days and expense ids were updated from the file.");
      } else {
        onReplace(installed);
        setStatus("Replaced the records in this browser with the file.");
        setReplaceArmed(false);
      }
      setReady(null);
      setErrors([]);
    } catch {
      setErrors(["The receipt photos in that file could not be stored in this browser."]);
    }
  }

  function saveHours() {
    const parsed = Number(hours);
    if (!isValidHours(parsed) || parsed <= 0) {
      setErrors(["Use a standard day from 0.1 to 24 hours, in tenths. 7.6 is the usual full day."]);
      return;
    }
    onDefaultHours(parsed);
    setErrors([]);
    setStatus("Standard day updated. Days you already saved stay as they are.");
  }

  const incoming = ready ? describeBackup(ready) : null;

  return (
    <Modal title="Data and backup" onClose={onClose} wide>
      <p className="text-sm leading-6 text-fog">
        Records and receipt photos stay in this browser. Export a JSON file to move them to another phone or computer, then import them there.
      </p>
      {notice ? (
        <p className="mt-3 rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
          {notice}
          <button type="button" className="ml-2 underline" onClick={onDismissNotice}>
            Dismiss
          </button>
        </p>
      ) : null}

      <div className="mt-4 rounded-2xl border border-line p-3">
        <p className="text-sm">
          On this device: {counts.days} day logs · {counts.expenses} expenses
        </p>
        <button type="button" className={cx(buttonClass.primary, "mt-3 w-full")} onClick={exportData}>
          <Download size={16} /> Export data
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-line p-3">
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          onChange={(event) => onFile(event.target.files?.[0])}
        />
        <button type="button" className={cx(buttonClass.ghost, "w-full")} onClick={() => fileRef.current?.click()}>
          <Upload size={16} /> Import data
        </button>
        {incoming ? (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              File has {incoming.days} day logs and {incoming.expenses} expenses.
              {incoming.exportedAt ? ` Exported ${formatTimestamp(incoming.exportedAt)}.` : " No export timestamp."}
            </p>
            <button
              type="button"
              className={cx(buttonClass.primary, "w-full")}
              onClick={() => {
                if (!ready) return;
                void applyImport("merge", ready);
              }}
            >
              Merge into this browser
            </button>
            {replaceArmed ? (
              <button
                type="button"
                className={cx(buttonClass.danger, "w-full")}
                onClick={() => {
                  if (!ready) return;
                  void applyImport("replace", ready);
                }}
              >
                Yes, replace everything in this browser
              </button>
            ) : (
              <button type="button" className={cx(buttonClass.danger, "w-full")} onClick={() => setReplaceArmed(true)}>
                Replace everything
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <Field label="Standard working-from-home day" hint="Used the next time you turn on the standard-day switch.">
          <div className="flex gap-2">
            <input className={inputClass} type="number" min={0.1} max={24} step={0.1} value={hours} onChange={(event) => setHours(event.target.value)} />
            <button type="button" className={buttonClass.ghost} onClick={saveHours}>
              Save
            </button>
          </div>
        </Field>
      </div>

      {errors.length > 0 ? (
        <ul className="mt-4 space-y-1 text-sm text-rose">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
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
