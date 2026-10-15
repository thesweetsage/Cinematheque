import "server-only";
import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "../catalog";
import { saveOffShelf } from "../importTitle";
import { getSetting, setSetting } from "../settings";
import { db } from "../supabase";
import { discover, genreIds, keywordId, related, type Candidate, type TmdbKind } from "../tmdb";
import { buildProfile, loadTaste, type Profile, type Seed } from "./profile";
import { claudeDeepCuts, canSuggest } from "./claude";

/*
 * The recommendations run (nightly, and on demand from the Membership card):
 * 1. rebuild the taste profile,
 * 2. gather candidates: TMDB recommendations + similar for the profile's seed titles, and Discover on the top genres and keywords,
 * 3. drop anything watched, on the shelves, or thumbed down / dismissed,
 * 4. score by taste match, split into Popular Picks and Deep Cuts, keep the best 12 of each,
 * 5. once a week, ask Claude for 10 deep cuts with reasons, kept only if TMDB finds them,
 * 6. save the titles (off the shelves) and the recommendations; thumbs and dismissals stay with their titles.
 */

export const PROFILE_KEY = "taste_profile";
export const RECS_KEY = "recs_run";
const PER_LANE = 12;
const CLAUDE_EVERY = 7 * 86_400_000;

export type RecsReport = {
  startedAt: string; finishedAt?: string; ok?: boolean; error?: string;
  candidates: number; popular: number; deep: number; claude: number; claudeDropped: number; added: number;
  lastClaudeAt?: string;
};

const g = globalThis as unknown as { __cineRecs?: { running: boolean } };
const state = (g.__cineRecs ??= { running: false });
export const recsRunning = () => state.running;
export const lastRecsReport = () => getSetting<RecsReport>(RECS_KEY);

/** Runs unless a run is going, or (when not forced) the last good run was under 20 hours ago. */
export async function recsOnce(force = false): Promise<RecsReport | null> {
  if (state.running) return null;
  if (!force) {
    const last = await lastRecsReport().catch(() => null);
    if (last?.ok && last.finishedAt && Date.now() - Date.parse(last.finishedAt) < 20 * 3_600_000) return null;
  }
  state.running = true;
  try { return await run(force); }
  finally { state.running = false; }
}

type Found = Candidate & { score: number; seeds: { seed: Seed; list: string }[]; via?: string };
const key = (kind: TmdbKind, id: number) => `${kind}:${id}`;
const asKind = (k: "movie" | "series"): TmdbKind => (k === "series" ? "tv" : "movie");

