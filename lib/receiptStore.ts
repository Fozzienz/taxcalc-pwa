import { FINANCIAL_YEARS } from "@/lib/ato-rules";
import type { BackupFile } from "@/lib/backup";
import { createId } from "@/lib/id";

const DB_NAME = "taxtrack";
const STORE = "receipts";

const cache = new Map<string, string | null>();
const pending = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open receipt storage."));
  });
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = work(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Receipt storage failed."));
        transaction.oncomplete = () => db.close();
        transaction.onerror = () => db.close();
      }),
  );
}

export async function putReceipt(id: string, dataUrl: string): Promise<void> {
  await run("readwrite", (store) => store.put(dataUrl, id));
  cache.set(id, dataUrl);
  emit();
}

export async function getReceipt(id: string): Promise<string | null> {
  const value = await run<string | undefined>("readonly", (store) => store.get(id));
  return value ?? null;
}

export async function deleteReceipt(id: string): Promise<void> {
  await run("readwrite", (store) => store.delete(id));
  cache.set(id, null);
  emit();
}

export async function clearReceipts(): Promise<void> {
  await run("readwrite", (store) => store.clear());
  cache.clear();
  emit();
}

export function subscribeReceipts(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readCachedReceipt(id: string | null): string | null {
  if (!id) return null;
  if (cache.has(id)) return cache.get(id) ?? null;
  if (!pending.has(id)) {
    pending.add(id);
    void getReceipt(id)
      .then((value) => {
        cache.set(id, value);
      })
      .catch(() => {
        cache.set(id, null);
      })
      .finally(() => {
        pending.delete(id);
        emit();
      });
  }
  return null;
}

/** Writes photo bytes into this browser, then returns a backup safe to keep in localStorage. */
export async function installReceiptImages(file: BackupFile, mode: "merge" | "replace"): Promise<BackupFile> {
  if (mode === "replace") await clearReceipts();
  const years = {} as BackupFile["years"];
  for (const year of FINANCIAL_YEARS) {
    const expenses = [];
    for (const expense of file.years[year.id].expenses) {
      const { receiptImage, ...rest } = expense;
      let receiptId = rest.receiptId;
      if (receiptImage) {
        receiptId = receiptId ?? createId();
        await putReceipt(receiptId, receiptImage);
      }
      expenses.push({ ...rest, receiptId });
    }
    years[year.id] = { dayLogs: file.years[year.id].dayLogs, expenses, rentalExpenses: file.years[year.id].rentalExpenses ?? [] };
  }
  return { ...file, years };
}

/** Adds the stored JPEG to an export so the file can move to another device. */
export async function withReceiptImages(file: BackupFile): Promise<BackupFile> {
  const years = {} as BackupFile["years"];
  for (const year of FINANCIAL_YEARS) {
    const expenses = [];
    for (const expense of file.years[year.id].expenses) {
      if (!expense.receiptId) {
        expenses.push(expense);
        continue;
      }
      const receiptImage = await getReceipt(expense.receiptId);
      expenses.push(receiptImage ? { ...expense, receiptImage } : expense);
    }
    years[year.id] = { dayLogs: file.years[year.id].dayLogs, expenses, rentalExpenses: file.years[year.id].rentalExpenses ?? [] };
  }
  return { ...file, years };
}
