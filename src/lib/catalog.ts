import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { cacheLife, cacheTag } from "next/cache";
import sampleTitles from "@/data/sample-titles.json";
import artData from "@/data/art.json";
import store from "@/data/sample-store.json";
import { brighten } from "./colour";
import { rowToTitle, type DbTitleRow } from "./rowToTitle";
import { db } from "./supabase";

/*
 * The catalogue every page reads: titles from Supabase, with the sample set as a fallback while the database
 * isn't connected, can't be read, or has no titles yet. One cached read per few minutes, tagged "catalog"
 * so a write (e.g. adding a title in the Returns Slot) can refresh it.
 */

export type Kind = "movie" | "series";
export type Title = {
  /** Slug, used in URLs. */
  id: string; t: string; y: number; kind: Kind; g: string; dir: string; run?: string;
  /** On the shelves (sample: on Plex; database: on Plex or added in the Returns Slot). */
  lib: boolean;
  /** On the Plex server. */
  plex: boolean;
  imdb?: number; rt?: number; mc?: number; my?: number;
  cast?: string; ctry?: string; syn: string;
};
export type Art = {
  poster: string | null; logo: string | null; backdrop: string | null;
  bg: string; accent: string; logoDark: boolean; logoRatio: number;
};
export type Rec = { id: string; why: string; who: string };
export type Fact = { k: string; x: string };
export type Catalog = {
  source: "db" | "sample";
  /** Why the sample set is showing. */
  reason?: "not-connected" | "no-access" | "empty";
  titles: Title[];
  art: Record<string, Art>;
  picks: { id: string; why: string }[];
  recs: { pop: Rec[]; deep: Rec[] };
  facts: Record<string, { cards: Fact[]; draft: boolean }>;
  editions: Record<string, string>;
};

export const CATALOG_TAG = "catalog";

export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
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
export const AISLES = ["HORROR", "ROM-COM", "SCI-FI", "FANTASY", "ANIME", "COMEDY", "SERIES"] as const;
export function aisles(titles: Title[]) {
  const extra = [...new Set(titles.map((t) => t.g))].filter((g) => !(AISLES as readonly string[]).includes(g)).sort();
  return [...AISLES, ...extra].map((g) => ({ g, titles: titles.filter((t) => t.g === g) })).filter((a) => a.titles.length);
}

const FALLBACK_ART: Art = { poster: null, logo: null, backdrop: null, bg: "#14112f", accent: brighten("#b9b2ff"), logoDark: false, logoRatio: 3 };

/* ---------- Database ---------- */

const TITLE_COLUMNS =
  "id, slug, kind, tmdb_id, imdb_id, title, year, runtime, seasons_count, genres, keywords, director_or_creator, cast_names, country, language, overview, " +
  "poster_url, backdrop_url, logo_url, spine_bg, spine_accent, logo_dark, logo_ratio, on_plex, in_library, rating_imdb, rating_rt, rating_metacritic, metadata_updated_at";

/** Reads every row of a query, 1000 at a time (the API's page limit). */
async function all<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data as T[]));
    if ((data as T[]).length < 1000) return rows;
  }
}

async function dbCatalog(): Promise<Catalog | null> {
  const client = db()!;
  const rows = await all<DbTitleRow & { id: string }>((a, b) => client.from("titles").select(TITLE_COLUMNS).order("title").range(a, b));
  if (!rows.length) return null;

  type WatchRow = { title_id: string; episode_id: string | null; watched_at: string; rating: number | null };
  type RecRow = { title_id: string; lane: "popular" | "deep_cut"; reason: string | null };
  type NoteRow = { title_id: string; fact_cards: { label?: string; text?: string }[] | null; status: "draft" | "checked" };
  type EditionRow = { spine_number: number | null; programme_items: { title_id: string }[] };
  const [watches, recRows, notes, editionRows] = await Promise.all([
    all<WatchRow>((a, b) => client.from("watches").select("title_id, episode_id, watched_at, rating").order("watched_at", { ascending: false }).range(a, b)),
    client.from("recommendations").select("title_id, lane, reason").or("feedback.is.null,feedback.eq.up").order("score", { ascending: false, nullsFirst: false }).limit(40),
    client.from("title_notes").select("title_id, fact_cards, status"),
    client.from("programmes").select("spine_number, programme_items(title_id)").eq("type", "edition").neq("status", "draft"),
  ]);
  for (const r of [recRows, notes, editionRows]) if (r.error) throw new Error(r.error.message);

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

  const recs: Catalog["recs"] = { pop: [], deep: [] };
  for (const r of recRows.data as RecRow[]) {
    const id = slugOf.get(r.title_id);
    if (!id) continue;
    (r.lane === "popular" ? recs.pop : recs.deep).push({ id, why: r.reason ?? "", who: r.lane === "popular" ? "Popular pick" : "Deep cut" });
  }
  recs.pop = recs.pop.slice(0, 4); recs.deep = recs.deep.slice(0, 4);

  const facts: Catalog["facts"] = {};
  for (const n of notes.data as NoteRow[]) {
    const id = slugOf.get(n.title_id);
    const cards = (n.fact_cards ?? []).filter((f) => f.text).map((f) => ({ k: f.label ?? "", x: f.text! }));
    if (id && cards.length) facts[id] = { cards, draft: n.status !== "checked" };
  }

  const editions: Record<string, string> = {};
  for (const e of editionRows.data as EditionRow[]) {
    for (const item of e.programme_items) {
      const id = slugOf.get(item.title_id);
      if (id && e.spine_number != null) editions[id] = String(e.spine_number).padStart(3, "0");
    }
  }

  return { source: "db", titles, art, picks: tonightsPick(titles, watched, rows), recs, facts, editions };
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
  const titles = (sampleTitles as Omit<Title, "plex">[]).map((t) => ({ ...t, plex: t.lib }));
  const facts: Catalog["facts"] = {};
  for (const [id, cards] of Object.entries(store.facts as Record<string, Fact[]>)) facts[id] = { cards, draft: false };
  return {
    source: "sample", reason, titles,
    art: Object.fromEntries(titles.map((t) => [t.id, sampleArt(t.id)])),
    picks: store.picks.slice(0, 1),
    recs: store.recs as Catalog["recs"],
    facts,
    editions: store.editions as Record<string, string>,
  };
}
