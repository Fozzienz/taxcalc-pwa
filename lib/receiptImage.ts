/** Longest edge kept after the first pass. Receipt text stays readable at this size. */
const FIRST_EDGE = 1600;
const FIRST_QUALITY = 0.72;

/** Data-URL length cap for a compressed photo. About 280 KB of JPEG. */
export const MAX_RECEIPT_CHARS = 380_000;

/** Data-URL length cap for a PDF or Word invoice. About 6 MB of the original file. */
export const MAX_DOCUMENT_CHARS = 8_000_000;

const JPEG = "image/jpeg";
const PDF = "application/pdf";
const DOC = "application/msword";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const RECEIPT_FILE = new RegExp(
  `^data:(${JPEG}|${PDF}|${DOC}|${DOCX.replace(/\./g, "\\.")});base64,[A-Za-z0-9+/]+=*$`,
);

export type ReceiptKind = "image" | "pdf" | "doc" | "docx";

export function isReceiptFile(value: unknown): value is string {
  if (typeof value !== "string" || !RECEIPT_FILE.test(value)) return false;
  const limit = value.startsWith(`data:${JPEG}`) ? MAX_RECEIPT_CHARS : MAX_DOCUMENT_CHARS;
  return value.length <= limit;
}

/** Older name kept for the JPEG check. Documents use isReceiptFile. */
export function isReceiptImage(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`data:${JPEG};base64,`) && isReceiptFile(value);
}

export function receiptKind(value: string): ReceiptKind | null {
  if (value.startsWith(`data:${JPEG};`)) return "image";
  if (value.startsWith(`data:${PDF};`)) return "pdf";
  if (value.startsWith(`data:${DOCX};`)) return "docx";
  if (value.startsWith(`data:${DOC};`)) return "doc";
  return null;
}

export function receiptDownloadName(value: string): string {
  const kind = receiptKind(value);
  if (kind === "pdf") return "invoice.pdf";
  if (kind === "docx") return "invoice.docx";
  if (kind === "doc") return "invoice.doc";
  return "receipt.jpg";
}

/** Visible name for a stored file. Photos stay photos. PDF and Word are both an invoice. */
export function receiptLabel(value: string): string {
  return receiptKind(value) === "image" ? "Photo" : "Invoice";
}

export async function prepareReceipt(file: File): Promise<string> {
  const kind = fileKind(file);
  if (!kind) throw new Error("Use a photo, PDF, or Word document (.doc or .docx).");
  if (kind === "image") return compressReceipt(file);
  if (file.size > 6_000_000) throw new Error("That document is over 6 MB. Save a smaller copy, or attach a photo.");
  const mime = kind === "pdf" ? PDF : kind === "docx" ? DOCX : DOC;
  const dataUrl = withMime(await readAsDataUrl(file), mime);
  if (!isReceiptFile(dataUrl)) throw new Error("That document could not be stored.");
  return dataUrl;
}

async function compressReceipt(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a photo of the receipt. JPEG and PNG work best.");
  }
  if (file.size > 20_000_000) {
    throw new Error("That photo is over 20 MB. Take a closer picture of the receipt.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This browser could not read that photo. Use a JPEG or PNG.");
  }
  try {
    const attempts = [
      { edge: FIRST_EDGE, quality: FIRST_QUALITY },
      { edge: 1400, quality: 0.64 },
      { edge: 1200, quality: 0.58 },
    ];
    for (const attempt of attempts) {
      const encoded = renderJpeg(bitmap, attempt.edge, attempt.quality);
      if (encoded.length <= MAX_RECEIPT_CHARS) return encoded;
    }
    throw new Error("That photo is still too large after compression. Crop closer to the receipt and try again.");
  } finally {
    bitmap.close();
  }
}

function fileKind(file: File): ReceiptKind | null {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic|bmp)$/.test(name)) return "image";
  if (file.type === PDF || name.endsWith(".pdf")) return "pdf";
  if (file.type === DOCX || name.endsWith(".docx")) return "docx";
  if (file.type === DOC || name.endsWith(".doc")) return "doc";
  return null;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("This browser could not read that file."));
    reader.readAsDataURL(file);
  });
}

function withMime(dataUrl: string, mime: string): string {
  const comma = dataUrl.indexOf(",");
  const payload = (comma >= 0 ? dataUrl.slice(comma + 1) : "").replace(/\s/g, "");
  return `data:${mime};base64,${payload}`;
}

function renderJpeg(bitmap: ImageBitmap, edge: number, quality: number): string {
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the photo.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}
