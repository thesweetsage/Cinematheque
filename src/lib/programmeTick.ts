import "server-only";
import { db } from "./supabase";

/*
 * Programme items tick themselves: when the Plex sync logs a new watch, every unticked item for that title
 * (or that episode, when the item is one) in a live programme is marked done, dated with the watch,
 * as long as the watch falls on or after the programme's start date.
 */
type Watch = { title_id: string; episode_id: string | null; watched_at: string };
/** Every programme with things to watch (editions and family trees have nothing to tick). */
const TICKS = ["festival", "days31", "marathon", "curriculum", "retrospective", "time_capsule", "essay_series"];

export async function tickFromWatches(watches: Watch[]): Promise<number> {
  const client = db();
  if (!client || !watches.length) return 0;
  const titleIds = [...new Set(watches.map((w) => w.title_id))];
  const { data, error } = await client.from("programme_items")
    .select("programme_id, position, title_id, episode_id, programmes!inner(type, status, start_date)")
    .eq("done", false).in("title_id", titleIds).eq("programmes.status", "live").in("programmes.type", TICKS);
  if (error) throw new Error(error.message);
  type Row = { programme_id: string; position: number; title_id: string; episode_id: string | null; programmes: { start_date: string | null } | { start_date: string | null }[] };
  let n = 0;
  for (const it of (data ?? []) as Row[]) {
    const start = (Array.isArray(it.programmes) ? it.programmes[0] : it.programmes)?.start_date;
    const match = watches
      .filter((w) => w.title_id === it.title_id && (!it.episode_id || w.episode_id === it.episode_id))
      .filter((w) => !start || w.watched_at.slice(0, 10) >= start)
      .sort((a, b) => a.watched_at.localeCompare(b.watched_at))[0];
    if (!match) continue;
    const { error: e } = await client.from("programme_items").update({ done: true, done_at: match.watched_at })
      .eq("programme_id", it.programme_id).eq("position", it.position).eq("done", false);
    if (e) throw new Error(e.message);
    n++;
  }
  return n;
}
