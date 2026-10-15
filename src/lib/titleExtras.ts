import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG } from "./catalog";
import { canWrite, type FactCard } from "./notes/write";
import { db } from "./supabase";

/* What the title page needs beyond the catalogue: the booklet (fact cards, liner notes) and which episodes are on Plex and watched. */

export type Notes = { cards: FactCard[]; liner: string | null; sources: string[]; draft: boolean };
export type Extras = { notes: Notes | null; episodes: { season: number; episode: number; watched: boolean }[]; canWrite: boolean };

export const titleTag = (slug: string) => `title:${slug}`;

export async function titleExtras(slug: string): Promise<Extras | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG, titleTag(slug));
  const client = db();
  if (!client) return null;
  try {
    const { data: t, error } = await client.from("titles").select("id").eq("slug", slug).maybeSingle();
    if (error) throw new Error(error.message);
    if (!t) return null;
    const [notes, eps, seen] = await Promise.all([
      client.from("title_notes").select("fact_cards, liner_notes, sources, status").eq("title_id", t.id).maybeSingle(),
      client.from("episodes").select("id, season, episode").eq("title_id", t.id),
      client.from("watches").select("episode_id").eq("title_id", t.id).not("episode_id", "is", null),
    ]);
    for (const r of [notes, eps, seen]) if (r.error) throw new Error(r.error.message);
    const watched = new Set((seen.data as { episode_id: string }[]).map((w) => w.episode_id));
    const n = notes.data as { fact_cards: FactCard[] | null; liner_notes: string | null; sources: string[]; status: string } | null;
    return {
      notes: n && (n.fact_cards?.length || n.liner_notes) ? { cards: n.fact_cards ?? [], liner: n.liner_notes, sources: n.sources, draft: n.status !== "checked" } : null,
      episodes: (eps.data as { id: string; season: number; episode: number }[]).map((e) => ({ season: e.season, episode: e.episode, watched: watched.has(e.id) })),
      canWrite: canWrite(),
    };
  } catch (e) {
    console.error("[title] extras:", (e as Error).message);
    return null;
  }
}
