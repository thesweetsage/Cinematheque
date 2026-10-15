import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import sampleTitles from "@/data/sample-titles.json";
import artData from "@/data/art.json";
import store from "@/data/sample-store.json";
import { brighten } from "./colour";
import { rowToTitle, type DbTitleRow } from "./rowToTitle";
import { db, selectAll as all } from "./supabase";
import { getSetting } from "./settings";
import { plexServer as connectedPlex, usingEnv, type PlexSettings } from "./plex/connection";

/*
 * The catalogue every page reads: titles from Supabase, with the sample set as a fallback while the database
 * isn't connected, can't be read, or has no titles yet. One cached read per few minutes, tagged "catalog"
 * so a write (e.g. adding a title in the Returns Slot) can refresh it.
 */

export type Kind = "movie" | "series";
export type Title = {
  /** Slug, used in URLs. */
  id: string; t: string; y: number; kind: Kind; g: string; dir: string; run?: string;
  /** All its genres (shelf names), and when it came into the store (database only). */
  gs?: string[]; added?: string;
  /** On the shelves (sample: on Plex; database: on Plex or added in the Returns Slot). */
  lib: boolean;
  /** On the Plex server, and its Plex id (for Play on Plex). */
  plex: boolean; plexKey?: string;
  imdb?: number; rt?: number; mc?: number; my?: number;
  /** TMDB id, for reviews and seasons. */
  tmdb?: number;
  cast?: string; ctry?: string; syn: string;
};
export type Art = {
  poster: string | null; logo: string | null; backdrop: string | null;
  bg: string; accent: string; logoDark: boolean; logoRatio: number;
};
export type Rec = {
  id: string; why: string; who: string;
  /** The recommendations row, for thumbs up/down (database only). */
  recId?: string;
};
export type Fact = { k: string; x: string };
export type Catalog = {
  source: "db" | "sample";
  /** Why the sample set is showing. */
  reason?: "not-connected" | "no-access" | "empty";
  titles: Title[];
  art: Record<string, Art>;
  picks: { id: string; why: string }[];
  recs: {
    pop: Rec[]; deep: Rec[];
    /** On the shelves and never played. */
    shelf: Rec[];
    /** "Because you watched …": a recent favourite and what it led to. */
    because: { seed: string; items: Rec[] }[];
  };
  /** Titles on the wishlist (slugs). */
  wish: string[];
  /** Sample set only: the database's fact cards are read per title (src/lib/titleExtras.ts). */
  facts: Record<string, { cards: Fact[]; draft: boolean }>;
  editions: Record<string, string>;
  /** The Plex server's machine id, for Play on Plex links. */
  plexServer?: string;
};

export const CATALOG_TAG = "catalog";

/**
 * The catalogue as it is right now: read fresh from the database on every page view (once per request).
 * A cached copy came back one change late (a staff card you'd hidden, a title you'd just wishlisted).
 */
export const getCatalog = cache(loadCatalog);

/** A cached copy, for the build-time page list and browser tab titles only (they can be a minute out of date). */
export async function getCatalogCached(): Promise<Catalog> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  return loadCatalog();
}

async function loadCatalog(): Promise<Catalog> {
  const client = db();
  if (!client) return sampleCatalog("not-connected");
  try {
    return (await dbCatalog()) ?? sampleCatalog("empty");
  } catch (e) {
    console.error("[catalog] database read failed, showing the sample set:", (e as Error).message);
    return sampleCatalog("no-access");
  }
}

/* Helpers the pages use on a loaded catalogue. */
export const shelf = (c: Catalog) => c.titles.filter((t) => t.lib);
export const findTitle = (c: Catalog, id: string) => c.titles.find((t) => t.id === id);
export const artOf = (c: Catalog, id: string): Art => c.art[id] ?? FALLBACK_ART;
export function moreLikeThis(c: Catalog, t: Title, n = 6) {
  const like = c.titles.filter((x) => x.id !== t.id && (x.g === t.g || (!!t.dir && x.dir === t.dir)));
  return [...like.filter((x) => x.lib), ...like.filter((x) => !x.lib)].slice(0, n);
}

