// Fetches posters and title logos for the sample titles from TMDB and measures spine colours.
// Usage: put TMDB_API_KEY in .env.local, then `npm run art`.
// Images go to public/art/ (git-ignored); colours go to src/data/art.json (committed).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import sharp from "sharp";

const KEY = process.env.TMDB_API_KEY;
if (!KEY) { console.error("TMDB_API_KEY is missing. Add it to .env.local."); process.exit(1); }
const titles = JSON.parse(await readFile("src/data/sample-titles.json", "utf8"));
const outFile = "src/data/art.json";
const art = existsSync(outFile) ? JSON.parse(await readFile(outFile, "utf8")) : {};
await mkdir("public/art/posters", { recursive: true });
await mkdir("public/art/logos", { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return r; if (r.status === 404) return null; } catch {}
    await sleep(1500 * (i + 1));
  }
  throw new Error("gave up on " + url.replace(KEY, "***"));
}
const api = async (path, q) => (await get(`https://api.themoviedb.org/3${path}?${new URLSearchParams({ ...q, api_key: KEY })}`)).json();
const image = async (size, p) => Buffer.from(await (await get(`https://image.tmdb.org/t/p/${size}${p}`)).arrayBuffer());
const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

// Spine colours: background = darkest common colour, accent = most vivid common colour.
async function spineColours(buf) {
  const { data } = await sharp(buf).resize(24, 36, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 3) {
    const key = [data[i], data[i + 1], data[i + 2]].map((v) => v >> 5).join(",");
    const b = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2]; buckets.set(key, b);
  }
  const common = [...buckets.values()].sort((a, b) => b.n - a.n).slice(0, 8).map((b) => [b.r / b.n, b.g / b.n, b.b / b.n]);
  const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const sat = (c) => Math.max(...c) - Math.min(...c);
  const dark = common.reduce((a, c) => (lum(c) < lum(a) ? c : a));
  const vivid = common.reduce((a, c) => (sat(c) * 2 + lum(c) / 3 > sat(a) * 2 + lum(a) / 3 ? c : a));
  return { bg: hex(dark.map((v) => v * 0.55)), accent: hex(vivid) };
}
async function logoInfo(buf) {
  const { data, info } = await sharp(buf).resize(120, 120, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let sum = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) { sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; n++; }
  return { logoDark: n ? sum / n < 95 : false, logoRatio: +(info.width / info.height).toFixed(2) };
}

for (const t of titles) {
  if (art[t.id] && existsSync(`public/art/posters/${t.id}.jpg`)) continue;
  const kind = t.kind === "series" ? "tv" : "movie";
  const yearKey = kind === "tv" ? "first_air_date_year" : "year";
  let hit = (await api(`/search/${kind}`, { query: t.t, [yearKey]: t.y })).results?.[0];
  hit ??= (await api(`/search/${kind}`, { query: t.t })).results?.[0];
  if (!hit) { console.warn("no TMDB match:", t.t); continue; }
  const rec = { tmdbId: hit.id };
  if (hit.poster_path) {
    const buf = await image("w342", hit.poster_path);
    await writeFile(`public/art/posters/${t.id}.jpg`, buf);
    Object.assign(rec, await spineColours(buf));
  }
  const imgs = await api(`/${kind}/${hit.id}/images`, { include_image_language: "en,null" });
  const logo = (imgs.logos || []).find((l) => l.file_path.endsWith(".png"));
  if (logo) {
    const buf = await image("w300", logo.file_path);
    await writeFile(`public/art/logos/${t.id}.png`, buf);
    Object.assign(rec, { logo: true }, await logoInfo(buf));
  }
  const back = (imgs.backdrops || [])[0];
  if (back) { await mkdir("public/art/backdrops", { recursive: true }); await writeFile(`public/art/backdrops/${t.id}.jpg`, await image("w780", back.file_path)); rec.backdrop = true; }
  art[t.id] = rec;
  console.log("ok", t.t);
  await writeFile(outFile, JSON.stringify(art, null, 1));
}
console.log(`${Object.keys(art).length} titles with art`);
