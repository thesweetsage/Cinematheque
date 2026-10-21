import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import sampleTitles from "@/data/sample-titles.json";
import artData from "@/data/art.json";
import store from "@/data/sample-store.json";
import { cacheLife, cacheTag } from "next/cache";
import { brighten } from "./colour";
import { rowToTitle } from "./rowToTitle";
import type { TitleRow } from "./importTitle";
import { db } from "./supabase";

/*
 * The catalogue: titles from the database once Supabase is connected and holds at least one title,
 * otherwise the phase 1 sample set. Picks, recs, facts and editions stay sample-only until their phases.
 */

export type Kind = "movie" | "series";
export type Title = {
  id: string; t: string; y: number; kind: Kind; g: string; dir: string; run?: string; lib: boolean;
  imdb?: number; rt?: number; mc?: number; my?: number; staff?: number; new?: number;
  cast?: string; ctry?: string; syn: string; seasons?: number[]; watched?: number[]; writer?: string; studio?: string;
};
export type Art = {
  poster: string | null; logo: string | null; backdrop: string | null;
  bg: string; accent: string; logoDark: boolean; logoRatio: number;
};
export type Rec = { id: string; why: string; who: string };
export type Entry = { title: Title; art: Art };
export type Catalogue = { sample: boolean; entries: Entry[] };

type RawArt = { tmdbId?: number; bg?: string; accent?: string; logo?: boolean; logoDark?: boolean; logoRatio?: number; backdrop?: boolean };
const RAW = artData as Record<string, RawArt>;
const TITLES = sampleTitles as Title[];

const fileExists = (rel: string) => existsSync(path.join(process.cwd(), "public", rel));


const COLUMNS = "slug, kind, tmdb_id, imdb_id, title, year, runtime, seasons_count, genres, keywords, director_or_creator, cast_names, country, language, overview, poster_url, backdrop_url, logo_url, spine_bg, spine_accent, logo_dark, logo_ratio, rating_imdb, rating_rt, rating_metacritic, metadata_updated_at, on_plex";

/** Every title, newest first. Cached; adding a title expires the "titles" tag. */
export async function loadCatalogue(): Promise<Catalogue> {
  "use cache";
  cacheLife("hours");
  cacheTag("titles");
  const client = db();
  if (client) {
    const { data, error } = await client.from("titles").select(COLUMNS).order("created_at", { ascending: false });
    if (error) console.error(`Reading titles failed, showing sample data: ${error.message}`);
    else if (data.length) return { sample: false, entries: (data as (TitleRow & { on_plex: boolean })[]).map(rowToTitle) };
  }
  return { sample: true, entries: TITLES.map((t) => ({ title: t, art: artFor(t.id) })) };
}

/** What goes on the shelves: the Plex library in the sample set; every saved title once the database is in use. */
export const shelf = (c: Catalogue) => (c.sample ? c.entries.filter((e) => e.title.lib) : c.entries);
export const findEntry = (c: Catalogue, id: string) => c.entries.find((e) => e.title.id === id);

/** Artwork for a sample title. Paths are null when `npm run art` hasn't fetched that image yet. */
function artFor(id: string): Art {
  const r = RAW[id] ?? {};
  const poster = `/art/posters/${id}.jpg`, logo = `/art/logos/${id}.png`, backdrop = `/art/backdrops/${id}.jpg`;
  return {
    poster: fileExists(poster) ? poster : null,
    logo: r.logo && fileExists(logo) ? logo : null,
    backdrop: r.backdrop && fileExists(backdrop) ? backdrop : null,
    bg: r.bg ?? "#14112f",
    accent: brighten(r.accent ?? "#b9b2ff"),
    logoDark: !!r.logoDark,
    logoRatio: r.logoRatio ?? 3,
  };
}

export const picks = store.picks as { id: string; why: string }[];
export const recs = store.recs as { pop: Rec[]; deep: Rec[] };
export const facts = store.facts as Record<string, { k: string; x: string }[]>;
export const editions = store.editions as Record<string, string>;

export function moreLikeThis(c: Catalogue, t: Title, n = 6) {
  return c.entries.filter((x) => x.title.id !== t.id && (x.title.g === t.g || x.title.dir === t.dir)).slice(0, n);
}

const GENRES = ["HORROR", "ROM-COM", "FANTASY", "ANIME", "SERIES"];

/** Shelf sections: the fixed sample aisles, or one per genre found in the database (series get their own aisle). */
export function aisles(c: Catalogue): { sign: string; entries: Entry[] }[] {
  const items = shelf(c);
  if (c.sample) return GENRES.map((g) => ({ sign: g, entries: items.filter((e) => e.title.g === g) }));
  const groups = new Map<string, Entry[]>();
  for (const e of items) {
    const sign = e.title.kind === "series" ? "SERIES" : e.title.g || "OTHER";
    groups.set(sign, [...(groups.get(sign) ?? []), e]);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b))
    .map(([sign, entries]) => ({ sign, entries: entries.sort((a, b) => a.title.t.localeCompare(b.title.t)) }));
}