/** Aisles in store order. Anything else gets its own aisle after these. */
export const AISLES = ["HORROR", "ROM-COM", "SCI-FI", "FANTASY", "ANIME", "COMEDY", "DRAMA", "CRIME", "MYSTERY", "THRILLER", "ACTION", "ADVENTURE"] as const;
export function aisles(titles: Title[]) {
  const extra = [...new Set(titles.map((t) => t.g))].filter((g) => !(AISLES as readonly string[]).includes(g)).sort();
  return [...AISLES, ...extra].map((g) => ({ g, titles: titles.filter((t) => t.g === g) })).filter((a) => a.titles.length);
}

const FALLBACK_ART: Art = { poster: null, logo: null, backdrop: null, bg: "#14112f", accent: brighten("#b9b2ff"), logoDark: false, logoRatio: 3 };

/* ---------- Database ---------- */

const TITLE_COLUMNS =
  "id, slug, kind, tmdb_id, imdb_id, title, year, runtime, seasons_count, genres, keywords, director_or_creator, cast_names, country, language, overview, " +
  "poster_url, backdrop_url, logo_url, spine_bg, spine_accent, logo_dark, logo_ratio, on_plex, in_library, plex_rating_key, rating_imdb, rating_rt, rating_metacritic, metadata_updated_at, created_at";

async function dbCatalog(): Promise<Catalog | null> {
  const client = db()!;
  const rows = await all<DbTitleRow & { id: string }>((a, b) => client.from("titles").select(TITLE_COLUMNS).order("title").range(a, b));
  if (!rows.length) return null;

  type WatchRow = { title_id: string; episode_id: string | null; watched_at: string; rating: number | null };
  type RecRow = { id: string; title_id: string; lane: "popular" | "deep_cut"; reason: string | null; source: string | null; seed_title_id: string | null };
  type EditionRow = { spine_number: number | null; programme_items: { title_id: string }[] };
  const [watches, recRows, editionRows, wishRows] = await Promise.all([
    all<WatchRow>((a, b) => client.from("watches").select("title_id, episode_id, watched_at, rating").order("watched_at", { ascending: false }).range(a, b)),
    client.from("recommendations").select("*").or("feedback.is.null,feedback.eq.up").order("score", { ascending: false, nullsFirst: false }).limit(80),
    client.from("programmes").select("spine_number, programme_items(title_id)").eq("type", "edition").neq("status", "draft"),
    client.from("wishlist").select("title_id").order("added_at", { ascending: false }),
  ]);
  for (const r of [recRows, editionRows, wishRows]) if (r.error) throw new Error(r.error.message);

  const slugOf = new Map(rows.map((r) => [r.id, r.slug]));
  const rating = new Map<string, number>(), watched = new Set<string>();
  for (const w of watches) {
    watched.add(w.title_id);
    if (w.rating && !rating.has(w.title_id)) rating.set(w.title_id, w.rating); // newest first, so the latest rating wins
  }

  const titles: Title[] = [], art: Record<string, Art> = {};
  for (const r of rows) {
    const { title, art: a } = rowToTitle(r);
    title.my = rating.get(r.id);
    titles.push(title);
    art[r.slug] = a;
  }

  const recs: Catalog["recs"] = { pop: [], deep: [], shelf: [], because: [] };
  const lib = new Set(titles.filter((t) => t.lib).map((t) => t.id));
  // Wishlisted titles leave the staff cards: they're on the Coming Soon board now.
  const wished = new Set((wishRows.data as { title_id: string }[]).map((w) => w.title_id));
  const bySeed = new Map<string, Rec[]>();
  for (const r of recRows.data as RecRow[]) {
    const id = slugOf.get(r.title_id);
    if (!id || lib.has(id) || wished.has(r.title_id)) continue; // on the shelves or the wishlist since the run
    const rec = { id, why: r.reason ?? "", who: r.source === "claude" ? "Staff deep cut" : r.lane === "popular" ? "Popular pick" : "Deep cut", recId: r.id };
    (r.lane === "popular" ? recs.pop : recs.deep).push(rec);
    const seed = r.seed_title_id && slugOf.get(r.seed_title_id);
    if (seed) bySeed.set(seed, [...(bySeed.get(seed) ?? []), rec]);
  }
  // Claude's picks first in the deep lane: they come with the most specific reasons.
  recs.deep.sort((a, b) => Number(b.who === "Staff deep cut") - Number(a.who === "Staff deep cut"));
  recs.pop = recs.pop.slice(0, 8); recs.deep = recs.deep.slice(0, 8);
  recs.because = [...bySeed].filter(([, items]) => items.length >= 3).slice(0, 2).map(([seed, items]) => ({ seed, items: items.slice(0, 6) }));
  recs.shelf = unwatchedOnShelf(titles, new Set(rows.filter((r) => watched.has(r.id)).map((r) => r.slug)));
  const wish = (wishRows.data as { title_id: string }[]).map((w) => slugOf.get(w.title_id)).filter((x): x is string => !!x);

  const editions: Record<string, string> = {};
  for (const e of editionRows.data as EditionRow[]) {
    for (const item of e.programme_items) {
      const id = slugOf.get(item.title_id);
      if (id && e.spine_number != null) editions[id] = String(e.spine_number).padStart(3, "0");
    }
  }

  const plexServer = (await getSetting<PlexSettings>("plex").catch(() => null))?.server?.machineId ?? (await envMachineId());
  return { source: "db", titles, art, picks: tonightsPick(titles, watched, rows), recs, wish, facts: {}, editions, plexServer };
}

