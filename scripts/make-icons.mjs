import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2];
const root = process.cwd();
const logoOut = path.join(root, "public", "taxtrack-logo.png");
const iconDir = path.join(root, "public", "icons");
const appDir = path.join(root, "app");

const image = sharp(source).ensureAlpha();
const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

function pixel(x, y) {
  const index = (y * width + x) * channels;
  return [data[index], data[index + 1], data[index + 2], data[index + 3]];
}

const background = pixel(1, 1);
function differs(x, y) {
  const [r, g, b] = pixel(x, y);
  return Math.abs(r - background[0]) + Math.abs(g - background[1]) + Math.abs(b - background[2]) > 28;
}

const columns = [];
for (let x = 0; x < width; x += 1) {
  let ink = false;
  for (let y = 0; y < height; y += 8) {
    if (differs(x, y)) {
      ink = true;
      break;
    }
  }
  columns.push(ink);
}

const runs = [];
let start = null;
for (let x = 0; x < columns.length; x += 1) {
  if (columns[x] && start === null) start = x;
  if (!columns[x] && start !== null) {
    runs.push([start, x - 1]);
    start = null;
  }
}
if (start !== null) runs.push([start, width - 1]);

const mark = runs[0] ?? [0, Math.min(width, height) - 1];
const pad = Math.round(height * 0.08);
const left = Math.max(0, mark[0] - pad);
const right = Math.min(width - 1, mark[1] + pad);
const cropWidth = right - left + 1;
const side = Math.max(cropWidth, height);

const markPng = await sharp(source)
  .extract({ left, top: 0, width: cropWidth, height })
  .resize({
    width: Math.round(side * 0.72),
    height: Math.round(side * 0.72),
    fit: "contain",
    background: { r: background[0], g: background[1], b: background[2], alpha: 1 },
  })
  .png()
  .toBuffer();

async function square(size) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: background[0], g: background[1], b: background[2], alpha: 1 },
    },
  })
    .composite([{ input: await sharp(markPng).resize(Math.round(size * 0.72), Math.round(size * 0.72), { fit: "contain" }).png().toBuffer(), gravity: "centre" }])
    .png()
    .toBuffer();
}

await mkdir(iconDir, { recursive: true });
await sharp(source).resize({ width: 960, withoutEnlargement: true }).png().toFile(logoOut);
await sharp(await square(32)).toFile(path.join(appDir, "icon.png"));
await sharp(await square(180)).toFile(path.join(appDir, "apple-icon.png"));
await sharp(await square(192)).toFile(path.join(iconDir, "icon-192.png"));
await sharp(await square(512)).toFile(path.join(iconDir, "icon-512.png"));

console.log(JSON.stringify({ width, height, background, runs, crop: { left, cropWidth, height } }));
