"use server";
import { updateTag } from "next/cache";
import { after } from "next/server";
import { CATALOG_TAG } from "@/lib/catalog";
import { saveOffShelf } from "@/lib/importTitle";
import { requireMember } from "@/lib/member";
import { lastRecsReport, PROFILE_KEY, recsOnce, recsRunning, type RecsReport } from "@/lib/recs/engine";
import type { Profile } from "@/lib/recs/profile";
import { getSetting } from "@/lib/settings";
import { db } from "@/lib/supabase";

/* Staff cards and the wishlist: thumbs up/down, dismiss, add to / take off the wishlist, and "write new cards now". */

type Result = { error?: string };
const NO_DB = { error: "The database isn't connected yet." };

/** Thumbs up/down or dismiss a recommendation (null clears it). The next nightly run reads it into the taste profile. */
export async function rateRec(recId: string, feedback: "up" | "down" | "dismissed" | null): Promise<Result> {
  await requireMember();
  const client = db();
  if (!client) return NO_DB;
  const { error } = await client.from("recommendations").update({ feedback }).eq("id", recId);
  if (error) return { error: error.message };
  updateTag(CATALOG_TAG);
  return {};
}

async function titleId(slug: string) {
  const { data } = await db()!.from("titles").select("id").eq("slug", slug).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Puts a title the store already knows on the wishlist (or takes it off). */
export async function setWish(slug: string, on: boolean): Promise<Result> {
  await requireMember();
  const client = db();
  if (!client) return NO_DB;
  const id = await titleId(slug);
  if (!id) return { error: "That title isn't in the store." };
  const { error } = on
    ? await client.from("wishlist").upsert({ title_id: id }, { onConflict: "title_id", ignoreDuplicates: true })
    : await client.from("wishlist").delete().eq("title_id", id);
  if (error) return { error: error.message };
  updateTag(CATALOG_TAG);
  return {};
}

/** Wishlists a title straight from TMDB ("More like this"), saving it to the store first, off the shelves. */
export async function wishTmdb(kind: "movie" | "tv", tmdbId: number): Promise<Result & { slug?: string }> {
  await requireMember();
  const client = db();
  if (!client) return NO_DB;
  try {
    const t = await saveOffShelf(kind, tmdbId);
    const { error } = await client.from("wishlist").upsert({ title_id: t.id }, { onConflict: "title_id", ignoreDuplicates: true });
    if (error) return { error: error.message };
    updateTag(CATALOG_TAG);
    return { slug: t.slug };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Writes a fresh set of staff cards now (instead of waiting for the night). */
export async function runRecsNow(): Promise<Result & { running?: boolean }> {
  await requireMember();
  if (!db()) return NO_DB;
  if (recsRunning()) return { running: true };
  after(() => recsOnce(true));
  return { running: true };
}

export type RecsStatus = { connected: boolean; running: boolean; report: RecsReport | null; genres: string[]; keywords: string[]; seeds: string[] };

/** What the Membership card shows: the last run, and what the taste profile thinks you like. */
export async function recsStatus(): Promise<RecsStatus> {
  await requireMember();
  const none = { running: false, report: null, genres: [], keywords: [], seeds: [] };
  if (!db()) return { connected: false, ...none };
  const [report, profile] = await Promise.all([lastRecsReport().catch(() => null), getSetting<Profile>(PROFILE_KEY).catch(() => null)]);
  return {
    connected: true, running: recsRunning(), report,
    genres: profile?.genres.slice(0, 5).map(([g]) => g) ?? [],
    keywords: profile?.keywords.slice(0, 6).map(([k]) => k) ?? [],
    seeds: profile?.seeds.slice(0, 5).map((x) => x.title) ?? [],
  };
}

/** Called by the Membership card when a run it started has finished, so the Store Front shows the new cards at once. */
export async function refreshCards(): Promise<void> {
  await requireMember();
  updateTag(CATALOG_TAG);
}