/** "On your shelf, unwatched": tapes you own and never played, best rated first. */
function unwatchedOnShelf(titles: Title[], played: Set<string>): Rec[] {
  return titles.filter((t) => t.lib && !played.has(t.id))
    .sort((a, b) => (b.imdb ?? 0) - (a.imdb ?? 0))
    .slice(0, 6)
    .map((t) => ({ id: t.id, why: t.imdb ? `On your shelf, never played. ${t.imdb} on IMDb.` : "On your shelf, never played.", who: t.plex ? "On your Plex" : "On your shelf" }));
}

/** Tonight's pick: an unplayed tape off the shelf, a different one each day. */
function tonightsPick(titles: Title[], watched: Set<string>, rows: { id: string; slug: string }[]) {
  const shelved = titles.filter((t) => t.lib);
  if (!shelved.length) return [];
  const played = new Set(rows.filter((r) => watched.has(r.id)).map((r) => r.slug));
  const unplayed = shelved.filter((t) => !played.has(t.id));
  const pool = unplayed.length ? unplayed : shelved;
  const day = Math.floor(Date.now() / 86_400_000);
  const t = pool[day % pool.length];
  return [{ id: t.id, why: unplayed.length ? "On your shelf and never played." : "Pulled off your shelf for tonight." }];
}

/* ---------- Sample set (phase 1) ---------- */

type RawArt = { tmdbId?: number; bg?: string; accent?: string; logo?: boolean; logoDark?: boolean; logoRatio?: number; backdrop?: boolean };
const fileExists = (rel: string) => existsSync(path.join(process.cwd(), "public", rel));

/** Sample artwork. Paths are null when `npm run art` hasn't fetched that image yet. */
function sampleArt(id: string): Art {
  const r = (artData as Record<string, RawArt>)[id] ?? {};
  const poster = `/art/posters/${id}.jpg`, logo = `/art/logos/${id}.png`, backdrop = `/art/backdrops/${id}.jpg`;
  return {
    poster: fileExists(poster) ? poster : null,
    logo: r.logo && fileExists(logo) ? logo : null,
    backdrop: r.backdrop && fileExists(backdrop) ? backdrop : null,
    bg: r.bg ?? FALLBACK_ART.bg,
    accent: brighten(r.accent ?? "#b9b2ff"),
    logoDark: !!r.logoDark,
    logoRatio: r.logoRatio ?? 3,
  };
}

function sampleCatalog(reason: Catalog["reason"]): Catalog {
  const titles = (sampleTitles as Omit<Title, "plex">[]).map((t) => ({ ...t, plex: t.lib, tmdb: (artData as Record<string, RawArt>)[t.id]?.tmdbId }));
  const facts: Catalog["facts"] = {};
  for (const [id, cards] of Object.entries(store.facts as Record<string, Fact[]>)) facts[id] = { cards, draft: false };
  return {
    source: "sample", reason, titles,
    art: Object.fromEntries(titles.map((t) => [t.id, sampleArt(t.id)])),
    picks: store.picks.slice(0, 1),
    recs: { ...(store.recs as Pick<Catalog["recs"], "pop" | "deep">), shelf: unwatchedOnShelf(titles.filter((t) => !t.my), new Set()).slice(0, 4), because: [] },
    wish: [],
    facts,
    editions: store.editions as Record<string, string>,
  };
}

/** Machine id of a server set by PLEX_URL + PLEX_TOKEN in .env.local (asks the server). */
async function envMachineId() {
  if (!usingEnv()) return undefined;
  return (await connectedPlex().catch(() => null))?.machineId;
}
