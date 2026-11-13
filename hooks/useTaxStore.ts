"use client";

import { useMemo, useSyncExternalStore } from "react";
import { yearById } from "@/lib/ato-rules";
import { financialYearIdFor, visibleFinancialYears } from "@/lib/dates";
import { backupToState, createEmptyState, mergeBackups, stateToBackup, validateBackup, type BackupFile } from "@/lib/backup";
import { createId } from "@/lib/id";
import { clearReceipts, deleteReceipt } from "@/lib/receiptStore";
import { pullAccount, uploadDevice } from "@/lib/syncRecords";
import { ACCOUNT_KEY, loadState, PENDING_KEY, saveState, STORAGE_KEY } from "@/lib/storage";
import type { AppState, DayLog, DepreciatingAsset, Expense, RentalExpense, YearId } from "@/lib/types";

interface Snapshot {
  state: AppState;
  notice: string | null;
  hydrated: boolean;
}

const serverSnapshot: Snapshot = {
  state: createEmptyState(new Date(2026, 6, 1)),
  notice: null,
  hydrated: false,
};

let clientSnapshot: Snapshot | null = null;
const listeners = new Set<() => void>();
let listening = false;

function emit() {
  for (const listener of listeners) listener();
}

function getServerSnapshot(): Snapshot {
  return serverSnapshot;
}

function getClientSnapshot(): Snapshot {
  if (!clientSnapshot) {
    const loaded = loadState();
    clientSnapshot = { state: loaded.state, notice: loaded.notice, hydrated: true };
  }
  return clientSnapshot;
}

function ensureListening() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const validated = validateBackup(JSON.parse(event.newValue) as unknown);
      if (!validated.ok) return;
      clientSnapshot = {
        state: backupToState(validated.data),
        notice: getClientSnapshot().notice,
        hydrated: true,
      };
      emit();
    } catch {
      // Ignore unreadable updates from another tab.
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureListening();
  return () => listeners.delete(listener);
}

let syncUserId: string | null = null;
let syncRun = 0;
let applyingRemote = false;
let pushTimer: number | null = null;

function noteSync(message: string) {
  const current = getClientSnapshot();
  clientSnapshot = { ...current, notice: message };
  emit();
}

function rememberOwner(userId: string) {
  window.localStorage.setItem(ACCOUNT_KEY, userId);
}

function schedulePush(userId: string) {
  window.localStorage.setItem(PENDING_KEY, userId);
  if (pushTimer !== null) window.clearTimeout(pushTimer);
  const run = syncRun;
  pushTimer = window.setTimeout(() => {
    pushTimer = null;
    if (syncUserId !== userId || syncRun !== run) return;
    void uploadDevice(getClientSnapshot().state)
      .then(() => {
        if (syncUserId === userId && window.localStorage.getItem(PENDING_KEY) === userId) window.localStorage.removeItem(PENDING_KEY);
      })
      .catch(() => {
        if (syncUserId === userId) noteSync("The account copy could not be saved. The records are still on this device and will be sent again.");
      });
  }, 700);
}

function replaceFromAccount(file: BackupFile) {
  applyingRemote = true;
  try {
    commit({ state: backupToState(file), notice: null, hydrated: true });
  } finally {
    applyingRemote = false;
  }
}

function replaceWithEmpty(userId: string) {
  applyingRemote = true;
  try {
    commit({ state: createEmptyState(), notice: null, hydrated: true });
    rememberOwner(userId);
    window.localStorage.removeItem(PENDING_KEY);
  } finally {
    applyingRemote = false;
  }
}

async function reconcile(userId: string, run: number) {
  const current = () => run === syncRun && syncUserId === userId;
  const remote = await pullAccount(current);
  if (!current()) return;
  const owner = window.localStorage.getItem(ACCOUNT_KEY);
  const pending = window.localStorage.getItem(PENDING_KEY) === userId;
  if (remote) {
    if (pending && owner === userId) {
      await uploadDevice(getClientSnapshot().state);
      if (!current()) return;
      window.localStorage.removeItem(PENDING_KEY);
      return;
    }
    replaceFromAccount(remote);
    rememberOwner(userId);
    window.localStorage.removeItem(PENDING_KEY);
    return;
  }
  if (owner && owner !== userId) {
    if (!current()) return;
    await clearReceipts();
    if (!current()) return;
    replaceWithEmpty(userId);
    return;
  }
  rememberOwner(userId);
  await uploadDevice(getClientSnapshot().state);
  if (!current()) return;
  window.localStorage.removeItem(PENDING_KEY);
}

/** Opens the account copy, then keeps later edits encrypted with the account. */
export async function startAccountSync(userId: string): Promise<void> {
  const run = ++syncRun;
  syncUserId = userId;
  try {
    await reconcile(userId, run);
  } catch {
    if (run === syncRun && syncUserId === userId) {
      noteSync("This account's records could not be opened. What is on this device was left as it is.");
    }
  }
}

export function stopAccountSync() {
  syncRun += 1;
  syncUserId = null;
  if (pushTimer !== null) {
    window.clearTimeout(pushTimer);
    pushTimer = null;
  }
}

function commit(next: Snapshot) {
  const saved = saveState(next.state);
  clientSnapshot = saved.ok ? next : { ...next, notice: saved.message };
  emit();
  if (!applyingRemote && syncUserId) schedulePush(syncUserId);
}

function readMergedState(): AppState {
  const memory = getClientSnapshot().state;
  const loaded = loadState();
  if (loaded.notice) return memory;
  return backupToState(mergeBackups(stateToBackup(loaded.state), stateToBackup(memory)));
}

