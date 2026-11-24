import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { FINANCIAL_YEARS } from "@/lib/ato-rules";
import type { BackupFile } from "@/lib/backup";
import { receiptExportPaths } from "@/lib/receiptFilename";

const JSON_NAME = "taxtrack.json";

const README = `TaxTrack backup for one income year.

taxtrack.json is that year's records.
The Excel workbook and the PDF are the reports for the same year.
receipts/ holds each photo, PDF, or Word invoice from that year.
Those filenames match the Receipt column in the Excel report.

Signing in opens the same encrypted records on another device. This zip is the copy you keep.
`;

export function backupToZipBytes(file: BackupFile, extras: Record<string, Uint8Array> = {}): Uint8Array {
  const packed: Record<string, Uint8Array> = {
    "README.txt": strToU8(README),
    ...extras,
  };
  const copy = structuredClone(file);
  const paths = receiptExportPaths(FINANCIAL_YEARS.flatMap((year) => file.years[year.id].expenses));
  for (const year of FINANCIAL_YEARS) {
    copy.years[year.id].expenses = file.years[year.id].expenses.map((expense) => {
      const { receiptImage, ...rest } = expense;
      const receiptFile = rest.receiptId ? paths[rest.receiptId] : undefined;
      if (receiptImage && receiptFile) packed[receiptFile] = dataUrlToBytes(receiptImage);
      return receiptFile ? { ...rest, receiptFile } : rest;
    });
  }
  packed[JSON_NAME] = strToU8(JSON.stringify(copy));
  return zipSync(packed, { level: 6 });
}

export function backupFromZipBytes(bytes: Uint8Array): unknown {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("That zip could not be opened.");
  }
  const json = files[JSON_NAME];
  if (!json) throw new Error("That zip does not contain a TaxTrack backup.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(json));
  } catch {
    throw new Error("The backup inside that zip is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("The backup inside that zip could not be read.");
  const record = parsed as { years?: Record<string, { expenses?: Array<Record<string, unknown>> }> };
  for (const year of Object.values(record.years ?? {})) {
    for (const expense of year.expenses ?? []) {
      const id = expense.receiptId;
      if (typeof id !== "string" || expense.receiptImage) continue;
      const named = typeof expense.receiptFile === "string" ? expense.receiptFile.replace(/^\/+/, "") : "";
      const match = named && files[named] ? named : Object.keys(files).find((name) => name.startsWith(`receipts/${id}.`));
      if (!match) continue;
      const mime = mimeFor(match);
      if (!mime) continue;
      expense.receiptImage = bytesToDataUrl(files[match], mime);
    }
  }
  return parsed;
}

function mimeFor(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  return null;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const payload = dataUrl.slice(dataUrl.indexOf(",") + 1).replace(/\s/g, "");
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = "";
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}
