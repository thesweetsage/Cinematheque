import "server-only";
import { revalidateTag } from "next/cache";
import { CATALOG_TAG } from "../catalog";
import { buildTitleRow } from "../importTitle";
import { getSetting, setSetting } from "../settings";
import { db, selectAll } from "../supabase";
import { findByExternalId } from "../tmdb";
import { externalIds, sectionItems, sections, type Item } from "./api";
import { plexServer } from "./connection";

/*
 * The Plex sync (hourly, and on demand from the Membership card):
 * 1. reads every film, show and episode from the movie and TV sections (includeGuids=1),
 * 2. matches each film/show to a title by its tmdb or imdb id, creating the title from TMDB when it's new,
 * 3. stores plex_rating_key and on_plex, and every episode,
 * 4. writes a watch (source plex) when a film's or episode's lastViewedAt is newer than the last one stored,
 * 5. takes titles that left Plex off it, and clears wishlist items that arrived.
 */

export type SyncReport = {
  startedAt: string; finishedAt?: string; ok?: boolean; error?: string; server?: string;
  films: number; shows: number; episodes: number; added: number; newWatches: number; removed: number; wishlistCleared: number;
  /** Titles Plex has no usable tmdb/imdb/tvdb id for, or that TMDB doesn't know. */
  unmatched: string[];
};
type State = { running: boolean; progress: string };
const g = globalThis as unknown as { __cinePlexSync?: State };
const state: State = (g.__cinePlexSync ??= { running: false, progress: "" });

export const REPORT_KEY = "plex_sync";
export const syncState = () => ({ ...state });
export const lastReport = () => getSetting<SyncReport>(REPORT_KEY);

/** Runs a sync unless one is already running. Resolves with its report (null if it didn't start). */
export async function syncOnce(): Promise<SyncReport | null> {
  if (state.running) return null;
  state.running = true;
  try { return await runSync(); }
  finally { state.running = false; state.progress = ""; }
}

type TitleRef = { id: string; slug: string; kind: "movie" | "series"; title: string; tmdb_id: number | null; imdb_id: string | null; on_plex: boolean };

