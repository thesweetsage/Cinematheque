import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { missingTable } from "../settings";
import { db } from "../supabase";
import { onDeck } from "./api";
import { plexServer } from "./connection";

export type DeckItem = { id: string; label: string; progress: number };
export const DECK_TAG = "plex-deck";

/** Continue watching: Plex's On Deck (films in progress, next episodes), matched to titles. Empty when Plex is away. */
export async function continueWatching(): Promise<DeckItem[]> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 120, expire: 900 });
  cacheTag(DECK_TAG);
  try {
    const client = db();
    const server = client && (await plexServer());
    if (!client || !server) return [];
    const items = await onDeck(server);
    const keys = [...new Set(items.map((i) => (i.type === "episode" ? i.grandparentRatingKey : i.ratingKey)).filter(Boolean))] as string[];
    if (!keys.length) return [];
    const { data, error } = await client.from("titles").select("slug, plex_rating_key").in("plex_rating_key", keys);
    if (error) throw new Error(error.message);
    const slug = new Map((data as { slug: string; plex_rating_key: string }[]).map((r) => [r.plex_rating_key, r.slug]));
    const out: DeckItem[] = [];
    for (const i of items) {
      const id = slug.get((i.type === "episode" ? i.grandparentRatingKey : i.ratingKey) ?? "");
      if (!id || out.some((x) => x.id === id)) continue;
      const progress = i.viewOffset && i.duration ? Math.min(1, i.viewOffset / i.duration) : 0;
      const left = i.viewOffset && i.duration ? Math.max(1, Math.round((i.duration - i.viewOffset) / 60000)) : 0;
      const label = i.type === "episode"
        ? `S${i.parentIndex} · E${i.index}${progress ? ` · ${left} min left` : " · next up"}`
        : progress ? `${left} min left` : "Up next";
      out.push({ id, label, progress });
    }
    return out.slice(0, 8);
  } catch (e) {
    if (!missingTable(e)) console.error("[plex] continue watching:", (e as Error).message);
    return [];
  }
}
