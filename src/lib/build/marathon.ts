import "server-only";
import { selectAll } from "../supabase";
import { seasons } from "../tmdb";
import { addDays, client, saveProgramme } from "./common";

/*
 * Series marathon: a plan to finish a series you keep dropping. Its episodes (from Plex, or from TMDB when the series
 * isn't on Plex) are split into portions of N a day or N a week from a start date; each episode is an item that ticks
 * itself when Plex logs it. The Store Front nudges when portions that were due are still unwatched.
 */

export type MarathonAsk = { series: string; per: number; unit: "day" | "week"; start: string; skipWatched: boolean };

/** Makes sure the series' episodes are in the store (Plex's are already there; TMDB fills the rest, never overwriting). */
async function ensureEpisodes(titleId: string, tmdbId: number | null) {
  if (!tmdbId) return;
  const list = await seasons(tmdbId).catch(() => []);
  const rows = list.filter((s) => s.number > 0).flatMap((s) => s.episodes.map((e) => ({ title_id: titleId, season: s.number, episode: e.number, name: e.name })));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await client().from("episodes").upsert(rows.slice(i, i + 500), { onConflict: "title_id,season,episode", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
}

export async function buildMarathon(ask: MarathonAsk): Promise<string> {
  const c = client();
  const per = Math.min(20, Math.max(1, Math.round(ask.per)));
  const { data: t, error } = await c.from("titles").select("id, title, tmdb_id, kind").eq("slug", ask.series).maybeSingle();
  if (error) throw new Error(error.message);
  const title = t as { id: string; title: string; tmdb_id: number | null; kind: string } | null;
  if (!title || title.kind !== "series") throw new Error("That series isn't in the store.");
  await ensureEpisodes(title.id, title.tmdb_id);
  const [eps, seen] = await Promise.all([
    selectAll<{ id: string; season: number; episode: number }>((a, b) => c.from("episodes").select("id, season, episode").eq("title_id", title.id).gt("season", 0).order("season").order("episode").range(a, b)),
    selectAll<{ episode_id: string }>((a, b) => c.from("watches").select("episode_id").eq("title_id", title.id).not("episode_id", "is", null).range(a, b)),
  ]);
  if (!eps.length) throw new Error("Couldn't find this series' episodes on Plex or TMDB.");
  const watched = new Set(seen.map((w) => w.episode_id));
  const list = ask.skipWatched ? eps.filter((e) => !watched.has(e.id)) : eps;
  if (!list.length) throw new Error("You've already watched every episode. Nothing left to marathon.");
  const step = ask.unit === "week" ? 7 : 1;
  const items = list.map((e, i) => ({ titleId: title.id, episodeId: e.id, chapter: `Season ${e.season}`, date: addDays(ask.start, Math.floor(i / per) * step) }));
  const end = items[items.length - 1].date;
  const portions = Math.ceil(list.length / per);
  return saveProgramme({
    type: "marathon", title: `${title.title} marathon`, start: ask.start, end, accent: "#7EE6FF", status: "live",
    theme: `${list.length} episode${list.length === 1 ? "" : "s"}, ${per} a ${ask.unit}: ${portions} ${ask.unit}${portions === 1 ? "" : "s"}${ask.skipWatched && list.length < eps.length ? `, skipping the ${eps.length - list.length} you've seen` : ""}.`,
    extras: { per, unit: ask.unit },
  }, items);
}
