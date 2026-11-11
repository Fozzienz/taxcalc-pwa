import sharp from "sharp";

const source = "public/taxtrack-logo.png";
const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
const bg = [data[0], data[1], data[2]];
const taxLeft = 100;
const taxRight = 178;

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function alphaFor(r, g, b) {
  const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
  if (dist <= 16) return 0;
  if (dist >= 52) return 255;
  return Math.round(((dist - 16) / 36) * 255);
}

function keyed(text) {
  const out = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const src = (y * width + x) * channels;
      const dst = (y * width + x) * 4;
      const r = data[src];
      const g = data[src + 1];
      const b = data[src + 2];
      const alpha = alphaFor(r, g, b);
      if (x >= taxLeft && x <= taxRight) {
        out[dst] = text[0];
        out[dst + 1] = text[1];
        out[dst + 2] = text[2];
        out[dst + 3] = alpha;
        continue;
      }
      if (alpha === 0) continue;
      const cover = alpha / 255;
      out[dst] = clamp((r - bg[0] * (1 - cover)) / cover);
      out[dst + 1] = clamp((g - bg[1] * (1 - cover)) / cover);
      out[dst + 2] = clamp((b - bg[2] * (1 - cover)) / cover);
      out[dst + 3] = alpha;
    }
  }
  return out;
}

async function writeLogo(name, text) {
  await sharp(keyed(text), { raw: { width, height, channels: 4 } }).png().toFile(name);
}

async function proof(logo, background, name) {
  const plate = await sharp({
    create: { width, height, channels: 4, background },
  })
    .composite([{ input: logo }])
    .png()
    .toBuffer();
  await sharp(plate).resize({ width: 628 }).png().toFile(name);
}

await writeLogo("public/taxtrack-logo-light.png", [15, 23, 42]);
await writeLogo("public/taxtrack-logo-dark.png", [248, 250, 252]);
await proof("public/taxtrack-logo-light.png", { r: 248, g: 250, b: 252, alpha: 1 }, process.env.TEMP + "/taxtrack-logo-light-proof.png");
await proof("public/taxtrack-logo-dark.png", { r: 7, g: 12, b: 24, alpha: 1 }, process.env.TEMP + "/taxtrack-logo-dark-proof.png");
console.log("wrote transparent logos");
