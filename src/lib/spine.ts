import "server-only";
import sharp from "sharp";

/* Generated spines: colours measured from the poster, brightness and shape of the title logo. Same method as scripts/fetch-sample-art.mjs. */
const hex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const lum = (c: number[]) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const sat = (c: number[]) => Math.max(...c) - Math.min(...c);

export async function spineColours(poster: Buffer) {
  const { data } = await sharp(poster).resize(24, 36, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 3) {
    const k = [data[i], data[i + 1], data[i + 2]].map((v) => v >> 5).join(",");
    const b = buckets.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2]; buckets.set(k, b);
  }
  const common = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 8).map((b) => [b.r / b.n, b.g / b.n, b.b / b.n]);
  const dark = common.reduce((a, c) => (lum(c) < lum(a) ? c : a));
  const vivid = common.reduce((a, c) => (sat(c) * 2 + lum(c) / 3 > sat(a) * 2 + lum(a) / 3 ? c : a));
  return { bg: hex(dark.map((v) => v * 0.55)), accent: hex(vivid) };
}

export async function logoInfo(logo: Buffer) {
  const { data, info } = await sharp(logo).resize(120, 120, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) { sum += lum([data[i], data[i + 1], data[i + 2]]); n++; }
  return { dark: n ? sum / n < 95 : false, ratio: +(info.width / info.height).toFixed(2) };
}
