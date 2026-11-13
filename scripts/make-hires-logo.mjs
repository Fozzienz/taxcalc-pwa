import sharp from "sharp";

const logoIn = process.argv[2];
const iconIn = process.argv[3];

function dist(r, g, b, bg) {
  return Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
}

async function raw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function keyed(data, width, height, recolor) {
  const bg = [data[0], data[1], data[2]];
  const out = Buffer.alloc(width * height * 4);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const d = dist(r, g, b, bg);
      let alpha = 0;
      if (d > 28) alpha = d >= 58 ? 255 : Math.round(((d - 28) / 30) * 255);
      if (alpha < 12) continue;
      const cover = alpha / 255;
      let fr = Math.max(0, Math.min(255, Math.round((r - bg[0] * (1 - cover)) / cover)));
      let fg = Math.max(0, Math.min(255, Math.round((g - bg[1] * (1 - cover)) / cover)));
      let fb = Math.max(0, Math.min(255, Math.round((b - bg[2] * (1 - cover)) / cover)));
      if (recolor && fr > 214 && fg > 214 && fb > 214 && fr - fb < 28) {
        fr = recolor[0];
        fg = recolor[1];
        fb = recolor[2];
      }
      const o = i;
      out[o] = fr;
      out[o + 1] = fg;
      out[o + 2] = fb;
      out[o + 3] = alpha;
      if (alpha > 40) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 24;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const cropW = Math.min(width - left, maxX - minX + 1 + pad * 2);
  const cropH = Math.min(height - top, maxY - minY + 1 + pad * 2);
  return { out, width, height, left, top, cropW, cropH };
}

async function writeCrop(file, keyedImage) {
  await sharp(keyedImage.out, { raw: { width: keyedImage.width, height: keyedImage.height, channels: 4 } })
    .extract({ left: keyedImage.left, top: keyedImage.top, width: keyedImage.cropW, height: keyedImage.cropH })
    .png()
    .toFile(file);
  return { width: keyedImage.cropW, height: keyedImage.cropH };
}

const logo = await raw(logoIn);
const dark = keyed(logo.data, logo.width, logo.height, null);
const light = keyed(logo.data, logo.width, logo.height, [15, 23, 42]);
const darkSize = await writeCrop("public/taxtrack-logo-dark.png", dark);
const lightSize = await writeCrop("public/taxtrack-logo-light.png", light);
await sharp("public/taxtrack-logo-dark.png").png().toFile("public/taxtrack-logo.png");

const icon = await raw(iconIn);
const mark = keyed(icon.data, icon.width, icon.height, null);
await writeCrop("public/icons/mark.png", mark);
const navy = { r: 6, g: 19, b: 28, alpha: 1 };
async function iconPng(size, file) {
  const markPng = await sharp("public/icons/mark.png")
    .resize(Math.round(size * 0.72), Math.round(size * 0.72), { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: navy } })
    .composite([{ input: markPng, gravity: "centre" }])
    .png()
    .toFile(file);
}
await iconPng(512, "public/icons/icon-512.png");
await iconPng(192, "public/icons/icon-192.png");
await iconPng(180, "app/apple-icon.png");
await iconPng(512, "app/icon.png");
console.log(JSON.stringify({ darkSize, lightSize }));
