/** Longest edge kept after the first pass. Receipt text stays readable at this size. */
const FIRST_EDGE = 1600;
const FIRST_QUALITY = 0.72;

/** Data-URL length cap. About 280 KB of JPEG, small enough to keep with a backup. */
export const MAX_RECEIPT_CHARS = 380_000;

const RECEIPT_IMAGE = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/;

export function isReceiptImage(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_RECEIPT_CHARS && RECEIPT_IMAGE.test(value);
}

export async function compressReceipt(file: File): Promise<string> {
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
