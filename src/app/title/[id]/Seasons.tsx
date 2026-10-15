import { cacheLife } from "next/cache";
import { seasons } from "@/lib/tmdb";
import { SeasonShelf, type ShelfSeason } from "./SeasonShelf";

async function load(id: number) {
  "use cache";
  cacheLife("days");
  return seasons(id).catch(() => []);
}

/* Seasons and episodes: names from TMDB, ON PLEX and watched ticks from the database. */
export async function Seasons({ tmdbId, local }: { tmdbId: number; local: { season: number; episode: number; watched: boolean }[] }) {
  const tmdb = await load(tmdbId);
  const key = (s: number, e: number) => `${s}x${e}`;
  const mine = new Map(local.map((e) => [key(e.season, e.episode), e]));
  // TMDB's list, plus any episode Plex has that TMDB doesn't.
  const list: ShelfSeason[] = tmdb.map((s) => ({
    number: s.number, name: s.name, year: s.year,
    episodes: s.episodes.map((e) => ({ number: e.number, name: e.name, onPlex: mine.has(key(s.number, e.number)), watched: !!mine.get(key(s.number, e.number))?.watched })),
  }));
  for (const e of local) {
    let season = list.find((s) => s.number === e.season);
    if (!season) list.push(season = { number: e.season, name: `Season ${e.season}`, year: null, episodes: [] });
    if (!season.episodes.some((x) => x.number === e.episode)) season.episodes.push({ number: e.episode, name: "", onPlex: true, watched: e.watched });
  }
  for (const s of list) s.episodes.sort((a, b) => a.number - b.number);
  if (!list.length) return null;
  return <SeasonShelf seasons={list} />;
}
