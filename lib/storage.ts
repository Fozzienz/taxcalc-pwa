import { backupToState, stateToBackup, validateBackup, type BackupFile } from "@/lib/backup";
import { createEmptyState } from "@/lib/backup";
import type { AppState } from "@/lib/types";

export const STORAGE_KEY = "taxtrack.v1";
const LEGACY_KEY = "daybook.v1";
const CORRUPT_KEY = "taxtrack.v1.corrupt";

export function loadState(): { state: AppState; notice: string | null } {
  if (typeof window === "undefined") return { state: createEmptyState(), notice: null };
  const current = window.localStorage.getItem(STORAGE_KEY);
  const raw = current ?? window.localStorage.getItem(LEGACY_KEY);
  if (!raw) return { state: createEmptyState(), notice: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = validateBackup(parsed);
    if (!result.ok) {
      window.localStorage.setItem(CORRUPT_KEY, raw);
      return {
        state: createEmptyState(),
        notice: "Saved records in this browser could not be read. They were kept aside and TaxTrack started fresh.",
      };
    }
    const state = backupToState(result.data);
    if (!current) {
      const saved = saveState(state);
      if (saved.ok) window.localStorage.removeItem(LEGACY_KEY);
    }
    return { state, notice: null };
  } catch {
    window.localStorage.setItem(CORRUPT_KEY, raw);
    return {
      state: createEmptyState(),
      notice: "Saved records in this browser could not be read. They were kept aside and TaxTrack started fresh.",
    };
  }
}

export function saveState(state: AppState): { ok: true } | { ok: false; message: string } {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToBackup(state)));
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "This browser blocked saving. Free some site data, or export a backup before you continue.",
    };
  }
}

export function storedBackup(state: AppState): BackupFile {
  return stateToBackup(state);
}