function update(recipe: (state: AppState) => AppState) {
  const current = getClientSnapshot();
  commit({ ...current, hydrated: true, state: recipe(readMergedState()) });
}

function withYear(
  state: AppState,
  yearId: YearId,
  recipe: (year: AppState["years"][YearId]) => AppState["years"][YearId],
): AppState {
  return {
    ...state,
    years: {
      ...state.years,
      [yearId]: recipe(state.years[yearId]),
    },
  };
}

function createApi(snapshot: Snapshot) {
  if (!snapshot.hydrated) return { ready: false as const };
  const state = snapshot.state;
  const activeYear = visibleFinancialYears().some((year) => year.id === state.activeYear)
    ? state.activeYear
    : financialYearIdFor();
  return {
    ready: true as const,
    state,
    notice: snapshot.notice,
    year: yearById(activeYear),
    yearData: state.years[activeYear],
    dismissNotice() {
      const current = getClientSnapshot();
      clientSnapshot = { ...current, notice: null };
      emit();
    },
    setYear(yearId: YearId) {
      if (!visibleFinancialYears().some((year) => year.id === yearId)) return;
      update((current) => ({ ...current, activeYear: yearId }));
    },
    saveDay(yearId: YearId, log: DayLog) {
      update((current) =>
        withYear(current, yearId, (year) => ({
          ...year,
          dayLogs: { ...year.dayLogs, [log.date]: log },
        })),
      );
    },
    clearDay(yearId: YearId, date: string) {
      update((current) =>
        withYear(current, yearId, (year) => {
          const dayLogs = { ...year.dayLogs };
          delete dayLogs[date];
          return { ...year, dayLogs };
        }),
      );
    },
    saveExpense(yearId: YearId, expense: Expense) {
      update((current) =>
        withYear(current, yearId, (year) => {
          const next = { ...expense, id: expense.id || createId(), receiptId: expense.receiptId ?? null };
          const previous = year.expenses.find((item) => item.id === next.id);
          if (previous?.receiptId && previous.receiptId !== next.receiptId) void deleteReceipt(previous.receiptId);
          const index = year.expenses.findIndex((item) => item.id === next.id);
          const expenses = [...year.expenses];
          if (index >= 0) expenses[index] = next;
          else expenses.push(next);
          return { ...year, expenses };
        }),
      );
    },
    deleteExpense(yearId: YearId, id: string) {
      update((current) =>
        withYear(current, yearId, (year) => {
          const previous = year.expenses.find((item) => item.id === id);
          if (previous?.receiptId) void deleteReceipt(previous.receiptId);
          return { ...year, expenses: year.expenses.filter((item) => item.id !== id) };
        }),
      );
    },
    replaceAll(file: BackupFile) {
      commit({ state: backupToState(file), notice: null, hydrated: true });
    },
    mergeIn(file: BackupFile) {
      const current = getClientSnapshot();
      commit({
        state: backupToState(mergeBackups(stateToBackup(current.state), file)),
        notice: current.notice,
        hydrated: true,
      });
    },
    reset() {
      void clearReceipts();
      commit({ state: createEmptyState(), notice: null, hydrated: true });
    },
    setDefaultHours(hours: number) {
      update((current) => ({ ...current, settings: { ...current.settings, defaultWfhHours: hours } }));
    },
    setRentalProperties(enabled: boolean) {
      update((current) => ({ ...current, settings: { ...current.settings, rentalProperties: enabled } }));
    },
    addProperty(address: string) {
      const property = { id: createId(), address: address.trim() };
      update((current) => ({ ...current, properties: [...(current.properties ?? []), property] }));
      return property.id;
    },
    renameProperty(id: string, address: string) {
      update((current) => ({
        ...current,
        properties: (current.properties ?? []).map((property) => (property.id === id ? { ...property, address: address.trim() } : property)),
      }));
    },
    removeProperty(id: string) {
      update((current) => {
        const years = { ...current.years };
        for (const yearId of Object.keys(years) as YearId[]) {
          const year = years[yearId];
          years[yearId] = {
            ...year,
            rentalExpenses: (year.rentalExpenses ?? []).filter((expense) => expense.propertyId !== id),
          };
        }
        return { ...current, years, properties: (current.properties ?? []).filter((property) => property.id !== id) };
      });
    },
    saveRentalExpense(yearId: YearId, expense: RentalExpense) {
      update((current) =>
        withYear(current, yearId, (year) => {
          const next = { ...expense, id: expense.id || createId(), notes: expense.notes ?? "" };
          const rentalExpenses = [...(year.rentalExpenses ?? [])];
          const index = rentalExpenses.findIndex((item) => item.id === next.id);
          if (index >= 0) rentalExpenses[index] = next;
          else rentalExpenses.push(next);
          return { ...year, rentalExpenses };
        }),
      );
    },
    deleteRentalExpense(yearId: YearId, id: string) {
      update((current) =>
        withYear(current, yearId, (year) => ({
          ...year,
          rentalExpenses: (year.rentalExpenses ?? []).filter((expense) => expense.id !== id),
        })),
      );
    },
    saveAsset(asset: DepreciatingAsset) {
      update((current) => {
        const next = { ...asset, id: asset.id || createId(), notes: asset.notes ?? "", description: asset.description.trim() };
        const assets = [...(current.assets ?? [])];
        const index = assets.findIndex((item) => item.id === next.id);
        if (index >= 0) assets[index] = next;
        else assets.push(next);
        return { ...current, assets };
      });
    },
    deleteAsset(id: string) {
      update((current) => ({ ...current, assets: (current.assets ?? []).filter((asset) => asset.id !== id) }));
    },
  };
}

export function useTaxStore() {
  const snapshot = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  return useMemo(() => createApi(snapshot), [snapshot]);
}
