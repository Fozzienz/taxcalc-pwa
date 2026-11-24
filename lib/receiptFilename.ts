import { receiptKind } from "@/lib/receiptImage";
import { categoryById, type Expense } from "@/lib/types";
import { toCents } from "@/lib/money";

const STEM_LIMIT = 80;

type NamedExpense = Expense & { receiptImage?: string };

function clean(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "");
}

function amountToken(expense: NamedExpense): string {
  if (expense.category === "car" && toCents(expense.amount) === 0 && expense.kilometres) {
    const kilometres = String(expense.kilometres).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
    return `${kilometres}km`;
  }
  return (toCents(expense.amount) / 100).toFixed(2);
}

function middle(expense: NamedExpense): string {
  const supplier = clean(expense.merchant);
  const description = clean(expense.description);
  const category = clean(categoryById(expense.category).label);
  if (!supplier && !description) {
    const shortId = (expense.receiptId ?? "file").replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || "file";
    return category ? `${category}_Receipt_${shortId}` : `Receipt_${shortId}`;
  }
  if (!supplier) return description || category || "Receipt";
  if (!description) return `${supplier}_${category || "Receipt"}`;
  return `${supplier}_${description}`;
}

function stemFor(expense: NamedExpense): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(expense.date) ? expense.date : "undated";
  const amount = amountToken(expense);
  const body = middle(expense);
  const room = STEM_LIMIT - date.length - amount.length - 2;
  const trimmed = body.slice(0, Math.max(1, room)).replace(/[_-]+$/g, "");
  return `${date}_${trimmed}_${amount}`;
}

export function receiptExtension(dataUrl: string): string {
  const kind = receiptKind(dataUrl);
  if (kind === "pdf") return "pdf";
  if (kind === "docx") return "docx";
  if (kind === "doc") return "doc";
  return "jpg";
}

/** Same path for the zip, the Excel link, and a later restore. Keyed by receipt id. */
export function receiptExportPaths(expenses: readonly NamedExpense[]): Record<string, string> {
  const ready = expenses.filter((expense) => expense.receiptId && expense.receiptImage && receiptKind(expense.receiptImage));
  const groups = new Map<string, NamedExpense[]>();
  for (const expense of ready) {
    const stem = stemFor(expense);
    const list = groups.get(stem) ?? [];
    list.push(expense);
    groups.set(stem, list);
  }
  const paths: Record<string, string> = {};
  for (const [stem, list] of groups) {
    list.sort((a, b) => (a.receiptId ?? "").localeCompare(b.receiptId ?? ""));
    list.forEach((expense, index) => {
      const suffix = index === 0 ? "" : `-${index + 1}`;
      const ext = receiptExtension(expense.receiptImage ?? "");
      const room = STEM_LIMIT - suffix.length;
      const base = stem.length <= room ? stem : `${stem.slice(0, room).replace(/[_-]+$/g, "")}`;
      paths[expense.receiptId ?? ""] = `receipts/${base}${suffix}.${ext}`;
    });
  }
  return paths;
}
