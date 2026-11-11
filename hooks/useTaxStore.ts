"use client";

import { useMemo, useSyncExternalStore } from "react";
import { yearById } from "@/lib/ato-rules";
import { backupToState, createEmptyState, mergeBackups, stateToBackup, validateBackup, type BackupFile } from "@/lib/backup";
import { createId } from "@/lib/id";
import { clearReceipts, deleteReceipt } from "@/lib/receiptStore";
import { loadState, saveState, STORAGE_KEY } from "@/lib/storage";
import type { AppState, DayLog, Expense, YearId } from "@/lib/types";

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

function commit(next: Snapshot) {
  const saved = saveState(next.state);
  clientSnapshot = saved.ok ? next : { ...next, notice: saved.message };
  emit();
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
  return {
    ready: true as const,
    state,
    notice: snapshot.notice,
    year: yearById(state.activeYear),
    yearData: state.years[state.activeYear],
    dismissNotice() {
      const current = getClientSnapshot();
      clientSnapshot = { ...current, notice: null };
      emit();
    },
    setYear(yearId: YearId) {
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
      update((current) => ({ ...current, settings: { defaultWfhHours: hours } }));
    },
  };
}

export function useTaxStore() {
  const snapshot = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  return useMemo(() => createApi(snapshot), [snapshot]);
}
