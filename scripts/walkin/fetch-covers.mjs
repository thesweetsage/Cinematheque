// Fetches real VHS covers for the walk-in: the sample titles' posters plus well-known films from 1975-1999,
// from TMDB (w342), into covers/ (git-ignored: artwork is never committed). Needs TMDB_API_KEY in the environment.
// Usage (from scripts/walkin): TMDB_API_KEY=… node fetch-covers.mjs [count]
import fs from "node:fs/promises";
import path from "node:path";

const KEY = process.env.TMDB_API_KEY;
if (!KEY) { console.error("TMDB_API_KEY is missing."); process.exit(1); }
const WANT = Number(process.argv[2] || 140);
const root = path.dirname(new URL(import.meta.url).pathname);
const repo = path.join(root, "../..");
const api = async (p, q = {}) => {
  const r = await fetch(`https://api.themoviedb.org/3${p}?${new URLSearchParams({ ...q, api_key: KEY })}`);
  if (!r.ok) throw new Error(`TMDB ${p}: ${r.status}`);
  return r.json();
};

const seen = new Set(), list = [];
const add = (kind, id, title, year, poster) => {
  if (!poster || seen.has(`${kind}:${id}`)) return;
  seen.add(`${kind}:${id}`);
  list.push({ kind, id, title, year, poster });
};

// 1. The store's own sample titles first.
const titles = JSON.parse(await fs.readFile(path.join(repo, "src/data/sample-titles.json"), "utf8"));
const art = JSON.parse(await fs.readFile(path.join(repo, "src/data/art.json"), "utf8"));
for (const t of titles) {
  const id = art[t.id]?.tmdbId;
  if (!id) continue;
  const kind = t.kind === "series" ? "tv" : "movie";
  const d = await api(`/${kind}/${id}`).catch(() => null);
  if (d) add(kind, id, d.title ?? d.name, t.y, d.poster_path);
}
// 2. Fill the shelves with well-known films of the video store era.
for (let page = 1; list.length < WANT && page <= 12; page++) {
  const { results } = await api("/discover/movie", {
    sort_by: "vote_count.desc", "primary_release_date.gte": "1975-01-01", "primary_release_date.lte": "1999-12-31", include_adult: "false", page: String(page),
  });
  for (const r of results) add("movie", r.id, r.title, Number(r.release_date?.slice(0, 4)), r.poster_path);
}

await fs.mkdir(path.join(root, "covers"), { recursive: true });
const out = [];
for (const c of list.slice(0, WANT)) {
  const file = `${c.kind}-${c.id}.jpg`;
  const dest = path.join(root, "covers", file);
  try { await fs.access(dest); } catch {
    const r = await fetch(`https://image.tmdb.org/t/p/w342${c.poster}`);
    if (!r.ok) continue;
    await fs.writeFile(dest, Buffer.from(await r.arrayBuffer()));
  }
  out.push({ file, title: c.title, year: c.year });
}
await fs.writeFile(path.join(root, "covers/covers.json"), JSON.stringify(out, null, 1));
console.log(`${out.length} covers in covers/`);