async function run(force: boolean): Promise<RecsReport> {
  const prev = await lastRecsReport().catch(() => null);
  const report: RecsReport = { startedAt: new Date().toISOString(), candidates: 0, popular: 0, deep: 0, claude: 0, claudeDropped: 0, added: 0, lastClaudeAt: prev?.lastClaudeAt };
  try {
    const client = db();
    if (!client) throw new Error("The database isn't connected.");
    if (!process.env.TMDB_API_KEY) throw new Error("TMDB_API_KEY is not set.");
    const taste = await loadTaste();
    const profile = buildProfile(taste);
    await setSetting(PROFILE_KEY, profile);
    if (!profile.watchedTitles) throw new Error("No watches yet: the profile is built from your Plex watch history.");

    // What's already known: watched, on the shelves, or turned down.
    const watched = new Set(taste.watches.map((w) => w.title_id));
    const turnedDown = new Set(taste.feedback.filter((f) => f.feedback !== "up").map((f) => f.title_id));
    const byTmdb = new Map(taste.titles.filter((t) => t.tmdb_id).map((t) => [key(asKind(t.kind), t.tmdb_id!), t]));
    const skip = (c: Candidate) => {
      const t = byTmdb.get(key(c.kind, c.tmdbId));
      return !!t && (watched.has(t.id) || t.on_plex || t.in_library || turnedDown.has(t.id));
    };

    // 2. Candidates.
    const found = new Map<string, Found>();
    const take = (c: Candidate, seed?: Seed, list?: string, via?: string) => {
      if (skip(c) || !c.year) return;
      const f = found.get(key(c.kind, c.tmdbId)) ?? { ...c, score: 0, seeds: [] };
      if (seed && list) f.seeds.push({ seed, list });
      if (via && !f.via) f.via = via;
      found.set(key(c.kind, c.tmdbId), f);
    };
    await pool(profile.seeds.slice(0, 8), 3, async (seed) => {
      for (const list of ["recommendations", "similar"] as const) {
        const got = await related(asKind(seed.kind), seed.tmdbId, list).catch(() => []);
        for (const c of got) take(c, seed, list);
      }
    });
    const [movieGenres, tvGenres] = await Promise.all([genreIds("movie"), genreIds("tv")]);
    const topGenres = profile.genres.slice(0, 3).map(([g]) => g);
    const kwIds = (await Promise.all(profile.keywords.slice(0, 5).map(async ([k]) => [k, await keywordId(k).catch(() => null)] as const))).filter(([, id]) => id) as [string, number][];
    const searches: Promise<void>[] = [];
    for (const [kind, gmap] of [["movie", movieGenres], ["tv", tvGenres]] as const) {
      const gids = topGenres.map((g) => gmap.get(g)).filter((x): x is number => !!x);
      if (gids.length) {
        searches.push(discover(kind, { genres: gids, minVotes: 2000 }).then((r) => r.forEach((c) => take(c, undefined, undefined, `genre:${topGenres[0]}`))).catch(() => {}));
        searches.push(discover(kind, { genres: gids, minVotes: 60, maxVotes: 1200, before: 1995 }).then((r) => r.forEach((c) => take(c, undefined, undefined, `genre:${topGenres[0]}`))).catch(() => {}));
      }
      for (const [name, id] of kwIds.slice(0, 3)) {
        searches.push(discover(kind, { keywords: [id], minVotes: 80 }).then((r) => r.forEach((c) => take(c, undefined, undefined, `keyword:${name}`))).catch(() => {}));
      }
    }
    await Promise.all(searches);
    report.candidates = found.size;

    // 4. Score and split.
    const gNames = new Map<number, string>([...movieGenres, ...tvGenres].map(([n, id]) => [id, n]));
    const gWeight = new Map(profile.genres);
    const maxG = Math.max(1e-6, ...profile.genres.map(([, w]) => w));
    const langs = new Set(profile.languages.map(([l]) => l));
    const popular: Found[] = [], deep: Found[] = [];
    for (const f of found.values()) {
      const taste = f.genreIds.reduce((s, id) => s + Math.max(0, gWeight.get(gNames.get(id) ?? "") ?? 0), 0) / maxG;
      const fromSeeds = f.seeds.reduce((s, x) => s + x.seed.weight * (x.list === "recommendations" ? 1 : 0.7), 0);
      f.score = fromSeeds * 1.6 + taste * 0.5 + (f.via ? 0.4 : 0) + (f.avg - 6.5) * 0.35;
      const bigVotes = f.kind === "movie" ? 1500 : 400;
      const isPopular = f.votes >= bigVotes && f.avg >= 7;
      const isDeep = f.votes >= 40 && ((f.votes < bigVotes && f.avg >= 6.6) || (f.avg >= 6.9 && (f.year! < 1985 || (f.language !== "en" && !langs.has(f.language)))));
      if (isPopular) popular.push(f);
      else if (isDeep) deep.push(f);
    }
    popular.sort((a, b) => b.score - a.score); deep.sort((a, b) => b.score - a.score);
    const picks = [
      ...popular.slice(0, PER_LANE).map((f) => ({ f, lane: "popular" as const })),
      ...deep.filter((f) => !popular.slice(0, PER_LANE).includes(f)).slice(0, PER_LANE).map((f) => ({ f, lane: "deep_cut" as const })),
    ];
    report.popular = Math.min(PER_LANE, popular.length);
    report.deep = picks.length - report.popular;

    // 5. Claude's weekly deep cuts (checked against TMDB).
    const claudeDue = canSuggest() && (force || !report.lastClaudeAt || Date.now() - Date.parse(report.lastClaudeAt) > CLAUDE_EVERY);
    const claudePicks: { c: Candidate; reason: string }[] = [];
    if (claudeDue) {
      try {
        const { kept, dropped } = await claudeDeepCuts(profile, taste.titles.filter((t) => watched.has(t.id)).map((t) => `${t.title}${t.year ? ` (${t.year})` : ""}`));
        report.claudeDropped = dropped;
        const chosen = new Set(picks.map((p) => key(p.f.kind, p.f.tmdbId)));
        for (const k of kept) if (!skip(k.c) && !chosen.has(key(k.c.kind, k.c.tmdbId))) claudePicks.push(k);
        report.claude = claudePicks.length;
        report.lastClaudeAt = new Date().toISOString();
      } catch (e) {
        console.error("[recs] Claude's deep cuts failed:", (e as Error).message);
      }
    }

    // 6. Save titles and recommendations.
    const rows: { title_id: string; lane: "popular" | "deep_cut"; reason: string; score: number; source: string; seed_title_id: string | null; updated_at: string }[] = [];
    const now = new Date().toISOString();
    const ensure = async (c: Candidate) => {
      const known = byTmdb.get(key(c.kind, c.tmdbId));
      if (known) return known.id;
      const { id } = await saveOffShelf(c.kind, c.tmdbId);
      report.added++;
      return id;
    };
    await pool(picks, 3, async ({ f, lane }) => {
      try {
        const id = await ensure(f);
        rows.push({ title_id: id, lane, reason: reasonFor(f, lane, profile), score: f.score, source: "tmdb", seed_title_id: topSeed(f)?.id ?? null, updated_at: now });
      } catch (e) { console.error(`[recs] couldn't add ${f.title}:`, (e as Error).message); }
    });
    await pool(claudePicks, 3, async ({ c, reason }) => {
      try {
        const id = await ensure(c);
        rows.push({ title_id: id, lane: "deep_cut", reason, score: 10, source: "claude", seed_title_id: null, updated_at: now });
      } catch (e) { console.error(`[recs] couldn't add ${c.title}:`, (e as Error).message); }
    });
    if (rows.length) {
      const { error } = await client.from("recommendations").upsert(rows, { onConflict: "title_id" });
      if (error) throw new Error(error.message);
    }
    // Last run's suggestions that didn't come back go, unless the member reacted to them.
    // Claude's stay until its next weekly list.
    const stale = client.from("recommendations").delete().is("feedback", null).lt("updated_at", now);
    const { error: delError } = await (claudeDue ? stale : stale.eq("source", "tmdb"));
    if (delError) throw new Error(delError.message);
    report.ok = true;
  } catch (e) {
    report.ok = false;
    report.error = (e as Error).message;
    console.error("[recs] run failed:", report.error);
  }
  report.finishedAt = new Date().toISOString();
  await setSetting(RECS_KEY, report).catch((e) => console.error("[recs] couldn't save the report:", e.message));
  try { revalidateTag(CATALOG_TAG, { expire: 0 }); } catch (e) { console.error("[recs] couldn't refresh the pages:", (e as Error).message); }
  return report;
}