async function runSync(): Promise<SyncReport> {
  const report: SyncReport = { startedAt: new Date().toISOString(), films: 0, shows: 0, episodes: 0, added: 0, newWatches: 0, removed: 0, wishlistCleared: 0, unmatched: [] };
  try {
    const client = db();
    if (!client) throw new Error("The database isn't connected.");
    const server = await plexServer();
    if (!server) throw new Error("Plex isn't connected, or the server can't be reached.");
    report.server = server.name;

    // 1. Read the library.
    state.progress = "Reading the Plex library…";
    const secs = (await sections(server)).filter((s) => s.type === "movie" || s.type === "show");
    const films: Item[] = [], shows: Item[] = [], episodes: Item[] = [];
    for (const s of secs) {
      if (s.type === "movie") films.push(...(await sectionItems(server, s.key, 1)));
      else { shows.push(...(await sectionItems(server, s.key, 2))); episodes.push(...(await sectionItems(server, s.key, 4))); }
    }
    report.films = films.length; report.shows = shows.length; report.episodes = episodes.length;

    // 2. Match to titles (create the new ones from TMDB).
    const known = await selectAll<TitleRef>((a, b) => client.from("titles").select("id, slug, kind, title, tmdb_id, imdb_id, on_plex").range(a, b));
    const byTmdb = new Map(known.filter((t) => t.tmdb_id).map((t) => [`${t.kind}:${t.tmdb_id}`, t]));
    const byImdb = new Map(known.filter((t) => t.imdb_id).map((t) => [`${t.kind}:${t.imdb_id}`, t]));
    const matched = new Map<string, TitleRef>(); // Plex ratingKey -> title
    const work = [...films.map((i) => ({ i, kind: "movie" as const })), ...shows.map((i) => ({ i, kind: "series" as const }))];
    let done = 0;
    await pool(work, 4, async ({ i, kind }) => {
      state.progress = `Matching titles… ${++done} of ${work.length}`;
      const ids = externalIds(i);
      let t = (ids.tmdb && byTmdb.get(`${kind}:${ids.tmdb}`)) || (ids.imdb && byImdb.get(`${kind}:${ids.imdb}`)) || null;
      if (!t) {
        try {
          const tk = kind === "movie" ? "movie" : "tv";
          const tmdbId = ids.tmdb ?? (ids.imdb ? await findByExternalId("imdb_id", ids.imdb, tk) : null) ?? (ids.tvdb && tk === "tv" ? await findByExternalId("tvdb_id", String(ids.tvdb), tk) : null);
          t = tmdbId ? byTmdb.get(`${kind}:${tmdbId}`) ?? (await createTitle(tk, tmdbId, i.ratingKey)) : null;
          if (t && !byTmdb.has(`${kind}:${t.tmdb_id}`)) { byTmdb.set(`${kind}:${t.tmdb_id}`, t); report.added++; }
        } catch (e) {
          console.error(`[plex] couldn't add ${i.title}:`, (e as Error).message);
        }
      }
      if (t) matched.set(i.ratingKey, t);
      else report.unmatched.push(`${i.title}${i.year ? ` (${i.year})` : ""}`);
    });

    // 3. Mark them on Plex and store the episodes.
    state.progress = "Saving…";
    const onPlex = new Map<string, { id: string; slug: string; kind: string; title: string; on_plex: true; plex_rating_key: string }>();
    for (const [rk, t] of matched) onPlex.set(t.id, { id: t.id, slug: t.slug, kind: t.kind, title: t.title, on_plex: true, plex_rating_key: rk });
    for (const rows of chunks([...onPlex.values()], 500)) {
      const { error } = await client.from("titles").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
    }
    const epRows = new Map<string, { title_id: string; season: number; episode: number; name: string; runtime: number | null; plex_rating_key: string }>();
    for (const e of episodes) {
      const t = e.grandparentRatingKey && matched.get(e.grandparentRatingKey);
      if (!t || e.parentIndex == null || e.index == null) continue;
      epRows.set(`${t.id}|${e.parentIndex}|${e.index}`, { title_id: t.id, season: e.parentIndex, episode: e.index, name: e.title, runtime: e.duration ? Math.round(e.duration / 60000) : null, plex_rating_key: e.ratingKey });
    }
    const episodeId = new Map<string, string>(); // Plex episode ratingKey -> episodes.id
    for (const rows of chunks([...epRows.values()], 500)) {
      const { data, error } = await client.from("episodes").upsert(rows, { onConflict: "title_id,season,episode" }).select("id, plex_rating_key");
      if (error) throw new Error(error.message);
      for (const r of data as { id: string; plex_rating_key: string }[]) episodeId.set(r.plex_rating_key, r.id);
    }

    // 4. New watches.
    type W = { title_id: string; episode_id: string | null; watched_at: string };
    const seen = await selectAll<W>((a, b) => client.from("watches").select("title_id, episode_id, watched_at").eq("source", "plex").range(a, b));
    const latest = new Map<string, number>();
    for (const w of seen) {
      const k = `${w.title_id}|${w.episode_id ?? ""}`, at = Date.parse(w.watched_at);
      if (at > (latest.get(k) ?? 0)) latest.set(k, at);
    }
    const fresh: (W & { source: "plex"; rating: number | null })[] = [];
    const consider = (title_id: string, episode_id: string | null, i: Item) => {
      if (!i.lastViewedAt) return;
      const at = i.lastViewedAt * 1000;
      if (at <= (latest.get(`${title_id}|${episode_id ?? ""}`) ?? 0)) return;
      const rating = !episode_id && i.userRating ? Math.min(5, Math.max(1, Math.round(i.userRating / 2))) : null; // Plex stars are 0-10
      fresh.push({ title_id, episode_id, watched_at: new Date(at).toISOString(), source: "plex", rating });
    };
    for (const f of films) { const t = matched.get(f.ratingKey); if (t) consider(t.id, null, f); }
    for (const e of episodes) {
      const t = e.grandparentRatingKey && matched.get(e.grandparentRatingKey), id = episodeId.get(e.ratingKey);
      if (t && id) consider(t.id, id, e);
    }
    for (const rows of chunks(fresh, 500)) report.newWatches += await insertWatches(rows);

    // 5. Titles that left Plex, and wishlist items that arrived.
    const gone = known.filter((t) => t.on_plex && !onPlex.has(t.id)).map((t) => t.id);
    // An empty read while titles are marked on Plex looks like a library that's offline, not a deleted one: leave them.
    if (gone.length && matched.size > 0) {
      for (const ids of chunks(gone, 200)) {
        const { error } = await client.from("titles").update({ on_plex: false, plex_rating_key: null }).in("id", ids);
        if (error) throw new Error(error.message);
      }
      report.removed = gone.length;
    }
    for (const ids of chunks([...onPlex.keys()], 200)) {
      const { data, error } = await client.from("wishlist").delete().in("title_id", ids).select("title_id");
      if (error) throw new Error(error.message);
      report.wishlistCleared += data.length;
    }
    report.ok = true;
  } catch (e) {
    report.ok = false;
    report.error = (e as Error).message;
    console.error("[plex] sync failed:", report.error);
  }
  report.finishedAt = new Date().toISOString();
  report.unmatched.sort();
  await setSetting(REPORT_KEY, report).catch((e) => console.error("[plex] couldn't save the sync report:", e.message));
  revalidateTag(CATALOG_TAG, { expire: 0 });
  return report;
}

/** A new title from TMDB, already marked on Plex. Slugs clash now and then (a remake in the same year): add the TMDB id. */
async function createTitle(kind: "movie" | "tv", tmdbId: number, ratingKey: string): Promise<TitleRef> {
  const client = db()!;
  const row = { ...(await buildTitleRow(kind, tmdbId)), on_plex: true, plex_rating_key: ratingKey };
  for (const slug of [row.slug, `${row.slug}-${tmdbId}`]) {
    const { data, error } = await client.from("titles").upsert({ ...row, slug }, { onConflict: "kind,tmdb_id" }).select("id, slug, kind, title, tmdb_id, imdb_id, on_plex").single();
    if (!error) return data as TitleRef;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error(`no free slug for ${row.slug}`);
}

/** Inserts watches; the once-a-day unique index can reject a batch, so it then goes one by one and skips repeats. */
async function insertWatches(rows: object[]) {
  const client = db()!;
  const { error } = await client.from("watches").insert(rows);
  if (!error) return rows.length;
  if (error.code !== "23505") throw new Error(error.message);
  let n = 0;
  for (const r of rows) {
    const { error: e } = await client.from("watches").insert(r);
    if (!e) n++;
    else if (e.code !== "23505") throw new Error(e.message);
  }
  return n;
}

const chunks = <T>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => { while (next < items.length) await fn(items[next++]); }));
}
