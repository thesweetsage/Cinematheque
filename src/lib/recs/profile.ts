import "server-only";
import { db, selectAll } from "../supabase";

/*
 * The taste profile (rebuilt nightly): what the member's watches, ratings and thumbs say they like.
 * Every watched title adds weight to its genres, keywords, director, decade, language and country.
 * Higher ratings count more, recent watches count more, and a series counts more once it's finished
 * (and against itself when it was dropped). Thumbs on recommendations count a little either way.
 */

export type Seed = { id: string; slug: string; kind: "movie" | "series"; tmdbId: number; title: string; rating: number | null; weight: number };
export type Profile = {
  builtAt: string;
  watchedTitles: number;
  genres: [string, number][];
  keywords: [string, number][];
  directors: [string, number][];
  decades: [number, number][];
  languages: [string, number][];
  countries: [string, number][];
  /** The titles the candidates are found from: recent favourites first. */
  seeds: Seed[];
  finishedSeries: string[];
  droppedSeries: string[];
};

export type TitleRow = {
  id: string; slug: string; kind: "movie" | "series"; tmdb_id: number | null; title: string; year: number | null;
  genres: string[]; keywords: string[]; director_or_creator: string | null; country: string | null; language: string | null;
  on_plex: boolean; in_library: boolean;
};
export type WatchRow = { title_id: string; episode_id: string | null; watched_at: string; rating: number | null };
export type FeedbackRow = { title_id: string; feedback: "up" | "down" | "dismissed" };

const DAY = 86_400_000;
const top = <K>(m: Map<K, number>, n: number) => [...m].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n);

export async function loadTaste() {
  const client = db();
  if (!client) throw new Error("The database isn't connected.");
  const [titles, watches, episodes, feedback] = await Promise.all([
    selectAll<TitleRow>((a, b) => client.from("titles").select("id, slug, kind, tmdb_id, title, year, genres, keywords, director_or_creator, country, language, on_plex, in_library").range(a, b)),
    selectAll<WatchRow>((a, b) => client.from("watches").select("title_id, episode_id, watched_at, rating").order("watched_at", { ascending: false }).range(a, b)),
    selectAll<{ title_id: string }>((a, b) => client.from("episodes").select("title_id").range(a, b)),
    selectAll<FeedbackRow>((a, b) => client.from("recommendations").select("title_id, feedback").not("feedback", "is", null).range(a, b)),
  ]);
  return { titles, watches, episodes, feedback };
}

export function buildProfile({ titles, watches, episodes, feedback }: Awaited<ReturnType<typeof loadTaste>>, now = Date.now()): Profile {
  const byId = new Map(titles.map((t) => [t.id, t]));
  const epCount = new Map<string, number>();
  for (const e of episodes) epCount.set(e.title_id, (epCount.get(e.title_id) ?? 0) + 1);

  // Per title: latest watch, latest rating, episodes seen.
  type Seen = { last: number; rating: number | null; eps: Set<string> };
  const seen = new Map<string, Seen>();
  for (const w of watches) { // newest first
    const s = seen.get(w.title_id) ?? { last: Date.parse(w.watched_at), rating: null, eps: new Set<string>() };
    if (s.rating == null && w.rating) s.rating = w.rating;
    if (w.episode_id) s.eps.add(w.episode_id);
    seen.set(w.title_id, s);
  }

  const finished: string[] = [], dropped: string[] = [];
  const weightOf = new Map<string, number>();
  for (const [id, s] of seen) {
    const t = byId.get(id);
    if (!t) continue;
    // Rated: 1★ = -0.6 … 5★ = +1. Unrated: a mild yes (you chose to watch it).
    let w = s.rating ? (s.rating - 2.5) / 2.5 : 0.35;
    const ageDays = (now - s.last) / DAY;
    w *= 0.4 + 0.6 * Math.pow(0.5, ageDays / 120);
    if (t.kind === "series") {
      const total = epCount.get(id) ?? 0, share = total ? s.eps.size / total : 0;
      if (total && share >= 0.95) { finished.push(t.title); w += 0.3; }
      else if (total && share < 0.3 && ageDays > 60) { dropped.push(t.title); w -= 0.4; }
    }
    weightOf.set(id, w);
  }
  for (const f of feedback) {
    if (weightOf.has(f.title_id)) continue; // a watch already says more than a thumb
    weightOf.set(f.title_id, f.feedback === "up" ? 0.5 : f.feedback === "down" ? -0.5 : -0.15);
  }

  const genres = new Map<string, number>(), keywords = new Map<string, number>(), directors = new Map<string, number>();
  const decades = new Map<number, number>(), languages = new Map<string, number>(), countries = new Map<string, number>();
  const add = <K>(m: Map<K, number>, k: K | null | undefined, w: number) => { if (k != null && k !== "") m.set(k, (m.get(k) ?? 0) + w); };
  for (const [id, w] of weightOf) {
    const t = byId.get(id)!;
    for (const g of t.genres) add(genres, g, w);
    for (const k of t.keywords.slice(0, 12)) add(keywords, k, w);
    for (const d of (t.director_or_creator ?? "").split(", ")) add(directors, d, w);
    if (t.year) add(decades, Math.floor(t.year / 10) * 10, w);
    add(languages, t.language, w);
    add(countries, t.country, w);
  }

  const seeds: Seed[] = [...weightOf]
    .map(([id, weight]) => ({ t: byId.get(id)!, weight }))
    .filter(({ t, weight }) => t.tmdb_id && weight > 0.2 && seen.has(t.id))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10)
    .map(({ t, weight }) => ({ id: t.id, slug: t.slug, kind: t.kind, tmdbId: t.tmdb_id!, title: t.title, rating: seen.get(t.id)?.rating ?? null, weight }));

  return {
    builtAt: new Date(now).toISOString(),
    watchedTitles: seen.size,
    genres: top(genres, 10), keywords: top(keywords, 15), directors: top(directors, 10),
    decades: top(decades, 6), languages: top(languages, 6), countries: top(countries, 6),
    seeds, finishedSeries: finished, droppedSeries: dropped,
  };
}