const topSeed = (f: Found) => [...f.seeds].sort((a, b) => b.seed.weight - a.seed.weight)[0]?.seed;
const languageName = (code: string) => { try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code; } catch { return code; } };

/** The staff card: why this one, in one or two short sentences, from facts the run actually has. */
function reasonFor(f: Found, lane: "popular" | "deep_cut", profile: Profile) {
  const seed = topSeed(f);
  const others = new Set(f.seeds.map((s) => s.seed.title)).size - 1;
  let why: string;
  if (seed?.rating && seed.rating >= 4) why = `You gave ${seed.title} ${seed.rating} stars.`;
  else if (seed) why = `Because you watched ${seed.title}.`;
  else if (f.via?.startsWith("keyword:")) why = `You keep coming back to "${f.via.slice(8)}".`;
  else why = `${profile.genres[0]?.[0] ?? "This"} is your most-watched genre lately.`;
  if (others > 0) why += ` It also comes up next to ${others} more of your favourites.`;
  if (lane === "deep_cut") {
    const bits = [f.year && f.year < 1990 ? `${f.year}` : null, f.language && f.language !== "en" ? `in ${languageName(f.language)}` : null].filter(Boolean);
    why += ` ${bits.length ? `${bits.join(", ")}, ` : ""}only ${f.votes.toLocaleString("en")} votes on TMDB.`;
  } else {
    why += ` ${f.avg.toFixed(1)} on TMDB from ${f.votes.toLocaleString("en")} votes.`;
  }
  return why.replace(/ {2,}/g, " ").trim();
}

async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (next < items.length) await fn(items[next++]); }));
}

